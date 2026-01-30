from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.models.server import Server as ServerModel
from app.schemas.server import Server, ServerCreate, ServerUpdate
from app.utils.security import get_current_user, require_admin
import logging

router = APIRouter(prefix="/servers", tags=["servers"])
logger = logging.getLogger(__name__)

@router.get("/", response_model=List[Server])
def read_servers(
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    try:
        servers = db.query(ServerModel).offset(skip).limit(limit).all()
        return servers
    except Exception as e:
        logger.error(f"Error fetching servers: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/", response_model=Server)
def create_server(
    server: ServerCreate, 
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    try:
        db_server = ServerModel(**server.dict())
        db.add(db_server)
        db.commit()
        db.refresh(db_server)
        return db_server
    except Exception as e:
        logger.error(f"Error creating server: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/{server_id}", response_model=Server)
def read_server(
    server_id: int, 
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    try:
        db_server = db.query(ServerModel).filter(ServerModel.id == server_id).first()
        if db_server is None:
            raise HTTPException(status_code=404, detail="服务器未找到")
        return db_server
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching server {server_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.put("/{server_id}", response_model=Server)
def update_server(
    server_id: int, 
    server: ServerUpdate, 
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    try:
        db_server = db.query(ServerModel).filter(ServerModel.id == server_id).first()
        if db_server is None:
            raise HTTPException(status_code=404, detail="服务器未找到")
        
        for key, value in server.dict(exclude_unset=True).items():
            setattr(db_server, key, value)
        
        db.commit()
        db.refresh(db_server)
        return db_server
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating server {server_id}: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")

@router.delete("/{server_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_server(
    server_id: int, 
    db: Session = Depends(get_db),
    current_user = Depends(require_admin)
):
    try:
        db_server = db.query(ServerModel).filter(ServerModel.id == server_id).first()
        if db_server is None:
            raise HTTPException(status_code=404, detail="服务器未找到")
        
        db.delete(db_server)
        db.commit()
        return None
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting server {server_id}: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")

# 电源控制相关接口
@router.post("/{server_id}/power/on")
def power_on_server(
    server_id: int, 
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    try:
        db_server = db.query(ServerModel).filter(ServerModel.id == server_id).first()
        if db_server is None:
            raise HTTPException(status_code=404, detail="服务器未找到")
        
        # 这里应该调用实际的BMC/IPMI接口来开机
        # 示例代码，实际需要根据具体硬件实现
        # bmc_control.power_on(db_server.bmc_ip, db_server.bmc_username, db_server.bmc_password)
        
        # 更新服务器状态
        db_server.status = "online"
        db.commit()
        db.refresh(db_server)
        
        return {"message": f"服务器 {db_server.hostname} 已开机", "server": db_server}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error powering on server {server_id}: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/{server_id}/power/off")
def power_off_server(
    server_id: int, 
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    try:
        db_server = db.query(ServerModel).filter(ServerModel.id == server_id).first()
        if db_server is None:
            raise HTTPException(status_code=404, detail="服务器未找到")
        
        # 这里应该调用实际的BMC/IPMI接口来关机
        # 示例代码，实际需要根据具体硬件实现
        # bmc_control.power_off(db_server.bmc_ip, db_server.bmc_username, db_server.bmc_password)
        
        # 更新服务器状态
        db_server.status = "offline"
        db.commit()
        db.refresh(db_server)
        
        return {"message": f"服务器 {db_server.hostname} 已关机", "server": db_server}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error powering off server {server_id}: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/{server_id}/power/reboot")
def reboot_server(
    server_id: int, 
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    try:
        db_server = db.query(ServerModel).filter(ServerModel.id == server_id).first()
        if db_server is None:
            raise HTTPException(status_code=404, detail="服务器未找到")
        
        # 这里应该调用实际的BMC/IPMI接口来重启
        # 示例代码，实际需要根据具体硬件实现
        # bmc_control.reboot(db_server.bmc_ip, db_server.bmc_username, db_server.bmc_password)
        
        # 更新服务器状态
        db_server.status = "maintenance"
        db.commit()
        db.refresh(db_server)
        
        return {"message": f"服务器 {db_server.hostname} 正在重启", "server": db_server}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error rebooting server {server_id}: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")