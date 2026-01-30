from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.models.monitoring import MonitoringData as MonitoringDataModel
from app.schemas.monitoring import MonitoringData, MonitoringDataCreate
from app.utils.security import get_current_user

router = APIRouter(prefix="/monitoring", tags=["monitoring"])

@router.get("/", response_model=List[MonitoringData])
def read_monitoring_data(
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    data = db.query(MonitoringDataModel).offset(skip).limit(limit).all()
    return data

@router.post("/", response_model=MonitoringData)
def create_monitoring_data(
    data: MonitoringDataCreate, 
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    db_data = MonitoringDataModel(**data.dict())
    db.add(db_data)
    db.commit()
    db.refresh(db_data)
    return db_data

@router.get("/{data_id}", response_model=MonitoringData)
def read_monitoring_data_point(
    data_id: int, 
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    db_data = db.query(MonitoringDataModel).filter(MonitoringDataModel.id == data_id).first()
    if db_data is None:
        raise HTTPException(status_code=404, detail="监控数据未找到")
    return db_data

@router.get("/server/{server_id}", response_model=List[MonitoringData])
def read_server_monitoring_data(
    server_id: int, 
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    data = db.query(MonitoringDataModel).filter(MonitoringDataModel.server_id == server_id).offset(skip).limit(limit).all()
    return data