from pydantic import BaseModel
from typing import Optional
from datetime import datetime, date

# 服务器基础模型（与服务器模块字段一致）
class ServerBase(BaseModel):
    asset_code: Optional[str] = None          # 资产编码 SY-SR-0001，创建时自动生成
    serial_number: Optional[str] = None       # 序列号(SN)
    hostname: Optional[str] = None
    ip_address: Optional[str] = None         # 系统IP
    mac_address: Optional[str] = None
    brand: Optional[str] = None               # 品牌
    model: Optional[str] = None               # 型号
    bmc_ip: Optional[str] = None
    bmc_username: Optional[str] = None       # BMC账号
    bmc_password: Optional[str] = None        # BMC密码
    user_person: Optional[str] = None         # 使用人
    system_username: Optional[str] = None     # 系统账号
    system_password: Optional[str] = None     # 系统密码
    u_position: Optional[str] = None         # U位
    u_height: Optional[int] = None            # U高度
    status: Optional[str] = "offline"
    location: Optional[str] = None            # 位置
    department: Optional[str] = None          # 部门
    contract_number: Optional[str] = None     # 合同号
    purchase_date: Optional[date] = None      # 采购日期
    warranty_expire: Optional[date] = None    # 保修到期
    remark: Optional[str] = None              # 备注
    cpu_model: Optional[str] = None
    cpu_cores: Optional[int] = None
    memory_gb: Optional[int] = None
    disk_info: Optional[str] = None

# 创建服务器模型
class ServerCreate(ServerBase):
    pass

# 更新服务器模型
class ServerUpdate(BaseModel):
    serial_number: Optional[str] = None
    hostname: Optional[str] = None
    ip_address: Optional[str] = None
    mac_address: Optional[str] = None
    brand: Optional[str] = None
    model: Optional[str] = None
    bmc_ip: Optional[str] = None
    bmc_username: Optional[str] = None
    bmc_password: Optional[str] = None
    user_person: Optional[str] = None
    system_username: Optional[str] = None
    system_password: Optional[str] = None
    u_position: Optional[str] = None
    u_height: Optional[int] = None
    status: Optional[str] = None
    location: Optional[str] = None
    department: Optional[str] = None
    contract_number: Optional[str] = None
    purchase_date: Optional[date] = None
    warranty_expire: Optional[date] = None
    remark: Optional[str] = None
    cpu_model: Optional[str] = None
    cpu_cores: Optional[int] = None
    memory_gb: Optional[int] = None
    disk_info: Optional[str] = None

# 数据库服务器模型
class ServerInDBBase(ServerBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        orm_mode = True

# 服务器响应模型
class Server(ServerInDBBase):
    pass
