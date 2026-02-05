from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

# 资产历史记录基础模型
class AssetHistoryBase(BaseModel):
    date: Optional[datetime] = None
    action: str
    operator: str
    remark: Optional[str] = None

# 创建资产历史记录模型
class AssetHistoryCreate(AssetHistoryBase):
    pass

# 资产历史记录数据库模型
class AssetHistoryInDBBase(AssetHistoryBase):
    id: int
    asset_id: int
    created_at: datetime

    class Config:
        orm_mode = True

# 资产历史记录响应模型
class AssetHistory(AssetHistoryInDBBase):
    pass

# 资产基础模型（与项目介绍 5.1 assets 表一致）
class AssetBase(BaseModel):
    sn: str
    model: str
    asset_code: Optional[str] = None
    brand: Optional[str] = None
    bmc_ip: Optional[str] = None
    user: Optional[str] = None
    system_ip: Optional[str] = None
    system_username: Optional[str] = None
    system_password: Optional[str] = None
    u_position: Optional[str] = None
    u_height: Optional[int] = 1
    purchase_date: Optional[datetime] = None
    warranty_expiry: Optional[datetime] = None
    status: Optional[str] = "in_storage"
    location: Optional[str] = None
    department: Optional[str] = None
    contract_number: Optional[str] = None
    purchased_with_server_sn: Optional[str] = None
    remark: Optional[str] = None
    cpu_model: Optional[str] = None
    cpu_cores: Optional[int] = None
    memory_gb: Optional[int] = None
    disk_info: Optional[str] = None
    part_type: Optional[str] = None
    capacity: Optional[str] = None
    capacity_unit: Optional[str] = None
    frequency: Optional[str] = None
    frequency_unit: Optional[str] = None
    interface_type: Optional[str] = None
    spec: Optional[str] = None

# 创建资产模型
class AssetCreate(AssetBase):
    pass

# 更新资产模型
class AssetUpdate(BaseModel):
    sn: Optional[str] = None
    model: Optional[str] = None
    asset_code: Optional[str] = None
    brand: Optional[str] = None
    bmc_ip: Optional[str] = None
    user: Optional[str] = None
    system_ip: Optional[str] = None
    system_username: Optional[str] = None
    system_password: Optional[str] = None
    u_position: Optional[str] = None
    u_height: Optional[int] = None
    purchase_date: Optional[datetime] = None
    warranty_expiry: Optional[datetime] = None
    status: Optional[str] = None
    location: Optional[str] = None
    department: Optional[str] = None
    contract_number: Optional[str] = None
    purchased_with_server_sn: Optional[str] = None
    remark: Optional[str] = None
    cpu_model: Optional[str] = None
    cpu_cores: Optional[int] = None
    memory_gb: Optional[int] = None
    disk_info: Optional[str] = None
    part_type: Optional[str] = None
    capacity: Optional[str] = None
    capacity_unit: Optional[str] = None
    frequency: Optional[str] = None
    frequency_unit: Optional[str] = None
    interface_type: Optional[str] = None
    spec: Optional[str] = None

# 资产数据库模型
class AssetInDBBase(AssetBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    deleted_at: Optional[datetime] = None

    class Config:
        orm_mode = True

# 资产响应模型
class Asset(AssetInDBBase):
    history: List[AssetHistory] = []

    class Config:
        orm_mode = True