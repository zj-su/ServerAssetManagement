from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, false
from typing import List, Optional
from app.core.database import get_db
from app.models.receipt import Receipt as ReceiptModel, ReceiptItem as ReceiptItemModel, ReceiptType, ReceiptStatus
from app.models.asset import Asset as AssetModel
from app.schemas.receipt import Receipt, ReceiptCreate, ReceiptDetail, ReceiptItem as ReceiptItemSchema
from app.utils.security import get_current_user, require_admin, require_permission
from datetime import datetime, timedelta
import pytz

# 使用带尾部斜杠的 prefix，避免 307 重定向导致前端请求丢失 Authorization 头
router = APIRouter(prefix="/receipts", tags=["receipts"])


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

def generate_receipt_number(receipt_type: ReceiptType, db: Session) -> str:
    """生成入库单号：RK-SERVER-20251216-000001 或 RK-PART-20251216-000001"""
    today = datetime.now(pytz.timezone('Asia/Shanghai')).strftime('%Y%m%d')
    prefix = f"RK-{receipt_type.value.upper()}-{today}-"
    
    # 查找今天该类型入库单的最大编号
    max_receipt = db.query(ReceiptModel).filter(
        ReceiptModel.receipt_number.like(f"{prefix}%")
    ).order_by(ReceiptModel.receipt_number.desc()).first()
    
    if max_receipt:
        # 提取编号部分
        try:
            last_num = int(max_receipt.receipt_number.split('-')[-1])
            new_num = last_num + 1
        except (ValueError, IndexError):
            new_num = 1
    else:
        new_num = 1
    
    return f"{prefix}{str(new_num).zfill(6)}"

@router.post("", response_model=Receipt)
def create_receipt(
    receipt: ReceiptCreate, 
    db: Session = Depends(get_db),
    current_user = Depends(require_permission("receipt:write"))
):
    """创建入库单"""
    receipt_number = generate_receipt_number(receipt.receipt_type, db)
    
    # 入库日期自动设置为当前时间
    now = datetime.now(pytz.timezone('Asia/Shanghai'))
    
    db_receipt = ReceiptModel(
        receipt_number=receipt_number,
        receipt_type=receipt.receipt_type,
        status=ReceiptStatus.DRAFT.value,
        operator=current_user.username,
        purchaser=receipt.purchaser,
        company=receipt.company,
        department=receipt.department,
        receipt_date=now,
        remark=receipt.remark,
        asset_count=0
    )
    db.add(db_receipt)
    db.commit()
    db.refresh(db_receipt)
    
    return db_receipt

@router.get("", response_model=List[Receipt])
def get_receipts(
    receipt_type: Optional[ReceiptType] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user = Depends(require_permission("receipt:read"))
):
    """获取入库单列表"""
    query = db.query(ReceiptModel)
    if receipt_type:
        query = query.filter(ReceiptModel.receipt_type == receipt_type)
    receipts = query.order_by(ReceiptModel.created_at.desc()).offset(skip).limit(limit).all()

    # 普通用户仅可见“自己名下资产”相关入库单；管理员可见全部
    if _is_admin_user(current_user):
        return receipts

    owners = _owner_identities(current_user)
    if not owners:
        return []

    from app.models.server import Server as ServerModel
    filtered = []
    for r in receipts:
        if r.receipt_type == ReceiptType.SERVER.value or r.receipt_type == "server":
            owner_expr = func.lower(func.trim(func.coalesce(ServerModel.user_person, "")))
            owned = db.query(ServerModel.id).filter(
                ServerModel.receipt_id == r.id,
                owner_expr.in_(owners),
            ).first() is not None
        else:
            owner_expr = func.lower(func.trim(func.coalesce(AssetModel.user, "")))
            # 兼容两种关联方式：receipt_items 与 assets.receipt_id
            owned_by_item = db.query(ReceiptItemModel.id).join(
                AssetModel, ReceiptItemModel.asset_id == AssetModel.id
            ).filter(
                ReceiptItemModel.receipt_id == r.id,
                owner_expr.in_(owners),
            ).first() is not None
            owned_by_direct = db.query(AssetModel.id).filter(
                AssetModel.receipt_id == r.id,
                owner_expr.in_(owners),
            ).first() is not None
            owned = owned_by_item or owned_by_direct
        if owned:
            filtered.append(r)
    return filtered

@router.get("/{receipt_id}", response_model=ReceiptDetail)
def get_receipt(
    receipt_id: int, 
    db: Session = Depends(get_db),
    current_user = Depends(require_permission("receipt:read"))
):
    """获取入库单详情"""
    from app.models.server import Server as ServerModel
    
    receipt = db.query(ReceiptModel).options(
        joinedload(ReceiptModel.items).joinedload(ReceiptItemModel.asset)
    ).filter(ReceiptModel.id == receipt_id).first()
    
    if receipt is None:
        raise HTTPException(status_code=404, detail="入库单未找到")
    
    owners = _owner_identities(current_user)
    restrict_owner = not _is_admin_user(current_user)

    # 构建包含资产详细信息的明细列表
    items_detail = []
    
    if receipt.receipt_type == ReceiptType.SERVER.value or receipt.receipt_type == "server":
        # 服务器入库单：从 servers 表查询关联的服务器
        servers = db.query(ServerModel).filter(ServerModel.receipt_id == receipt_id).all()
        for server in servers:
            if restrict_owner:
                owner = (server.user_person or "").strip().lower()
                if owner not in owners:
                    continue
            items_detail.append({
                "id": server.id,
                "receipt_id": receipt_id,
                "asset_id": server.id,
                "asset_code": server.asset_code,
                "sn": server.serial_number,
                "brand": server.brand,
                "model": server.model,
                "status": server.status,
                "user": server.user_person,
                "location": server.location,
                "department": server.department,
                "ip_address": server.ip_address,
                "hostname": server.hostname,
                "created_at": server.created_at,
                "item_type": "server",  # 标识为服务器
            })
    else:
        # 配件入库单：从 receipt_items 表查询（单个添加方式）
        for item in receipt.items:
            asset = item.asset
            if not asset:
                continue
            if restrict_owner:
                owner = (asset.user or "").strip().lower()
                if owner not in owners:
                    continue
            items_detail.append({
                "id": item.id,
                "receipt_id": item.receipt_id,
                "asset_id": asset.id,
                "asset_code": getattr(asset, 'asset_code', None),
                "sn": asset.sn,
                "part_type": getattr(asset, 'part_type', None),
                "brand": asset.brand,
                "model": asset.model,
                "status": asset.status,
                "user": asset.user,
                "location": asset.location,
                "department": asset.department,
                "created_at": item.created_at,
                "item_type": "asset",  # 标识为配件
            })
        
        # 同时查询通过 receipt_id 直接关联的配件（批量导入方式）
        from app.models.asset import Asset as AssetModel
        directly_linked_assets = db.query(AssetModel).filter(
            AssetModel.receipt_id == receipt_id,
            AssetModel.deleted_at.is_(None)
        ).all()
        
        # 避免重复：检查 asset_id 是否已经在 items_detail 中
        existing_asset_ids = {item["asset_id"] for item in items_detail}
        for asset in directly_linked_assets:
            if restrict_owner:
                owner = (asset.user or "").strip().lower()
                if owner not in owners:
                    continue
            if asset.id not in existing_asset_ids:
                items_detail.append({
                    "id": asset.id,  # 使用 asset.id 作为 item id
                    "receipt_id": receipt_id,
                    "asset_id": asset.id,
                    "asset_code": getattr(asset, 'asset_code', None),
                    "sn": asset.sn,
                    "part_type": getattr(asset, 'part_type', None),
                    "brand": asset.brand,
                    "model": asset.model,
                    "status": asset.status,
                    "user": asset.user,
                    "location": asset.location,
                    "department": asset.department,
                    "created_at": asset.created_at,
                    "item_type": "asset",  # 标识为配件
                })
    
    # 普通用户请求他人入库单时，按“不可见”处理
    if restrict_owner and not items_detail:
        raise HTTPException(status_code=404, detail="入库单未找到")

    # 重新计算实际的资产数量
    actual_count = len(items_detail)
    
    # 如果实际数量与数据库中的数量不一致，更新数据库
    if receipt.asset_count != actual_count:
        receipt.asset_count = actual_count
        db.commit()
        db.refresh(receipt)
    
    status_val = getattr(receipt, "status", "draft") or "draft"
    submitted_at_val = getattr(receipt, "submitted_at", None)
    receipt_detail = ReceiptDetail(
        id=receipt.id,
        receipt_number=receipt.receipt_number,
        receipt_type=receipt.receipt_type,
        status=status_val,
        operator=receipt.operator,
        purchaser=getattr(receipt, "purchaser", None),
        company=getattr(receipt, "company", None),
        department=getattr(receipt, "department", None),
        receipt_date=getattr(receipt, "receipt_date", None),
        remark=receipt.remark,
        asset_count=actual_count,
        created_at=receipt.created_at,
        updated_at=receipt.updated_at,
        submitted_at=submitted_at_val,
        items=items_detail
    )
    
    return receipt_detail

@router.post("/{receipt_id}/submit")
def submit_receipt(
    receipt_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(require_permission("receipt:write"))
):
    """提交入库（业界做法：草稿 → 已入库，锁定单据）"""
    from app.models.server import Server as ServerModel
    
    receipt = db.query(ReceiptModel).filter(ReceiptModel.id == receipt_id).first()
    if receipt is None:
        raise HTTPException(status_code=404, detail="入库单未找到")
    if receipt.status != ReceiptStatus.DRAFT.value:
        raise HTTPException(status_code=400, detail="仅草稿状态的入库单可提交")
    
    # 根据入库单类型计算实际资产数量
    if receipt.receipt_type == ReceiptType.SERVER.value or receipt.receipt_type == "server":
        # 服务器入库单：从 servers 表计算数量
        actual_count = db.query(ServerModel).filter(ServerModel.receipt_id == receipt_id).count()
    else:
        # 配件入库单：从 receipt_items 表计算数量（单个添加方式）
        from app.models.asset import Asset as AssetModel
        items_count = db.query(ReceiptItemModel).filter(ReceiptItemModel.receipt_id == receipt_id).count()
        # 同时计算通过 receipt_id 直接关联的配件数量（批量导入方式）
        direct_count = db.query(AssetModel).filter(
            AssetModel.receipt_id == receipt_id,
            AssetModel.deleted_at.is_(None)
        ).count()
        # 取两者之和（避免重复需要更复杂的逻辑，这里简化处理）
        # 实际上，直接关联的配件不会出现在 receipt_items 中，所以可以直接相加
        actual_count = items_count + direct_count
    
    # 更新入库单的资产数量
    receipt.asset_count = actual_count
    
    if actual_count <= 0:
        raise HTTPException(status_code=400, detail="至少需有一条资产明细才能提交入库")
    
    now = datetime.now(pytz.timezone('Asia/Shanghai'))
    if now.tzinfo is None:
        now = pytz.UTC.localize(now)
    receipt.status = ReceiptStatus.SUBMITTED.value
    receipt.submitted_at = now
    db.commit()
    db.refresh(receipt)
    return {"message": "入库单已提交", "status": receipt.status, "submitted_at": receipt.submitted_at}


@router.post("/{receipt_id}/items", response_model=ReceiptItemSchema)
def add_receipt_item(
    receipt_id: int, 
    asset_id: int = Query(...), 
    db: Session = Depends(get_db),
    current_user = Depends(require_permission("receipt:write"))
):
    """向入库单添加资产（仅草稿状态可添加）"""
    receipt = db.query(ReceiptModel).filter(ReceiptModel.id == receipt_id).first()
    if receipt is None:
        raise HTTPException(status_code=404, detail="入库单未找到")
    if receipt.status != ReceiptStatus.DRAFT.value:
        raise HTTPException(status_code=400, detail="已入库的单据不可再添加资产")
    
    # 检查资产是否存在
    asset = db.query(AssetModel).filter(AssetModel.id == asset_id).first()
    if asset is None:
        raise HTTPException(status_code=404, detail="资产未找到")
    
    # 检查资产是否已经在该入库单中
    existing_item = db.query(ReceiptItemModel).filter(
        ReceiptItemModel.receipt_id == receipt_id,
        ReceiptItemModel.asset_id == asset_id
    ).first()
    if existing_item:
        raise HTTPException(status_code=400, detail="该资产已在此入库单中")
    
    # 创建入库单明细
    receipt_item = ReceiptItemModel(
        receipt_id=receipt_id,
        asset_id=asset_id
    )
    db.add(receipt_item)
    
    # 更新入库单的资产数量
    receipt.asset_count = db.query(ReceiptItemModel).filter(
        ReceiptItemModel.receipt_id == receipt_id
    ).count() + 1
    
    db.commit()
    db.refresh(receipt_item)
    
    return receipt_item

@router.delete("/{receipt_id}")
def delete_receipt(
    receipt_id: int, 
    db: Session = Depends(get_db),
    current_user = Depends(require_permission("receipt:delete"))
):
    """
    删除入库单：
    - 草稿状态：可以删除
    - 已入库状态：提交后1天内可以删除，超过1天不可删除
    - 删除入库单时会永久删除关联的资产（不进回收站）
    """
    from app.models.server import Server as ServerModel
    from app.models.server import ServerHistory as ServerHistoryModel
    from app.models.asset import AssetHistory as AssetHistoryModel
    
    receipt = db.query(ReceiptModel).filter(ReceiptModel.id == receipt_id).first()
    if receipt is None:
        raise HTTPException(status_code=404, detail="入库单未找到")
    
    # 已入库状态：检查是否在1天内
    if receipt.status == ReceiptStatus.SUBMITTED.value:
        if not receipt.submitted_at:
            raise HTTPException(status_code=400, detail="已入库的单据缺少提交时间，无法删除")
        
        now = datetime.now(pytz.timezone('Asia/Shanghai'))
        submitted_at = receipt.submitted_at
        if submitted_at.tzinfo is None:
            submitted_at = pytz.UTC.localize(submitted_at)
        submitted_at = submitted_at.astimezone(pytz.timezone('Asia/Shanghai'))
        
        # 超过1天不可删除
        one_day_ago = now - timedelta(days=1)
        if submitted_at < one_day_ago:
            raise HTTPException(status_code=400, detail="已入库超过1天的单据不可删除")
    
    deleted_count = 0
    
    # 删除关联的资产/服务器（永久删除，不进回收站）
    if receipt.receipt_type == ReceiptType.SERVER.value or receipt.receipt_type == "server":
        # 服务器入库单：先删除服务器的历史记录，再删除服务器
        servers = db.query(ServerModel).filter(ServerModel.receipt_id == receipt_id).all()
        for server in servers:
            # 删除服务器历史记录
            db.query(ServerHistoryModel).filter(ServerHistoryModel.server_id == server.id).delete()
        deleted_count = len(servers)
        # 删除服务器
        db.query(ServerModel).filter(ServerModel.receipt_id == receipt_id).delete()
    else:
        # 配件入库单：处理两种关联方式的配件
        asset_ids_to_delete = set()
        
        # 1. 通过 receipt_items 表关联的配件（单个添加方式）
        receipt_items = db.query(ReceiptItemModel).filter(ReceiptItemModel.receipt_id == receipt_id).all()
        for item in receipt_items:
            asset_ids_to_delete.add(item.asset_id)
        
        # 2. 通过 receipt_id 直接关联的配件（批量导入方式）
        directly_linked_assets = db.query(AssetModel).filter(AssetModel.receipt_id == receipt_id).all()
        for asset in directly_linked_assets:
            asset_ids_to_delete.add(asset.id)
        
        deleted_count = len(asset_ids_to_delete)
        
        # 删除配件历史记录和配件
        for asset_id in asset_ids_to_delete:
            # 删除配件历史记录
            db.query(AssetHistoryModel).filter(AssetHistoryModel.asset_id == asset_id).delete()
            # 删除配件
            db.query(AssetModel).filter(AssetModel.id == asset_id).delete()
        
        # 删除入库单明细
        db.query(ReceiptItemModel).filter(ReceiptItemModel.receipt_id == receipt_id).delete()
    
    db.delete(receipt)
    db.commit()
    return {"message": f"入库单已删除，同时删除了 {deleted_count} 个关联资产"}

@router.delete("/{receipt_id}/items/{item_id}")
def revoke_receipt_item(
    receipt_id: int, 
    item_id: int, 
    db: Session = Depends(get_db),
    current_user = Depends(require_permission("receipt:delete"))
):
    """
    移除/撤销入库单中的资产：
    - 草稿：仅从单上移除明细，资产保留（可再入其他单）
    - 已入库：撤销入库（仅限两天内录入），删除资产并移除明细，需管理员
    
    支持两种关联方式：
    1. 通过 receipt_items 表关联（单个添加方式）
    2. 通过 receipt_id 直接关联（批量导入方式）
    """
    from app.models.asset import AssetHistory as AssetHistoryModel
    
    receipt = db.query(ReceiptModel).filter(ReceiptModel.id == receipt_id).first()
    if receipt is None:
        raise HTTPException(status_code=404, detail="入库单未找到")
    
    # 尝试查找 receipt_item（单个添加方式）
    receipt_item = db.query(ReceiptItemModel).filter(
        ReceiptItemModel.id == item_id,
        ReceiptItemModel.receipt_id == receipt_id
    ).first()
    
    # 如果没找到 receipt_item，尝试查找直接关联的配件（批量导入方式）
    directly_linked_asset = None
    if receipt_item is None:
        directly_linked_asset = db.query(AssetModel).filter(
            AssetModel.id == item_id,
            AssetModel.receipt_id == receipt_id
        ).first()
        if directly_linked_asset is None:
            raise HTTPException(status_code=404, detail="入库单明细未找到")
    
    if receipt.status == ReceiptStatus.DRAFT.value:
        # 草稿状态
        if receipt_item:
            # 单个添加方式：只删明细，不动资产
            db.delete(receipt_item)
        elif directly_linked_asset:
            # 批量导入方式：清除配件的 receipt_id 关联
            directly_linked_asset.receipt_id = None
        
        db.flush()
        
        # 重新计算剩余数量（两种关联方式）
        items_count = db.query(ReceiptItemModel).filter(ReceiptItemModel.receipt_id == receipt_id).count()
        direct_count = db.query(AssetModel).filter(
            AssetModel.receipt_id == receipt_id,
            AssetModel.deleted_at.is_(None)
        ).count()
        remaining = items_count + direct_count
        
        receipt.asset_count = remaining
        db.commit()
        db.refresh(receipt)
        return {"message": "已从入库单移除该资产", "receipt_deleted": False}
    
    now = datetime.now(pytz.timezone('Asia/Shanghai'))
    two_days_ago = now - timedelta(days=2)
    
    # 获取资产和创建时间
    if receipt_item:
        asset = db.query(AssetModel).filter(AssetModel.id == receipt_item.asset_id).first()
        item_created_at = receipt_item.created_at
    else:
        asset = directly_linked_asset
        item_created_at = asset.created_at
    
    if asset is None:
        raise HTTPException(status_code=404, detail="资产未找到")
    
    if item_created_at.tzinfo is None:
        item_created_at = pytz.UTC.localize(item_created_at)
    item_created_at = item_created_at.astimezone(pytz.timezone('Asia/Shanghai'))
    if item_created_at < two_days_ago:
        raise HTTPException(status_code=400, detail="已入库单仅可撤销两天内录入的资产")
    
    asset_code = getattr(asset, 'asset_code', None)
    asset_sn = asset.sn
    
    # 删除资产历史记录和资产
    db.query(AssetHistoryModel).filter(AssetHistoryModel.asset_id == asset.id).delete()
    db.delete(asset)
    
    # 如果是单个添加方式，还需要删除 receipt_item
    if receipt_item:
        db.delete(receipt_item)
    
    # 重新计算剩余数量（两种关联方式）
    items_count = db.query(ReceiptItemModel).filter(ReceiptItemModel.receipt_id == receipt_id).count()
    direct_count = db.query(AssetModel).filter(
        AssetModel.receipt_id == receipt_id,
        AssetModel.deleted_at.is_(None)
    ).count()
    remaining_count = items_count + direct_count
    
    receipt.asset_count = remaining_count
    receipt_deleted = False
    if remaining_count == 0:
        db.delete(receipt)
        receipt_deleted = True
    db.commit()
    return {
        "message": "资产已撤销入库",
        "asset_code": asset_code,
        "sn": asset_sn,
        "receipt_deleted": receipt_deleted
    }
