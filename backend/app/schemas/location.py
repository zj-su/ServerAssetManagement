from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class LocationBase(BaseModel):
    name: str
    address: Optional[str] = None
    description: Optional[str] = None


class LocationCreate(LocationBase):
    pass


class LocationUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    description: Optional[str] = None


class Location(LocationBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        orm_mode = True
