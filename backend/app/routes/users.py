from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.core.database import get_db
from app.models.user import User as UserModel
from app.models.ad_config import ADConfig as ADConfigModel
from app.schemas.user import User, UserCreate, UserUpdate, Token, UserLogin, ChangePassword
from app.utils.security import get_password_hash, verify_password, create_access_token, get_current_user, require_admin
from app.utils.ad_auth import ADAuth
from datetime import timedelta
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/users", tags=["users"])

@router.post("/register", response_model=User)
def register_user(user: UserCreate, db: Session = Depends(get_db)):
    # 检查用户是否已存在
    db_user = db.query(UserModel).filter(UserModel.username == user.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="用户名已存在")
    
    if user.email:
        db_user = db.query(UserModel).filter(UserModel.email == user.email).first()
        if db_user:
            raise HTTPException(status_code=400, detail="邮箱已被注册")
    
    # 创建新用户（与项目介绍一致，支持 email 为空）
    hashed_password = get_password_hash(user.password)
    db_user = UserModel(
        username=user.username,
        email=user.email or None,
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
                    # 如果本地不存在，自动创建AD域用户记录
                    db_user = UserModel(
                        username=ad_user_info['username'],
                        email=ad_user_info['email'],
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
                        db_user.email = ad_user_info['email']
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
    
    # 创建访问令牌
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": db_user.username, "role": db_user.role}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/list", response_model=List[User])
def get_users(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """获取用户列表（需要登录）"""
    users = db.query(UserModel).offset(skip).limit(limit).all()
    return users

@router.get("/{user_id}", response_model=User)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
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
    current_user: UserModel = Depends(get_current_user)
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
    current_user: UserModel = Depends(get_current_user)
):
    """获取AD域用户的组信息（需要登录）"""
    user = db.query(UserModel).filter(UserModel.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="用户未找到")
    
    if not user.is_ad_user:
        raise HTTPException(status_code=400, detail="该用户不是AD域用户")
    
    # 获取AD域配置
    ad_config = db.query(ADConfigModel).filter(ADConfigModel.enabled == True).first()
    if not ad_config:
        raise HTTPException(status_code=400, detail="AD域未配置或未启用")
    
    try:
        from app.utils.ad_auth import ADAuth
        
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
        # TODO: 实现获取用户组的方法
        # groups = ad_auth.get_user_groups(user.username)
        # return groups
        return []  # 暂时返回空列表
    except Exception as e:
        logger.error(f"获取AD域用户组失败：{str(e)}")
        raise HTTPException(status_code=500, detail=f"获取用户组失败：{str(e)}")

@router.post("/sync-ad-user/{username}")
def sync_ad_user(
    username: str,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_admin)
):
    """同步单个AD域用户（需要管理员权限）"""
    # 获取AD域配置
    ad_config = db.query(ADConfigModel).filter(ADConfigModel.enabled == True).first()
    if not ad_config:
        raise HTTPException(status_code=400, detail="AD域未配置或未启用")
    
    try:
        from app.utils.ad_auth import ADAuth
        
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
        # 使用服务账号查询用户信息（需要实现）
        # user_info = ad_auth.get_user_info_by_username(username)
        # 创建或更新用户记录
        return {"message": "同步功能待实现"}
    except Exception as e:
        logger.error(f"同步AD域用户失败：{str(e)}")
        raise HTTPException(status_code=500, detail=f"同步失败：{str(e)}")

@router.post("/sync-all-ad-users")
def sync_all_ad_users(
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_admin)
):
    """批量同步所有AD域用户（需要管理员权限）"""
    # 触发同步任务
    from app.utils.ad_sync_scheduler import sync_all_ad_users_job
    try:
        sync_all_ad_users_job()
        return {"message": "AD域用户同步任务已触发"}
    except Exception as e:
        logger.error(f"触发AD域用户同步失败：{str(e)}")
        raise HTTPException(status_code=500, detail=f"同步失败：{str(e)}")

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
    current_user: UserModel = Depends(require_admin)
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