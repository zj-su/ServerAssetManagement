from pydantic import BaseModel
from typing import Optional
from datetime import datetime

# 服务器基础模型
class ServerBase(BaseModel):
    hostname: str
    ip_address: str
    mac_address: str
    bmc_ip: Optional[str] = None
    bmc_username: Optional[str] = None
    cpu_model: Optional[str] = None
    cpu_cores: Optional[int] = None
    memory_gb: Optional[int] = None
    disk_info: Optional[str] = None
    status: Optional[str] = "offline"
    location: Optional[str] = None

# 创建服务器模型
class ServerCreate(ServerBase):
    pass

# 更新服务器模型
class ServerUpdate(BaseModel):
    hostname: Optional[str] = None
    ip_address: Optional[str] = None
    mac_address: Optional[str] = None
    bmc_ip: Optional[str] = None
    bmc_username: Optional[str] = None
    cpu_model: Optional[str] = None
    cpu_cores: Optional[int] = None
    memory_gb: Optional[int] = None
    disk_info: Optional[str] = None
    status: Optional[str] = None
    location: Optional[str] = None

# 数据库服务器模型
class ServerInDBBase(ServerBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True

# 服务器响应模型
class Server(ServerInDBBase):
    pass