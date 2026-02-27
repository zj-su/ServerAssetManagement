from pydantic import BaseModel
from typing import Optional
from datetime import datetime

# 用户基础模型（与项目介绍一致，AD域用户 email 可为空）
class UserBase(BaseModel):
    username: str
    email: Optional[str] = None
    role: Optional[str] = "user"
    is_ad_user: Optional[bool] = False
    ad_dn: Optional[str] = None
    display_name: Optional[str] = None

# 创建用户模型
class UserCreate(UserBase):
    password: str

# 更新用户模型
class UserUpdate(BaseModel):
    username: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None
    password: Optional[str] = None
    display_name: Optional[str] = None

# 修改密码模型
class ChangePassword(BaseModel):
    old_password: str
    new_password: str

# 数据库用户模型
class UserInDBBase(UserBase):
    id: int
    created_at: datetime

    class Config:
        orm_mode = True

# 用户响应模型
class User(UserInDBBase):
    is_ad_user: Optional[bool] = False
    ad_dn: Optional[str] = None
    display_name: Optional[str] = None
    updated_at: Optional[datetime] = None

# Token模型
class Token(BaseModel):
    access_token: str
    token_type: str
    username: Optional[str] = None
    role: Optional[str] = None
    permissions: Optional[list] = None

# Token数据模型
class TokenData(BaseModel):
    username: Optional[str] = None

# 用户登录模型（只需要用户名和密码）
class UserLogin(BaseModel):
    username: str
    password: str
