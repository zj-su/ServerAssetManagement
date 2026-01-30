from passlib.context import CryptContext
from datetime import datetime, timedelta
from typing import Optional
from jose import jwt, JWTError
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.database import get_db
from app.models.user import User as UserModel

# 密码加密上下文
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# HTTP Bearer认证
security = HTTPBearer()

# JWT相关函数
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    # 限制密码长度不超过72字节
    password_bytes = password.encode('utf-8')
    if len(password_bytes) > 72:
        password = password_bytes[:72].decode('utf-8', 'ignore')
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm="HS256")
    return encoded_jwt

def verify_token(token: str) -> Optional[dict]:
    """
    验证JWT token并返回payload
    
    Args:
        token: JWT token字符串
        
    Returns:
        token payload字典，如果验证失败返回None
    """
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        return payload
    except JWTError:
        return None

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> UserModel:
    """
    从JWT token中获取当前登录用户
    
    Args:
        credentials: HTTP Bearer认证凭据
        db: 数据库会话
        
    Returns:
        当前用户对象
        
    Raises:
        HTTPException: 如果token无效或用户不存在
    """
    token = credentials.credentials
    payload = verify_token(token)
    
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="无效的认证token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    username: str = payload.get("sub")
    if username is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="无法从token中获取用户名",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # 从数据库获取用户信息
    user = db.query(UserModel).filter(UserModel.username == username).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户不存在",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return user

def get_current_username(
    current_user: UserModel = Depends(get_current_user)
) -> str:
    """
    获取当前登录用户的用户名（显示名称优先）
    
    Args:
        current_user: 当前用户对象
        
    Returns:
        用户名（优先返回display_name，否则返回username）
    """
    # 优先使用display_name，如果没有则使用username
    return current_user.display_name or current_user.username if hasattr(current_user, 'display_name') else current_user.username

def require_admin(
    current_user: UserModel = Depends(get_current_user)
) -> UserModel:
    """
    要求当前用户必须是管理员角色
    
    Args:
        current_user: 当前用户对象
        
    Returns:
        当前用户对象（如果是管理员）
        
    Raises:
        HTTPException: 如果用户不是管理员
    """
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="需要管理员权限"
        )
    return current_user