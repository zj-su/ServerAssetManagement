from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.core.database import get_db
from app.models.user import User as UserModel
from app.models.ad_user_group import ADUserGroup as ADUserGroupModel
from app.models.ad_config import ADConfig as ADConfigModel
from app.schemas.user import User, UserCreate, UserUpdate, Token, UserLogin, ChangePassword
from app.utils.security import (
    get_password_hash,
    verify_password,
    create_access_token,
    get_current_user,
    require_admin,
    require_permission,
    get_role_permissions,
)
from app.utils.ad_auth import ADAuth
from datetime import timedelta
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/users", tags=["users"])


def _build_unique_ad_email(db: Session, username: str, candidate_email: Optional[str], current_user_id: Optional[int] = None) -> str:
    """
    生成可用于 users.email(UNIQUE) 的邮箱值。
    - 过滤空值/异常值（如 []）
    - 若冲突，自动追加后缀
    """
    raw = (candidate_email or "").strip()
    if raw in ("", "[]", "None", "null"):
        raw = ""
    base = raw or f"{username}@ad.local"

    local, at, domain = base.partition("@")
    if not at:
        local = local or username
        domain = "ad.local"
    local = local or username
    domain = domain or "ad.local"

    email = f"{local}@{domain}"
    idx = 1
    while True:
        exists = db.query(UserModel).filter(UserModel.email == email).first()
        if not exists or (current_user_id is not None and exists.id == current_user_id):
            return email
        idx += 1
        email = f"{local}.{idx}@{domain}"


def _sync_local_user_groups(db: Session, user_id: int, groups: List[str]) -> int:
    """覆盖式更新本地 AD 用户组快照"""
    db.query(ADUserGroupModel).filter(ADUserGroupModel.user_id == user_id).delete()
    count = 0
    seen = set()
    for name in groups or []:
        group_name = (name or "").strip()
        if not group_name or group_name in seen:
            continue
        seen.add(group_name)
        db.add(ADUserGroupModel(user_id=user_id, group_name=group_name))
        count += 1
    return count

@router.post("/register", response_model=User)
def register_user(
    user: UserCreate,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_permission("user:write"))
):
    # 检查用户是否已存在
    db_user = db.query(UserModel).filter(UserModel.username == user.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="用户名已存在")
    
    if user.email:
        db_user = db.query(UserModel).filter(UserModel.email == user.email).first()
        if db_user:
            raise HTTPException(status_code=400, detail="邮箱已被注册")
    
    # 兼容历史库：部分环境 users.email 为 NOT NULL，空邮箱时生成占位邮箱
    email_value = (user.email or "").strip() or f"{user.username}@local.invalid"

    # 创建新用户
    hashed_password = get_password_hash(user.password)
    db_user = UserModel(
        username=user.username,
        email=email_value,
        hashed_password=hashed_password,
        role=user.role or "user"
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

@router.post("/login", response_model=Token)
def login_user(user: UserLogin, db: Session = Depends(get_db)):
    """
    用户登录接口
    支持本地用户和AD域用户认证
    """
    db_user = None
    
    # 从数据库获取AD域配置
    ad_config = db.query(ADConfigModel).filter(ADConfigModel.enabled == True).first()
    
    # 首先尝试AD域认证（如果启用）
    if ad_config:
        try:
            # 创建AD认证实例
            ad_config_dict = {
                'enabled': ad_config.enabled,
                'server': ad_config.server,
                'domain': ad_config.domain,
                'base_dn': ad_config.base_dn,
                'bind_user': ad_config.bind_user,
                'bind_password': ad_config.bind_password,
                'user_search_base': ad_config.user_search_base,
                'group_search_base': ad_config.group_search_base,
                'use_ssl': ad_config.use_ssl,
                'use_tls': ad_config.use_tls
            }
            
            ad_auth = ADAuth(ad_config_dict)
            ad_user_info = ad_auth.authenticate(user.username, user.password)
            
            if ad_user_info:
                # AD域认证成功
                logger.info(f"AD域用户认证成功：{user.username}")
                
                # 检查本地数据库中是否存在该用户
                db_user = db.query(UserModel).filter(UserModel.username == ad_user_info['username']).first()
                
                if not db_user:
                    ad_email = _build_unique_ad_email(
                        db,
                        ad_user_info['username'],
                        ad_user_info.get('email'),
                    )
                    # 如果本地不存在，自动创建AD域用户记录
                    db_user = UserModel(
                        username=ad_user_info['username'],
                        email=ad_email,
                        hashed_password="",  # AD域用户使用空字符串
                        role='user',  # 默认角色
                        is_ad_user=True,
                        ad_dn=ad_user_info.get('dn'),
                        display_name=ad_user_info.get('display_name')
                    )
                    db.add(db_user)
                    db.commit()
                    db.refresh(db_user)
                    logger.info(f"自动创建AD域用户记录：{ad_user_info['username']}")
                else:
                    # 更新AD域用户信息
                    if db_user.is_ad_user:
                        db_user.email = _build_unique_ad_email(
                            db,
                            db_user.username,
                            ad_user_info.get('email') or db_user.email,
                            current_user_id=db_user.id,
                        )
                        db_user.ad_dn = ad_user_info.get('dn')
                        db_user.display_name = ad_user_info.get('display_name')
                        db.commit()
                        db.refresh(db_user)
        except Exception as e:
            logger.error(f"AD域认证异常：{str(e)}")
            # AD域认证失败，继续尝试本地认证
    
    # 如果AD域认证失败或未启用，尝试本地用户认证
    if not db_user:
        db_user = db.query(UserModel).filter(UserModel.username == user.username).first()
        if not db_user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="用户名或密码错误",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # 检查是否为AD域用户
        if db_user.is_ad_user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="AD域用户请使用AD域认证",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # 验证本地用户密码
        if not verify_password(user.password, db_user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="用户名或密码错误",
                headers={"WWW-Authenticate": "Bearer"},
            )
    
    permissions = get_role_permissions(db, db_user.role)

    # 创建访问令牌
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": db_user.username, "role": db_user.role, "permissions": permissions}, expires_delta=access_token_expires
    )
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "username": db_user.username,
        "role": db_user.role,
        "permissions": permissions,
    }

@router.get("/list", response_model=List[User])
def get_users(
    query: Optional[str] = Query(None, description="搜索关键词（用户名、邮箱、显示名称）"),
    is_ad_user: Optional[bool] = Query(None, description="是否仅返回AD用户"),
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_permission("user:read"))
):
    """获取用户列表（需要登录）"""
    q = db.query(UserModel)
    if is_ad_user is not None:
        q = q.filter(UserModel.is_ad_user == is_ad_user)
    if query:
        search_filter = f"%{query}%"
        q = q.filter(
            (UserModel.username.like(search_filter)) |
            (UserModel.email.like(search_filter)) |
            (UserModel.display_name.like(search_filter))
        )
    users = q.offset(skip).limit(limit).all()
    return users


@router.get("/count")
def get_users_count(
    query: Optional[str] = Query(None, description="搜索关键词（用户名、邮箱、显示名称）"),
    is_ad_user: Optional[bool] = Query(None, description="是否仅统计AD用户"),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_permission("user:read"))
):
    """获取用户总数（用于分页）"""
    q = db.query(UserModel)
    if is_ad_user is not None:
        q = q.filter(UserModel.is_ad_user == is_ad_user)
    if query:
        search_filter = f"%{query}%"
        q = q.filter(
            (UserModel.username.like(search_filter)) |
            (UserModel.email.like(search_filter)) |
            (UserModel.display_name.like(search_filter))
        )
    return {"total": q.count()}


@router.get("/ad-groups")
def get_ad_groups(
    query: Optional[str] = Query(None, description="组名搜索关键词"),
    skip: int = 0,
    limit: int = 1000,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_permission("user:read"))
):
    """从本地快照获取 AD 用户组聚合（组名 + 成员）"""
    rows = db.query(ADUserGroupModel, UserModel).join(
        UserModel, ADUserGroupModel.user_id == UserModel.id
    ).filter(UserModel.is_ad_user == True).all()

    group_map = {}
    q = (query or "").strip().lower()
    for rel, user in rows:
        name = (rel.group_name or "").strip()
        if not name:
            continue
        if q and q not in name.lower():
            continue
        if name not in group_map:
            group_map[name] = []
        group_map[name].append({
            "id": user.id,
            "username": user.username,
            "display_name": user.display_name or "",
        })

    groups = [
        {"name": name, "members": members, "count": len(members)}
        for name, members in group_map.items()
    ]
    groups.sort(key=lambda x: (-x["count"], x["name"]))
    return {
        "total": len(groups),
        "items": groups[skip: skip + limit],
    }

@router.get("/{user_id}", response_model=User)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_permission("user:read"))
):
    """获取用户详情（需要登录）"""
    user = db.query(UserModel).filter(UserModel.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="用户未找到")
    return user

@router.get("/search", response_model=List[User])
def search_users(
    query: str = Query(..., description="搜索关键词（用户名、邮箱、显示名称）"),
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_permission("user:read"))
):
    """搜索用户（需要登录）"""
    search_filter = f"%{query}%"
    users = db.query(UserModel).filter(
        (UserModel.username.like(search_filter)) |
        (UserModel.email.like(search_filter)) |
        (UserModel.display_name.like(search_filter))
    ).offset(skip).limit(limit).all()
    return users

@router.get("/{user_id}/groups", response_model=List[str])
def get_user_groups(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_permission("user:read"))
):
    """获取AD域用户的组信息（需要登录）"""
    user = db.query(UserModel).filter(UserModel.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="用户未找到")
    
    if not user.is_ad_user:
        raise HTTPException(status_code=400, detail="该用户不是AD域用户")
    
    # 优先返回本地快照，避免每次实时打 AD
    local_groups = db.query(ADUserGroupModel).filter(ADUserGroupModel.user_id == user.id).all()
    if local_groups:
        return sorted(list(set([(g.group_name or "").strip() for g in local_groups if (g.group_name or "").strip()])))

    # 无本地快照时再回源 AD，并写入本地
    ad_config = db.query(ADConfigModel).filter(ADConfigModel.enabled == True).first()
    if not ad_config:
        raise HTTPException(status_code=400, detail="AD域未配置或未启用")

    try:
        ad_config_dict = {
            'enabled': ad_config.enabled,
            'server': ad_config.server,
            'domain': ad_config.domain,
            'base_dn': ad_config.base_dn,
            'bind_user': ad_config.bind_user,
            'bind_password': ad_config.bind_password,
            'user_search_base': ad_config.user_search_base,
            'group_search_base': ad_config.group_search_base,
            'use_ssl': ad_config.use_ssl,
            'use_tls': ad_config.use_tls
        }
        
        ad_auth = ADAuth(ad_config_dict)
        groups = ad_auth.get_user_groups(user.username)
        _sync_local_user_groups(db, user.id, groups)
        db.commit()
        return groups
    except Exception as e:
        logger.error(f"获取AD域用户组失败：{str(e)}")
        raise HTTPException(status_code=500, detail=f"获取用户组失败：{str(e)}")

@router.post("/sync-ad-user/{username}")
def sync_ad_user(
    username: str,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_permission("user:write"))
):
    """同步单个AD域用户（需要管理员权限）"""
    # 获取AD域配置
    ad_config = db.query(ADConfigModel).filter(ADConfigModel.enabled == True).first()
    if not ad_config:
        raise HTTPException(status_code=400, detail="AD域未配置或未启用")
    
    try:
        ad_config_dict = {
            'enabled': ad_config.enabled,
            'server': ad_config.server,
            'domain': ad_config.domain,
            'base_dn': ad_config.base_dn,
            'bind_user': ad_config.bind_user,
            'bind_password': ad_config.bind_password,
            'user_search_base': ad_config.user_search_base,
            'group_search_base': ad_config.group_search_base,
            'use_ssl': ad_config.use_ssl,
            'use_tls': ad_config.use_tls
        }
        
        ad_auth = ADAuth(ad_config_dict)
        user_info = ad_auth.get_user_info_by_username(username)
        if not user_info:
            raise HTTPException(status_code=404, detail=ad_auth.last_error or "未找到AD用户")

        ad_username = (user_info.get("username") or username).strip()
        db_user = db.query(UserModel).filter(UserModel.username == ad_username).first()
        ad_email = _build_unique_ad_email(db, ad_username, user_info.get("email"))
        if not db_user:
            db_user = UserModel(
                username=ad_username,
                email=ad_email,
                hashed_password="",
                role="user",
                is_ad_user=True,
                ad_dn=user_info.get("dn"),
                display_name=user_info.get("display_name") or ad_username,
            )
            db.add(db_user)
            action = "created"
        else:
            db_user.is_ad_user = True
            db_user.email = _build_unique_ad_email(
                db,
                db_user.username,
                user_info.get("email") or db_user.email,
                current_user_id=db_user.id,
            )
            db_user.ad_dn = user_info.get("dn")
            db_user.display_name = user_info.get("display_name") or db_user.display_name
            action = "updated"
        groups = user_info.get("groups") or ad_auth.get_user_groups(ad_username)
        group_count = _sync_local_user_groups(db, db_user.id, groups)
        db.commit()
        return {"message": "同步成功", "action": action, "username": ad_username, "groups": group_count}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"同步AD域用户失败：{str(e)}")
        raise HTTPException(status_code=500, detail=f"同步失败：{str(e)}")

@router.post("/sync-all-ad-users")
def sync_all_ad_users(
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_permission("user:write"))
):
    """批量同步所有AD域用户（需要管理员权限）"""
    # 触发同步任务
    from app.utils.ad_sync_scheduler import sync_all_ad_users_job
    try:
        result = sync_all_ad_users_job()
        if result.get("error"):
            raise HTTPException(status_code=500, detail=f"同步失败：{result['error']}")
        return {
            "message": "AD域用户同步完成",
            "total": result.get("total", 0),
            "created": result.get("created", 0),
            "updated": result.get("updated", 0),
            "groups": result.get("groups", 0),
        }
    except HTTPException:
        raise
    except Exception as e:
        err_msg = str(e) or repr(e) or "未知错误"
        logger.error(f"触发AD域用户同步失败：{err_msg}")
        raise HTTPException(status_code=500, detail=f"同步失败：{err_msg}")

@router.put("/{user_id}", response_model=User)
def update_user(
    user_id: int,
    user_update: UserUpdate,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """更新用户信息（需要登录，只能更新自己的信息或管理员可以更新任何用户）"""
    db_user = db.query(UserModel).filter(UserModel.id == user_id).first()
    if db_user is None:
        raise HTTPException(status_code=404, detail="用户未找到")
    
    # 检查权限：只能更新自己的信息，或管理员可以更新任何用户
    if current_user.id != user_id and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="无权更新其他用户信息"
        )
    
    # 如果是AD域用户，不允许修改某些字段
    if db_user.is_ad_user and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="AD域用户信息只能由管理员修改"
        )
    
    # 更新用户信息
    update_data = user_update.dict(exclude_unset=True)

    # 非具备角色管理权限的用户不能修改角色（防止越权提权）
    if "role" in update_data and current_user.role != "admin" and not ("role:write" in get_role_permissions(db, current_user.role)):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="仅管理员可修改用户角色"
        )
    
    # 如果更新密码
    if "password" in update_data and update_data["password"]:
        if db_user.is_ad_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="AD域用户不能修改密码"
            )
        update_data["hashed_password"] = get_password_hash(update_data.pop("password"))
    
    # 更新字段
    for key, value in update_data.items():
        if key != "password":  # 密码已处理
            setattr(db_user, key, value)
    
    db.commit()
    db.refresh(db_user)
    return db_user

@router.put("/{user_id}/change-password")
def change_password(
    user_id: int,
    password_data: ChangePassword,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """修改用户密码（仅本地用户，需要提供旧密码）"""
    db_user = db.query(UserModel).filter(UserModel.id == user_id).first()
    if db_user is None:
        raise HTTPException(status_code=404, detail="用户未找到")
    
    # 检查权限：只能修改自己的密码，或管理员可以修改任何用户的密码
    if current_user.id != user_id and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="无权修改其他用户密码"
        )
    
    # AD域用户不能修改密码
    if db_user.is_ad_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="AD域用户不能修改密码，请使用AD域认证"
        )
    
    # 如果不是管理员，需要验证旧密码
    if current_user.role != "admin":
        if not verify_password(password_data.old_password, db_user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="旧密码错误"
            )
    
    if not password_data.new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="新密码不能为空"
        )
    
    # 更新密码
    db_user.hashed_password = get_password_hash(password_data.new_password)
    db.commit()
    
    return {"message": "密码修改成功"}

@router.delete("/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_permission("user:delete"))
):
    """删除用户（需要管理员权限）"""
    db_user = db.query(UserModel).filter(UserModel.id == user_id).first()
    if db_user is None:
        raise HTTPException(status_code=404, detail="用户未找到")
    
    # 不能删除自己
    if db_user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="不能删除自己的账户"
        )
    
    db.delete(db_user)
    db.commit()
    return {"message": "用户已删除"}