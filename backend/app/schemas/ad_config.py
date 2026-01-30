from pydantic import BaseModel
from typing import Optional
from datetime import datetime

# AD域配置基础模型
class ADConfigBase(BaseModel):
    enabled: bool = False
    server: Optional[str] = None
    domain: Optional[str] = None
    base_dn: Optional[str] = None
    bind_user: Optional[str] = None
    bind_password: Optional[str] = None
    user_search_base: Optional[str] = None
    group_search_base: Optional[str] = None
    use_ssl: bool = False
    use_tls: bool = True
    description: Optional[str] = None

# 创建/更新AD域配置模型
class ADConfigCreate(ADConfigBase):
    pass

class ADConfigUpdate(ADConfigBase):
    pass

# AD域配置响应模型（不包含密码）
class ADConfig(ADConfigBase):
    id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        orm_mode = True

# AD域连接测试请求
class ADConfigTest(BaseModel):
    username: str
    password: str

# AD域连接测试响应
class ADConfigTestResponse(BaseModel):
    success: bool
    message: str
    user_info: Optional[dict] = None
