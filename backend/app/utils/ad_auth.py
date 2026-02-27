"""
AD域认证工具
提供AD域用户认证和查询功能
"""
from typing import Optional, Dict, List
import logging

logger = logging.getLogger(__name__)

class ADAuth:
    """AD域认证类"""
    
    def __init__(self, config: dict):
        """
        初始化AD域认证
        
        Args:
            config: AD域配置字典
        """
        self.enabled = config.get('enabled', False)
        raw_server = (config.get('server', '') or '').strip()
        # 兼容用户填写 ldap:// 或 ldaps:// 前缀
        if raw_server.startswith('ldaps://'):
            raw_server = raw_server.replace('ldaps://', '', 1)
            self.use_ssl = True
        elif raw_server.startswith('ldap://'):
            raw_server = raw_server.replace('ldap://', '', 1)
            self.use_ssl = config.get('use_ssl', False)
        else:
            self.use_ssl = config.get('use_ssl', False)
        self.server = raw_server.rstrip('/')
        self.domain = config.get('domain', '')
        self.base_dn = config.get('base_dn', '')
        self.bind_user = config.get('bind_user', '')
        self.bind_password = config.get('bind_password', '')
        self.user_search_base = config.get('user_search_base') or self.base_dn
        self.group_search_base = config.get('group_search_base') or self.base_dn
        self.use_tls = config.get('use_tls', True)
        self.last_error = ""

    def _auth_type_for_user(self, user: str):
        from ldap3 import NTLM, SIMPLE
        return NTLM if '\\' in user else SIMPLE

    def _open_connection(self, server, user: str, password: str, authentication):
        from ldap3 import Connection
        conn = Connection(
            server,
            user=user,
            password=password,
            authentication=authentication,
            auto_bind=False,
            raise_exceptions=True
        )
        conn.open()
        if self.use_tls and not self.use_ssl:
            conn.start_tls()
        conn.bind()
        return conn

    def _normalize_username(self, username: str) -> str:
        val = (username or "").strip()
        if '\\' in val:
            val = val.split('\\')[-1]
        if '@' in val:
            val = val.split('@')[0]
        return val

    def _clean_attr_value(self, value):
        """清洗 ldap3 属性值，避免 [] 被当字符串写入数据库"""
        if value is None:
            return None
        if isinstance(value, (list, tuple)):
            if not value:
                return None
            value = value[0]
        text = str(value).strip()
        if text in ("", "[]", "None", "null"):
            return None
        return text

    def _read_entry_attr(self, entry, attr_name: str):
        if not hasattr(entry, attr_name):
            return None
        try:
            ldap_attr = getattr(entry, attr_name)
            raw_value = getattr(ldap_attr, "value", ldap_attr)
            return self._clean_attr_value(raw_value)
        except Exception:
            return None
    
    def authenticate(self, username: str, password: str) -> Optional[Dict]:
        """
        认证AD域用户
        
        Args:
            username: 用户名（支持多种格式）
            password: 密码
            
        Returns:
            用户信息字典，如果认证失败返回None
        """
        if not self.enabled:
            logger.warning("AD域未启用")
            self.last_error = "AD域未启用"
            return None
        
        try:
            from ldap3 import Server, ALL, NTLM, SIMPLE
            from ldap3.core.exceptions import LDAPException
            self.last_error = ""
            
            # 构建服务器地址
            server = Server(
                self.server,
                use_ssl=self.use_ssl,
                get_info=ALL
            )
            
            username = (username or "").strip()
            auth_methods = []
            if '\\' in username:
                auth_methods.append((username, NTLM, "输入的NTLM格式"))
            elif '@' in username:
                auth_methods.append((username, SIMPLE, "输入的UPN格式"))
            else:
                if self.domain:
                    auth_methods.append((f"{username}@{self.domain}", SIMPLE, "UPN格式"))
                    auth_methods.append((f"{self.domain}\\{username}", NTLM, "NTLM格式"))
                auth_methods.append((username, SIMPLE, "sAMAccountName格式"))

            # 去重，避免重复尝试相同组合
            dedup = []
            seen = set()
            for user_value, auth_type, label in auth_methods:
                key = (user_value, str(auth_type))
                if key not in seen:
                    seen.add(key)
                    dedup.append((user_value, auth_type, label))
            
            for auth_user, auth_type, label in dedup:
                conn = None
                try:
                    conn = self._open_connection(server, auth_user, password, auth_type)
                    
                    # 认证成功，获取用户信息
                    user_info = self._get_user_info(conn, self._normalize_username(username))
                    if conn is not None:
                        conn.unbind()
                    
                    if user_info:
                        logger.info(f"AD域用户认证成功：{username}")
                        return user_info
                    # 认证成功但读取用户属性失败时，仍判定认证成功（避免误报失败）
                    normalized = self._normalize_username(username)
                    logger.info(f"AD域用户认证成功（属性读取受限）：{normalized}")
                    return {
                        "username": normalized,
                        "email": f"{normalized}@{self.domain}" if self.domain else "",
                        "display_name": normalized,
                        "dn": None
                    }
                        
                except LDAPException as e:
                    self.last_error = f"{label}认证失败: {str(e)}"
                    logger.debug(f"认证方式 {auth_user} 失败: {str(e)}")
                    continue
                finally:
                    if conn is not None:
                        try:
                            conn.unbind()
                        except Exception:
                            pass
            
            logger.warning(f"AD域用户认证失败：{username}")
            if not self.last_error:
                self.last_error = "AD域认证失败，请检查用户名/密码或域配置"
            return None
            
        except ImportError:
            logger.error("ldap3库未安装，无法使用AD域认证")
            self.last_error = "ldap3库未安装，无法进行AD认证"
            return None
        except Exception as e:
            logger.error(f"AD域认证异常：{str(e)}", exc_info=True)
            self.last_error = f"AD域认证异常: {str(e)}"
            return None
    
    def _get_user_info(self, conn, username: str) -> Optional[Dict]:
        """
        获取AD域用户信息
        
        Args:
            conn: 已认证的LDAP连接
            username: 用户名
            
        Returns:
            用户信息字典
        """
        try:
            from ldap3 import ALL_ATTRIBUTES, SUBTREE
            
            # 构造搜索过滤器
            search_filter = f"(|(sAMAccountName={username})(userPrincipalName={username}@{self.domain})(userPrincipalName={username}))"
            
            # 搜索用户
            conn.search(
                search_base=self.user_search_base,
                search_filter=search_filter,
                search_scope=SUBTREE,
                attributes=ALL_ATTRIBUTES
            )
            
            if not conn.entries:
                logger.warning(f"未找到AD域用户：{username}")
                return None
            
            # 获取第一个匹配的用户
            entry = conn.entries[0]
            
            # 提取用户信息
            username_value = self._read_entry_attr(entry, "sAMAccountName") or username
            email_value = self._read_entry_attr(entry, "mail")
            display_name_value = self._read_entry_attr(entry, "displayName") or username_value
            dn_value = self._clean_attr_value(getattr(entry, "entry_dn", None))

            user_info = {
                'username': username_value,
                'email': email_value or (f"{username_value}@{self.domain}" if self.domain else None),
                'display_name': display_name_value,
                'dn': dn_value
            }
            
            return user_info
            
        except Exception as e:
            logger.error(f"获取AD域用户信息失败：{str(e)}", exc_info=True)
            return None

    def _extract_group_name(self, group_dn: str) -> str:
        """从 DN 中提取组名（优先 CN）"""
        try:
            for part in str(group_dn).split(','):
                part = part.strip()
                if part.upper().startswith('CN='):
                    return part[3:]
            return str(group_dn)
        except Exception:
            return str(group_dn)

    def _extract_group_names(self, member_of_values) -> List[str]:
        values = member_of_values or []
        if not isinstance(values, list):
            values = [values]
        groups = [self._extract_group_name(v) for v in values if v]
        return sorted(list(set([g for g in groups if g])))

    def _bind_service_connection(self):
        """使用服务账号建立 LDAP 连接"""
        from ldap3 import Server, ALL
        server = Server(self.server, use_ssl=self.use_ssl, get_info=ALL)
        auth_type = self._auth_type_for_user(self.bind_user or "")
        return self._open_connection(server, self.bind_user, self.bind_password, auth_type)

    def get_user_groups(self, username: str) -> List[str]:
        """
        获取 AD 用户所属组（来自 AD，非本地缓存）
        """
        if not self.enabled:
            return []
        if not username:
            return []

        conn = None
        try:
            from ldap3 import SUBTREE

            conn = self._bind_service_connection()
            search_filter = (
                f"(|(sAMAccountName={username})"
                f"(userPrincipalName={username}@{self.domain})"
                f"(userPrincipalName={username}))"
            )
            conn.search(
                search_base=self.user_search_base,
                search_filter=search_filter,
                search_scope=SUBTREE,
                attributes=['memberOf']
            )
            if not conn.entries:
                return []

            entry = conn.entries[0]
            member_of = []
            if hasattr(entry, 'memberOf'):
                member_of = entry.memberOf.values or []

            groups = [self._extract_group_name(v) for v in member_of if v]
            # 去重并排序，保证前端展示稳定
            return sorted(list(set(groups)))
        except Exception as e:
            logger.error(f"获取AD域用户组失败：{str(e)}", exc_info=True)
            return []
        finally:
            if conn is not None:
                try:
                    conn.unbind()
                except Exception:
                    pass

    def get_user_info_by_username(self, username: str) -> Optional[Dict]:
        """使用服务账号按用户名查询 AD 用户信息"""
        if not self.enabled or not username:
            return None
        conn = None
        try:
            conn = self._bind_service_connection()
            return self._get_user_info(conn, self._normalize_username(username))
        except Exception as e:
            logger.error(f"按用户名查询AD用户失败：{str(e)}", exc_info=True)
            self.last_error = f"按用户名查询AD用户失败: {str(e)}"
            return None
        finally:
            if conn is not None:
                try:
                    conn.unbind()
                except Exception:
                    pass

    def list_all_users(self, limit: int = 2000) -> List[Dict]:
        """使用服务账号枚举 AD 用户（用于批量同步）"""
        if not self.enabled:
            self.last_error = "AD域未启用"
            return []

        conn = None
        try:
            from ldap3 import SUBTREE
            conn = self._bind_service_connection()
            search_filter = "(&(objectClass=user)(objectCategory=person)(sAMAccountName=*))"
            conn.search(
                search_base=self.user_search_base,
                search_filter=search_filter,
                search_scope=SUBTREE,
                attributes=["sAMAccountName", "mail", "displayName", "distinguishedName", "memberOf"],
                size_limit=limit
            )
            result = []
            for entry in conn.entries or []:
                username = self._read_entry_attr(entry, "sAMAccountName") or ""
                if not username:
                    continue
                email_value = self._read_entry_attr(entry, "mail")
                display_name_value = self._read_entry_attr(entry, "displayName") or username
                dn_value = self._clean_attr_value(getattr(entry, "entry_dn", None)) or self._read_entry_attr(entry, "distinguishedName")
                member_of_values = []
                if hasattr(entry, "memberOf"):
                    try:
                        member_of_values = entry.memberOf.values or []
                    except Exception:
                        member_of_values = []
                result.append({
                    "username": username,
                    "email": email_value or (f"{username}@{self.domain}" if self.domain else None),
                    "display_name": display_name_value,
                    "dn": dn_value,
                    "groups": self._extract_group_names(member_of_values),
                })
            return result
        except Exception as e:
            logger.error(f"枚举AD用户失败：{str(e)}", exc_info=True)
            self.last_error = f"枚举AD用户失败: {str(e)}"
            return []
        finally:
            if conn is not None:
                try:
                    conn.unbind()
                except Exception:
                    pass
