from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.models.deployment import DeploymentTask as DeploymentTaskModel
from app.schemas.deployment import DeploymentTask, DeploymentTaskCreate, DeploymentTaskUpdate
from app.utils.security import get_current_user, require_admin

router = APIRouter(prefix="/deployments", tags=["deployments"])

@router.get("/", response_model=List[DeploymentTask])
def read_deployment_tasks(
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    tasks = db.query(DeploymentTaskModel).offset(skip).limit(limit).all()
    return tasks

@router.post("/", response_model=DeploymentTask)
def create_deployment_task(
    task: DeploymentTaskCreate, 
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    db_task = DeploymentTaskModel(**task.dict())
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task

@router.get("/{task_id}", response_model=DeploymentTask)
def read_deployment_task(
    task_id: int, 
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    db_task = db.query(DeploymentTaskModel).filter(DeploymentTaskModel.id == task_id).first()
    if db_task is None:
        raise HTTPException(status_code=404, detail="部署任务未找到")
    return db_task

@router.put("/{task_id}", response_model=DeploymentTask)
def update_deployment_task(
    task_id: int, 
    task_update: DeploymentTaskUpdate, 
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    db_task = db.query(DeploymentTaskModel).filter(DeploymentTaskModel.id == task_id).first()
    if db_task is None:
        raise HTTPException(status_code=404, detail="部署任务未找到")
    
    for key, value in task_update.dict(exclude_unset=True).items():
        setattr(db_task, key, value)
    
    db.commit()
    db.refresh(db_task)
    return db_task

@router.delete("/{task_id}")
def delete_deployment_task(
    task_id: int, 
    db: Session = Depends(get_db),
    current_user = Depends(require_admin)
):
    db_task = db.query(DeploymentTaskModel).filter(DeploymentTaskModel.id == task_id).first()
    if db_task is None:
        raise HTTPException(status_code=404, detail="部署任务未找到")
    
    db.delete(db_task)
    db.commit()
    return {"message": "部署任务已删除"}