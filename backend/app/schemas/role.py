from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime


class RoleBase(BaseModel):
    name: str
    description: Optional[str] = None
    permissions: List[str] = []


class RoleCreate(RoleBase):
    pass


class RoleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    permissions: Optional[List[str]] = None


class Role(RoleBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        orm_mode = True
