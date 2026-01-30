from pydantic import BaseModel
from typing import Optional
from datetime import datetime

# 部署任务基础模型
class DeploymentTaskBase(BaseModel):
    server_id: int
    os_image: str
    status: Optional[str] = "pending"

# 创建部署任务模型
class DeploymentTaskCreate(DeploymentTaskBase):
    pass

# 更新部署任务模型
class DeploymentTaskUpdate(BaseModel):
    status: Optional[str] = None
    log: Optional[str] = None

# 数据库部署任务模型
class DeploymentTaskInDBBase(DeploymentTaskBase):
    id: int
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    log: Optional[str] = None

    class Config:
        orm_mode = True

# 部署任务响应模型
class DeploymentTask(DeploymentTaskInDBBase):
    pass