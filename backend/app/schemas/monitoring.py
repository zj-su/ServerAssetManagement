from pydantic import BaseModel
from typing import Optional
from datetime import datetime

# 监控数据基础模型
class MonitoringDataBase(BaseModel):
    server_id: int
    cpu_usage: Optional[float] = None
    memory_usage: Optional[float] = None
    disk_usage: Optional[str] = None
    network_usage: Optional[str] = None

# 创建监控数据模型
class MonitoringDataCreate(MonitoringDataBase):
    pass

# 更新监控数据模型
class MonitoringDataUpdate(MonitoringDataBase):
    pass

# 数据库监控数据模型
class MonitoringDataInDBBase(MonitoringDataBase):
    id: int
    timestamp: datetime

    class Config:
        orm_mode = True

# 监控数据响应模型
class MonitoringData(MonitoringDataInDBBase):
    pass