"""
AD域认证工具
提供AD域用户认证和查询功能
"""
from typing import Optional, Dict
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
        self.server = config.get('server', '')
        self.domain = config.get('domain', '')
        self.base_dn = config.get('base_dn', '')
        self.bind_user = config.get('bind_user', '')
        self.bind_password = config.get('bind_password', '')
        self.user_search_base = config.get('user_search_base') or self.base_dn
        self.group_search_base = config.get('group_search_base') or self.base_dn
        self.use_ssl = config.get('use_ssl', False)
        self.use_tls = config.get('use_tls', True)
    
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
            return None
        
        try:
            from ldap3 import Server, Connection, ALL, NTLM, SIMPLE, SYNC
            from ldap3.core.exceptions import LDAPException
            
            # 构建服务器地址
            server = Server(
                self.server,
                use_ssl=self.use_ssl,
                get_info=ALL
            )
            
            # 尝试多种认证方式
            auth_methods = [
                # 方式1: UPN格式 (username@domain.com)
                f"{username}@{self.domain}",
                # 方式2: NTLM格式 (domain\\username)
                f"{self.domain}\\{username}",
                # 方式3: sAMAccountName格式
                username
            ]
            
            for auth_user in auth_methods:
                try:
                    # 创建连接并认证
                    conn = Connection(
                        server,
                        user=auth_user,
                        password=password,
                        authentication=SIMPLE if '@' in auth_user or '\\' in auth_user else NTLM,
                        auto_bind=True,
                        raise_exceptions=True
                    )
                    
                    # 认证成功，获取用户信息
                    user_info = self._get_user_info(conn, username)
                    conn.unbind()
                    
                    if user_info:
                        logger.info(f"AD域用户认证成功：{username}")
                        return user_info
                        
                except LDAPException as e:
                    logger.debug(f"认证方式 {auth_user} 失败: {str(e)}")
                    continue
            
            logger.warning(f"AD域用户认证失败：{username}")
            return None
            
        except ImportError:
            logger.error("ldap3库未安装，无法使用AD域认证")
            return None
        except Exception as e:
            logger.error(f"AD域认证异常：{str(e)}", exc_info=True)
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
            from ldap3 import ALL_ATTRIBUTES
            
            # 构造搜索过滤器
            search_filter = f"(|(sAMAccountName={username})(userPrincipalName={username}@{self.domain})(userPrincipalName={username}))"
            
            # 搜索用户
            conn.search(
                search_base=self.user_search_base,
                search_filter=search_filter,
                search_scope='SUBTREE',
                attributes=ALL_ATTRIBUTES
            )
            
            if not conn.entries:
                logger.warning(f"未找到AD域用户：{username}")
                return None
            
            # 获取第一个匹配的用户
            entry = conn.entries[0]
            
            # 提取用户信息
            user_info = {
                'username': str(entry.sAMAccountName) if hasattr(entry, 'sAMAccountName') else username,
                'email': str(entry.mail) if hasattr(entry, 'mail') else f"{username}@{self.domain}",
                'display_name': str(entry.displayName) if hasattr(entry, 'displayName') else username,
                'dn': str(entry.entry_dn) if hasattr(entry, 'entry_dn') else None
            }
            
            return user_info
            
        except Exception as e:
            logger.error(f"获取AD域用户信息失败：{str(e)}", exc_info=True)
            return None
