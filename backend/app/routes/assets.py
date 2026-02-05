from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional, Dict
from app.core.database import get_db
from app.models.asset import Asset as AssetModel, AssetHistory as AssetHistoryModel
from app.schemas.asset import Asset, AssetCreate, AssetUpdate, AssetHistory
from app.utils.security import get_current_username, get_current_user, require_admin
from app.models.user import User as UserModel
from datetime import datetime, timedelta
import pytz
import io
import json
import pandas as pd
from urllib.parse import quote
from openpyxl import Workbook
from openpyxl.styles import Font, Alignment, PatternFill
from openpyxl.utils import get_column_letter

router = APIRouter(prefix="/assets", tags=["assets"])

# 配件资产编码前缀映射（根据配件类型）
ASSET_CODE_PREFIX_MAP = {
    '内存': 'SY-MEM-',
    '硬盘': 'SY-HDD-',
    'CPU': 'SY-CPU-',
    '网卡': 'SY-NIC-',
    'RAID卡': 'SY-RAID-',
    '其他': 'SY-OTH-',
}
ASSET_CODE_DEFAULT_PREFIX = "SY-PT-"
ASSET_CODE_DIGITS = 4


def _next_asset_code(db: Session, part_type: str = None) -> str:
    """根据配件类型生成下一个资产编码，如 SY-MEM-0001, SY-HDD-0001 等"""
    import re
    prefix = ASSET_CODE_PREFIX_MAP.get(part_type, ASSET_CODE_DEFAULT_PREFIX)
    
    # 查询该前缀下已有的最大编号
    assets = db.query(AssetModel).filter(
        AssetModel.asset_code.isnot(None),
        AssetModel.asset_code != "",
        AssetModel.asset_code.like(f"{prefix}%")
    ).all()
    
    numbers = []
    # 提取编号部分
    pattern = re.compile(rf"^{re.escape(prefix)}(\d+)$", re.IGNORECASE)
    for a in assets:
        if a.asset_code:
            m = pattern.match(a.asset_code)
            if m:
                numbers.append(int(m.group(1)))
    
    next_num = (max(numbers) + 1) if numbers else 1
    return f"{prefix}{next_num:0{ASSET_CODE_DIGITS}d}"


# 定义字段名中英文映射
FIELD_NAME_MAPPING = {
    "sn": "序列号(SN)",
    "model": "型号",
    "brand": "品牌",
    "bmc_ip": "BMC IP",
    "user": "使用人",
    "system_ip": "系统IP",
    "system_username": "系统账号",
    "system_password": "系统密码",
    "u_position": "U位",
    "u_height": "U高度",
    "purchase_date": "采购日期",
    "warranty_expiry": "保修到期",
    "status": "状态",
    "location": "位置",
    "department": "部门",
    "contract_number": "合同号",
    "purchased_with_server_sn": "关联服务器SN",
    "remark": "备注",
    "part_type": "配件类型",
    "capacity": "容量",
    "capacity_unit": "容量单位",
    "frequency": "频率",
    "frequency_unit": "频率单位",
    "interface_type": "接口类型",
    "spec": "规格",
}

# 定义状态值中英文映射
STATUS_VALUE_MAPPING = {
    "in_storage": "在库",
    "in_use": "使用中",
    "maintenance": "维修中",
    "pending_scrap": "待报废",
    "scrapped": "已报废",
    "deleted": "已删除",
    "idle": "空闲"
}

@router.get("/", response_model=List[Asset])
def get_assets(
    skip: int = 0, 
    limit: int = 100, 
    status_filter: str = "in_storage,in_use,maintenance,idle", 
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """获取资产列表，支持按状态过滤（需要登录）"""
    statuses = status_filter.split(",")
    assets = db.query(AssetModel).filter(AssetModel.status.in_(statuses)).filter(AssetModel.deleted_at.is_(None)).offset(skip).limit(limit).all()
    return assets

@router.get("/search", response_model=List[Asset])
def search_assets(
    query: str, 
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """全局搜索资产，支持按SN、使用人、BMC IP、系统IP搜索（需要登录）"""
    assets = db.query(AssetModel).filter(
        (AssetModel.sn.contains(query)) |
        (AssetModel.user.contains(query)) |
        (AssetModel.bmc_ip.contains(query)) |
        (AssetModel.system_ip.contains(query))
    ).offset(skip).limit(limit).all()
    return assets

@router.get("/pending-scrap", response_model=List[Asset])
def get_pending_scrap_assets(
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """获取待报废资产列表（需要登录）"""
    assets = db.query(AssetModel).filter(AssetModel.status == "pending_scrap").filter(AssetModel.deleted_at.is_(None)).offset(skip).limit(limit).all()
    return assets

@router.get("/scrapped", response_model=List[Asset])
def get_scrapped_assets(
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """获取已报废资产列表（需要登录）"""
    assets = db.query(AssetModel).filter(AssetModel.status == "scrapped").offset(skip).limit(limit).all()
    return assets

@router.get("/deleted", response_model=List[Asset])
def get_deleted_assets(
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """获取已删除资产列表（回收站，需要登录）"""
    assets = db.query(AssetModel).filter(AssetModel.status == "deleted").filter(AssetModel.deleted_at.isnot(None)).offset(skip).limit(limit).all()
    return assets

@router.get("/{asset_id}", response_model=Asset)
def get_asset(
    asset_id: int, 
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """获取特定资产详情（需要登录）"""
    asset = db.query(AssetModel).filter(AssetModel.id == asset_id).first()
    if asset is None:
        raise HTTPException(status_code=404, detail="资产未找到")
    return asset

@router.post("/", response_model=Asset)
def create_asset(
    asset: AssetCreate, 
    db: Session = Depends(get_db),
    current_username: str = Depends(get_current_username)
):
    """创建新资产（需要登录）"""
    # 检查SN是否已存在
    db_asset = db.query(AssetModel).filter(AssetModel.sn == asset.sn).first()
    if db_asset:
        raise HTTPException(status_code=400, detail="资产序列号已存在")
    
    # 创建资产，默认状态为in_storage（在库）；资产编码根据配件类型自动生成
    asset_dict = asset.dict(exclude_unset=True)
    asset_dict["status"] = "in_storage"
    part_type = asset_dict.get("part_type", None)
    generated_code = _next_asset_code(db, part_type)
    asset_dict["asset_code"] = generated_code
    db_asset = AssetModel(**asset_dict)
    db.add(db_asset)
    db.commit()
    db.refresh(db_asset)
    
    # 添加创建记录到历史
    # 确保使用正确时区
    now = datetime.now(pytz.timezone('Asia/Shanghai'))
    history_record = AssetHistoryModel(
        asset_id=db_asset.id,
        date=now,
        action="创建资产",
        operator=current_username,
        remark="资产信息录入"
    )
    db.add(history_record)
    db.commit()
    db.refresh(db_asset)
    if not getattr(db_asset, "asset_code", None) or str(db_asset.asset_code or "").strip() == "":
        db_asset.asset_code = generated_code
    return db_asset

@router.put("/{asset_id}", response_model=Asset)
def update_asset(
    asset_id: int, 
    asset_update: AssetUpdate, 
    db: Session = Depends(get_db),
    current_username: str = Depends(get_current_username)
):
    """更新资产信息（需要登录）"""
    db_asset = db.query(AssetModel).filter(AssetModel.id == asset_id).first()
    if db_asset is None:
        raise HTTPException(status_code=404, detail="资产未找到")
    
    # 记录变更历史
    changes = []
    update_data = asset_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        old_value = getattr(db_asset, key, None)
        if old_value != value:
            # 使用中文字段名显示
            field_name = FIELD_NAME_MAPPING.get(key, key)
            
            # 特殊处理状态字段的值显示
            if key == "status":
                old_display = STATUS_VALUE_MAPPING.get(old_value, old_value)
                new_display = STATUS_VALUE_MAPPING.get(value, value)
                changes.append(f"{field_name}: {old_display} -> {new_display}")
            else:
                changes.append(f"{field_name}: {old_value} -> {value}")
    
    # 更新资产属性
    for key, value in update_data.items():
        setattr(db_asset, key, value)
    
    db.commit()
    db.refresh(db_asset)
    
    # 如果有变更，添加历史记录
    if changes:
        # 确保使用正确时区
        now = datetime.now(pytz.timezone('Asia/Shanghai'))
        history_record = AssetHistoryModel(
            asset_id=asset_id,
            date=now,
            action="更新资产",
            operator=current_username,
            remark="; ".join(changes)
        )
        db.add(history_record)
        db.commit()
    
    return db_asset

@router.put("/{asset_id}/scrap", response_model=Asset)
def scrap_asset(
    asset_id: int, 
    db: Session = Depends(get_db),
    current_username: str = Depends(get_current_username)
):
    """将资产标记为待报废（需要登录）"""
    db_asset = db.query(AssetModel).filter(AssetModel.id == asset_id).first()
    if db_asset is None:
        raise HTTPException(status_code=404, detail="资产未找到")
    
    # 更新资产状态为待报废
    old_status = db_asset.status
    db_asset.status = "pending_scrap"
    
    db.commit()
    db.refresh(db_asset)
    
    # 添加历史记录
    now = datetime.now(pytz.timezone('Asia/Shanghai'))
    history_record = AssetHistoryModel(
        asset_id=asset_id,
        date=now,
        action="申请报废",
        operator=current_username,
        remark=f"资产状态从 {STATUS_VALUE_MAPPING.get(old_status, old_status)} 变更为 待报废"
    )
    db.add(history_record)
    db.commit()
    
    return db_asset

@router.put("/{asset_id}/confirm-scrap", response_model=Asset)
def confirm_scrap_asset(
    asset_id: int, 
    db: Session = Depends(get_db),
    current_username: str = Depends(get_current_username)
):
    """确认报废资产（需要登录）"""
    db_asset = db.query(AssetModel).filter(AssetModel.id == asset_id).first()
    if db_asset is None:
        raise HTTPException(status_code=404, detail="资产未找到")
    
    if db_asset.status != "pending_scrap":
        raise HTTPException(status_code=400, detail="只有待报废的资产才能确认报废")
    
    # 更新资产状态为已报废
    old_status = db_asset.status
    db_asset.status = "scrapped"
    
    db.commit()
    db.refresh(db_asset)
    
    # 添加历史记录
    now = datetime.now(pytz.timezone('Asia/Shanghai'))
    history_record = AssetHistoryModel(
        asset_id=asset_id,
        date=now,
        action="确认报废",
        operator=current_username,
        remark=f"资产状态从 {STATUS_VALUE_MAPPING.get(old_status, old_status)} 变更为 已报废"
    )
    db.add(history_record)
    db.commit()
    
    return db_asset

@router.put("/{asset_id}/delete", response_model=Asset)
def delete_asset(
    asset_id: int, 
    db: Session = Depends(get_db),
    current_username: str = Depends(get_current_username)
):
    """将资产移至回收站（软删除，需要登录）"""
    db_asset = db.query(AssetModel).filter(AssetModel.id == asset_id).first()
    if db_asset is None:
        raise HTTPException(status_code=404, detail="资产未找到")
    
    # 更新资产状态为已删除，并记录删除时间
    old_status = db_asset.status
    db_asset.status = "deleted"
    db_asset.deleted_at = datetime.now(pytz.timezone('Asia/Shanghai'))
    
    db.commit()
    db.refresh(db_asset)
    
    # 添加历史记录
    now = datetime.now(pytz.timezone('Asia/Shanghai'))
    history_record = AssetHistoryModel(
        asset_id=asset_id,
        date=now,
        action="删除资产",
        operator=current_username,
        remark=f"资产状态从 {STATUS_VALUE_MAPPING.get(old_status, old_status)} 变更为 已删除"
    )
    db.add(history_record)
    db.commit()
    
    return db_asset

@router.put("/{asset_id}/restore", response_model=Asset)
def restore_asset(
    asset_id: int, 
    db: Session = Depends(get_db),
    current_username: str = Depends(get_current_username)
):
    """从回收站恢复资产（需要登录）"""
    db_asset = db.query(AssetModel).filter(AssetModel.id == asset_id).first()
    if db_asset is None:
        raise HTTPException(status_code=404, detail="资产未找到")
    
    if db_asset.status != "deleted":
        raise HTTPException(status_code=400, detail="只有已删除的资产才能恢复")
    
    # 恢复资产状态为在库
    db_asset.status = "in_storage"
    db_asset.deleted_at = None
    
    db.commit()
    db.refresh(db_asset)
    
    # 添加历史记录
    now = datetime.now(pytz.timezone('Asia/Shanghai'))
    history_record = AssetHistoryModel(
        asset_id=asset_id,
        date=now,
        action="恢复资产",
        operator=current_username,
        remark="资产从回收站恢复"
    )
    db.add(history_record)
    db.commit()
    
    return db_asset

@router.delete("/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
def permanently_delete_asset(
    asset_id: int, 
    db: Session = Depends(get_db),
    current_user = Depends(require_admin)
):
    """永久删除资产（需要管理员权限）"""
    db_asset = db.query(AssetModel).filter(AssetModel.id == asset_id).first()
    if db_asset is None:
        raise HTTPException(status_code=404, detail="资产未找到")
    
    # 先删除与该资产相关的历史记录
    db.query(AssetHistoryModel).filter(AssetHistoryModel.asset_id == asset_id).delete()
    db.commit()
    
    # 然后删除资产本身
    db.delete(db_asset)
    db.commit()
    return None

@router.post("/{asset_id}/history", response_model=AssetHistory)
def add_asset_history(
    asset_id: int, 
    history: AssetHistory, 
    db: Session = Depends(get_db),
    current_username: str = Depends(get_current_username)
):
    """为资产添加历史记录（需要登录）"""
    # 检查资产是否存在
    db_asset = db.query(AssetModel).filter(AssetModel.id == asset_id).first()
    if db_asset is None:
        raise HTTPException(status_code=404, detail="资产未找到")
    
    # 添加历史记录
    db_history = AssetHistoryModel(**history.dict(), asset_id=asset_id)
    db.add(db_history)
    db.commit()
    db.refresh(db_history)
    return db_history


@router.get("/{asset_id}/history", response_model=List[AssetHistory])
def get_asset_history(
    asset_id: int, 
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """获取资产历史记录（需要登录）"""
    # 检查资产是否存在
    db_asset = db.query(AssetModel).filter(AssetModel.id == asset_id).first()
    if db_asset is None:
        raise HTTPException(status_code=404, detail="资产未找到")
    
    # 获取历史记录
    history_records = db.query(AssetHistoryModel).filter(AssetHistoryModel.asset_id == asset_id).all()
    return history_records