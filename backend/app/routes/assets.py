from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, false
from typing import List, Optional, Dict
from app.core.database import get_db
from app.models.asset import Asset as AssetModel, AssetHistory as AssetHistoryModel
from app.schemas.asset import Asset, AssetCreate, AssetUpdate, AssetHistory
from app.utils.security import get_current_user, require_admin, require_permission
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


def _is_admin_user(current_user) -> bool:
    return getattr(current_user, "role", "") == "admin"


def _owner_identities(current_user) -> List[str]:
    values = [
        getattr(current_user, "username", None),
        getattr(current_user, "display_name", None),
    ]
    seen = set()
    result = []
    for v in values:
        if not isinstance(v, str):
            continue
        s = v.strip().lower()
        if not s or s in seen:
            continue
        seen.add(s)
        result.append(s)
    return result


def _apply_asset_owner_scope(query, current_user):
    # 仅普通用户限制为“使用人=自己”，管理员维持全量可见
    if _is_admin_user(current_user):
        return query
    owners = _owner_identities(current_user)
    if not owners:
        return query.filter(false())
    owner_expr = func.lower(func.trim(func.coalesce(AssetModel.user, "")))
    return query.filter(owner_expr.in_(owners))


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
    current_user = Depends(require_permission("part:read"))
):
    """获取资产列表，支持按状态过滤（需要登录）"""
    statuses = status_filter.split(",")
    q = db.query(AssetModel).filter(AssetModel.status.in_(statuses)).filter(AssetModel.deleted_at.is_(None))
    q = _apply_asset_owner_scope(q, current_user)
    assets = q.offset(skip).limit(limit).all()
    return assets

@router.get("/search", response_model=List[Asset])
def search_assets(
    query: str, 
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(get_db),
    current_user = Depends(require_permission("part:read"))
):
    """全局搜索资产，支持按SN、使用人、BMC IP、系统IP搜索（需要登录）"""
    q = db.query(AssetModel).filter(
        (AssetModel.sn.contains(query)) |
        (AssetModel.user.contains(query)) |
        (AssetModel.bmc_ip.contains(query)) |
        (AssetModel.system_ip.contains(query))
    )
    q = _apply_asset_owner_scope(q, current_user)
    assets = q.offset(skip).limit(limit).all()
    return assets

@router.get("/pending-scrap", response_model=List[Asset])
def get_pending_scrap_assets(
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(get_db),
    current_user = Depends(require_permission("scrap:read"))
):
    """获取待报废资产列表（需要登录）"""
    q = db.query(AssetModel).filter(AssetModel.status == "pending_scrap").filter(AssetModel.deleted_at.is_(None))
    q = _apply_asset_owner_scope(q, current_user)
    assets = q.offset(skip).limit(limit).all()
    return assets

@router.get("/scrapped", response_model=List[Asset])
def get_scrapped_assets(
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(get_db),
    current_user = Depends(require_permission("scrap:read"))
):
    """获取已报废资产列表（需要登录）"""
    q = db.query(AssetModel).filter(AssetModel.status == "scrapped")
    q = _apply_asset_owner_scope(q, current_user)
    assets = q.offset(skip).limit(limit).all()
    return assets

@router.get("/deleted", response_model=List[Asset])
def get_deleted_assets(
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(get_db),
    current_user = Depends(require_permission("scrap:read"))
):
    """获取已删除资产列表（回收站，需要登录）"""
    q = db.query(AssetModel).filter(AssetModel.status == "deleted").filter(AssetModel.deleted_at.isnot(None))
    q = _apply_asset_owner_scope(q, current_user)
    assets = q.offset(skip).limit(limit).all()
    return assets

@router.get("/{asset_id}", response_model=Asset)
def get_asset(
    asset_id: int, 
    db: Session = Depends(get_db),
    current_user = Depends(require_permission("part:read"))
):
    """获取特定资产详情（需要登录）"""
    q = db.query(AssetModel).filter(AssetModel.id == asset_id)
    q = _apply_asset_owner_scope(q, current_user)
    asset = q.first()
    if asset is None:
        raise HTTPException(status_code=404, detail="资产未找到")
    return asset

@router.post("/", response_model=Asset)
def create_asset(
    asset: AssetCreate, 
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_permission("part:write"))
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
        operator=current_user.username,
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
    current_user: UserModel = Depends(require_permission("part:write"))
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
            operator=current_user.username,
            remark="; ".join(changes)
        )
        db.add(history_record)
        db.commit()
    
    return db_asset

@router.put("/{asset_id}/scrap", response_model=Asset)
def scrap_asset(
    asset_id: int, 
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_permission("scrap:write"))
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
        operator=current_user.username,
        remark=f"资产状态从 {STATUS_VALUE_MAPPING.get(old_status, old_status)} 变更为 待报废"
    )
    db.add(history_record)
    db.commit()
    
    return db_asset

@router.put("/{asset_id}/confirm-scrap", response_model=Asset)
def confirm_scrap_asset(
    asset_id: int, 
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_permission("scrap:write"))
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
        operator=current_user.username,
        remark=f"资产状态从 {STATUS_VALUE_MAPPING.get(old_status, old_status)} 变更为 已报废"
    )
    db.add(history_record)
    db.commit()
    
    return db_asset

@router.put("/{asset_id}/delete", response_model=Asset)
def delete_asset(
    asset_id: int, 
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_permission("part:delete"))
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
        operator=current_user.username,
        remark=f"资产状态从 {STATUS_VALUE_MAPPING.get(old_status, old_status)} 变更为 已删除"
    )
    db.add(history_record)
    db.commit()
    
    return db_asset

@router.put("/{asset_id}/restore", response_model=Asset)
def restore_asset(
    asset_id: int, 
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_permission("part:delete"))
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
        operator=current_user.username,
        remark="资产从回收站恢复"
    )
    db.add(history_record)
    db.commit()
    
    return db_asset

@router.delete("/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
def permanently_delete_asset(
    asset_id: int, 
    db: Session = Depends(get_db),
    current_user = Depends(require_permission("part:delete"))
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
    current_user: UserModel = Depends(require_permission("part:write"))
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
    current_user = Depends(require_permission("part:read"))
):
    """获取资产历史记录（需要登录）"""
    # 检查资产是否存在
    q = db.query(AssetModel).filter(AssetModel.id == asset_id)
    q = _apply_asset_owner_scope(q, current_user)
    db_asset = q.first()
    if db_asset is None:
        raise HTTPException(status_code=404, detail="资产未找到")
    
    # 获取历史记录
    history_records = db.query(AssetHistoryModel).filter(AssetHistoryModel.asset_id == asset_id).all()
    return history_records


@router.get("/by-server-sn/{server_sn}", response_model=List[Asset])
def get_assets_by_server_sn(
    server_sn: str,
    db: Session = Depends(get_db),
    current_user = Depends(require_permission("part:read"))
):
    """根据服务器SN获取关联的配件列表"""
    q = db.query(AssetModel).filter(
        AssetModel.purchased_with_server_sn == server_sn
    )
    q = _apply_asset_owner_scope(q, current_user)
    assets = q.all()
    return assets


# ======================== 批量导入配件 ========================
from openpyxl import load_workbook

# 配件导入表头映射（与配件导入模板一致）
IMPORT_HEADERS = {
    "序列号(SN)": "sn",
    "型号": "model",
    "品牌": "brand",
    "配件类型": "part_type",
    "容量": "capacity",
    "容量单位": "capacity_unit",
    "频率": "frequency",
    "频率单位": "frequency_unit",
    "CPU核心数": "cpu_cores",
    "接口类型": "interface_type",
    "规格": "spec",
    "使用人": "user",
    "关联服务器SN": "purchased_with_server_sn",
    "状态": "status",
    "位置": "location",
    "部门": "department",
    "合同号": "contract_number",
    "采购日期": "purchase_date",
    "保修到期": "warranty_expiry",
    "备注": "remark",
}

# 状态映射
STATUS_IMPORT_MAPPING = {
    "在库": "in_storage",
    "使用中": "in_use",
    "维修中": "maintenance",
    "空闲": "idle",
    "待报废": "pending_scrap",
}

# 独立的导入路由，挂到 /api/v1/import-assets，避免被 /assets/{asset_id} 抢匹配
import_router = APIRouter(tags=["assets"])


@import_router.post("/import-assets/")
def import_assets_excel(
    file: UploadFile = File(..., description="配件导入模板 Excel"),
    receipt_id: int = Query(None, description="关联的入库单ID"),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_permission("part:write"))
):
    """
    批量导入配件：按配件导入模板表头解析，
    导入后记录出现在「配件资产」列表中。
    如果提供了 receipt_id，则将导入的配件关联到该入库单。
    """
    if not file.filename or not file.filename.lower().endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="请上传 .xlsx 或 .xls 格式的 Excel 文件")
    
    try:
        content = file.file.read()
        wb = load_workbook(io.BytesIO(content), read_only=True, data_only=True)
        ws = wb.active
        if ws is None:
            raise HTTPException(status_code=400, detail="Excel 无有效工作表")
        
        rows = list(ws.iter_rows(values_only=True))
        if len(rows) < 2:
            raise HTTPException(status_code=400, detail="Excel 无数据行（至少需要说明行+表头行）")
        
        # 第一行是说明，第二行是表头，从第三行开始是数据
        header_row = [str(c).strip() if c is not None else "" for c in rows[1]]
        col_map = {}
        for idx, h in enumerate(header_row):
            if h in IMPORT_HEADERS:
                col_map[IMPORT_HEADERS[h]] = idx
        
        if "sn" not in col_map:
            raise HTTPException(
                status_code=400,
                detail=f"缺少必填列【序列号(SN)】，请使用模板。当前表头：{header_row}"
            )
        
        created = 0
        skipped = []
        errors = []
        
        for row_idx, row in enumerate(rows[2:], start=3):
            if not row or all(c is None or str(c).strip() == "" for c in row):
                continue
            
            vals = [row[i] if i < len(row) else None for i in range(max(col_map.values()) + 1)]
            
            def get(f: str):
                if f not in col_map:
                    return None
                v = vals[col_map[f]]
                if v is None:
                    return None
                if f == "cpu_cores":
                    try:
                        return int(float(v))
                    except (TypeError, ValueError):
                        return None
                if f in ("purchase_date", "warranty_expiry") and v:
                    try:
                        if hasattr(v, "date"):
                            return v.date() if hasattr(v, "date") else v
                        return datetime.strptime(str(v).strip()[:10], "%Y-%m-%d").date() if str(v).strip() else None
                    except Exception:
                        return None
                s = str(v).strip() if v else None
                return s if s else None
            
            sn = get("sn")
            if not sn:
                errors.append({"row": row_idx, "reason": "序列号(SN)不能为空"})
                continue
            
            # 检查SN是否已存在
            if db.query(AssetModel).filter(AssetModel.sn == sn).first():
                skipped.append({"row": row_idx, "sn": sn, "reason": "序列号已存在"})
                continue
            
            try:
                part_type = get("part_type")
                status_raw = get("status")
                status = STATUS_IMPORT_MAPPING.get(status_raw, "in_storage") if status_raw else "in_storage"
                
                asset_data = {
                    "asset_code": _next_asset_code(db, part_type),
                    "sn": sn,
                    "model": get("model") or "-",  # 型号为空时设置默认值
                    "brand": get("brand"),
                    "part_type": part_type,
                    "capacity": get("capacity"),
                    "capacity_unit": get("capacity_unit"),
                    "frequency": get("frequency"),
                    "frequency_unit": get("frequency_unit"),
                    "cpu_cores": get("cpu_cores"),
                    "interface_type": get("interface_type"),
                    "spec": get("spec"),
                    "user": get("user"),
                    "purchased_with_server_sn": get("purchased_with_server_sn"),
                    "status": status,
                    "location": get("location"),
                    "department": get("department"),
                    "contract_number": get("contract_number"),
                    "purchase_date": get("purchase_date"),
                    "warranty_expiry": get("warranty_expiry"),
                    "remark": get("remark"),
                }
                
                # 如果提供了入库单ID，关联到配件
                if receipt_id:
                    asset_data["receipt_id"] = receipt_id
                
                # 过滤掉None值
                asset_data = {k: v for k, v in asset_data.items() if v is not None}
                if "status" not in asset_data:
                    asset_data["status"] = "in_storage"
                
                db_asset = AssetModel(**asset_data)
                db.add(db_asset)
                db.commit()
                db.refresh(db_asset)
                
                # 添加创建记录到历史
                now = datetime.now(pytz.timezone('Asia/Shanghai'))
                history_record = AssetHistoryModel(
                    asset_id=db_asset.id,
                    date=now,
                    action="批量导入",
                    operator=current_user.username,
                    remark="通过Excel批量导入"
                )
                db.add(history_record)
                db.commit()
                
                created += 1
            except Exception as e:
                db.rollback()
                errors.append({"row": row_idx, "reason": str(e)})
        
        wb.close()
        
        # 如果关联了入库单，更新入库单的资产数量
        if receipt_id and created > 0:
            from app.models.receipt import Receipt as ReceiptModel
            receipt = db.query(ReceiptModel).filter(ReceiptModel.id == receipt_id).first()
            if receipt:
                # 重新计算关联到该入库单的配件数量
                new_count = db.query(AssetModel).filter(
                    AssetModel.receipt_id == receipt_id,
                    AssetModel.deleted_at.is_(None)
                ).count()
                receipt.asset_count = new_count
                db.commit()
        
        return {
            "message": "批量导入完成",
            "created": created,
            "skipped": len(skipped),
            "skipped_details": skipped[:20],
            "errors": errors[:20]
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"导入失败: {str(e)}")


@import_router.get("/assets-template/")
def download_assets_template():
    """下载配件导入模板"""
    wb = Workbook()
    ws = wb.active
    ws.title = "配件导入模板"
    
    # 第一行：说明（红色字体）
    notice_text = "【说明】1.序列号(SN)必填，不可重复；2.配件类型可选：内存、硬盘、CPU、网卡、RAID卡、其他；3.状态可选：在库、使用中、空闲、待报废（默认为在库）；4.日期格式：YYYY-MM-DD；5.请删除示例数据后再导入"
    notice_cell = ws.cell(row=1, column=1, value=notice_text)
    notice_cell.font = Font(bold=True, color="FF0000")
    ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=20)
    
    # 定义表头 - 第二行
    headers = [
        "序列号(SN)", "配件类型", "品牌", "型号", "容量", "容量单位",
        "频率", "频率单位", "CPU核心数", "接口类型", "规格",
        "使用人", "关联服务器SN", "状态", "位置", "部门",
        "合同号", "采购日期", "保修到期", "备注"
    ]
    
    # 设置表头样式
    header_font = Font(bold=True, color="FFFFFF")
    header_fill = PatternFill(start_color="4472C4", end_color="4472C4", fill_type="solid")
    header_alignment = Alignment(horizontal="center", vertical="center")
    
    for col_idx, header in enumerate(headers, 1):
        cell = ws.cell(row=2, column=col_idx, value=header)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = header_alignment
        # 设置列宽
        ws.column_dimensions[get_column_letter(col_idx)].width = 15
    
    # 添加示例数据 - 从第三行开始
    example_data = [
        ["MEM-001", "内存", "三星", "", "32", "GB", "3200", "Mhz", "", "DDR4", "",
         "", "", "在库", "仓库", "IT部", "HT-2024-001", "2024-01-15", "2027-01-15", ""],
        ["HDD-001", "硬盘", "西数", "", "2", "TB", "", "", "", "SAS", "3.5英寸",
         "", "", "在库", "仓库", "IT部", "HT-2024-001", "2024-01-15", "2027-01-19", ""],
        ["NET-001", "网卡", "inter", "82599ES", "", "", "10", "G", "", "PCIE", "",
         "", "", "在库", "仓库", "IT部", "HT-2024-001", "2024-01-15", "2027-01-19", ""],
        ["RAID-001", "RAID卡", "LSI", "3008", "", "", "12", "G", "", "PCIE", "",
         "", "", "在库", "仓库", "IT部", "HT-2024-001", "2024-01-15", "2027-01-19", ""],
    ]
    
    for row_idx, row_data in enumerate(example_data, 3):
        for col_idx, value in enumerate(row_data, 1):
            ws.cell(row=row_idx, column=col_idx, value=value)
    
    # 保存到内存
    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    
    filename = quote("配件导入模板.xlsx")
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{filename}"}
    )