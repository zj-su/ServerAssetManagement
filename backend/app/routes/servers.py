from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Query
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from app.core.database import get_db
from app.models.server import Server as ServerModel, ServerHistory as ServerHistoryModel
from app.models.asset import Asset as AssetModel
from app.schemas.server import Server, ServerCreate, ServerUpdate
from app.utils.security import get_current_user, require_admin
import logging
import io
from openpyxl import load_workbook

router = APIRouter(prefix="/servers", tags=["servers"])
logger = logging.getLogger(__name__)

# 服务器资产编码前缀与格式：SY-SR-0001
ASSET_CODE_PREFIX = "SY-SR-"
ASSET_CODE_DIGITS = 4


def _next_asset_code(db: Session) -> str:
    """生成下一个服务器资产编码 SY-SR-0001, SY-SR-0002, ..."""
    import re
    servers = db.query(ServerModel).filter(
        ServerModel.asset_code.isnot(None),
        ServerModel.asset_code != "",
    ).all()
    numbers = []
    pattern = re.compile(r"^SY-SR-(\d+)$", re.IGNORECASE)
    for s in servers:
        if s.asset_code and pattern.match(s.asset_code):
            numbers.append(int(pattern.match(s.asset_code).group(1)))
    next_num = (max(numbers) + 1) if numbers else 1
    return f"{ASSET_CODE_PREFIX}{next_num:0{ASSET_CODE_DIGITS}d}"

# 服务器导入模板表头（与 服务器导入模板 一致）
IMPORT_HEADERS = {
    "序列号(SN)": "serial_number",
    "品牌": "brand",
    "型号": "model",
    "BMC IP": "bmc_ip",
    "BMC账号": "bmc_username",
    "BMC密码": "bmc_password",
    "使用人": "user_person",
    "系统IP": "ip_address",
    "系统账号": "system_username",
    "系统密码": "system_password",
    "U位": "u_position",
    "U高度": "u_height",
    "状态": "status",
    "位置": "location",
    "部门": "department",
    "合同号": "contract_number",
    "采购日期": "purchase_date",
    "保修到期": "warranty_expire",
    "备注": "remark",
    # 兼容旧模板
    "主机名": "hostname",
    "IP地址": "ip_address",
    "MAC地址": "mac_address",
    "BMC用户名": "bmc_username",
    "CPU型号": "cpu_model",
    "CPU核心数": "cpu_cores",
    "内存(GB)": "memory_gb",
    "磁盘信息": "disk_info",
}
REQUIRED_FIELDS = ("serial_number",)  # 序列号(SN)必填，按SN去重

# 批量导入：独立路由挂到 /api/v1/import-servers，避免被 /servers/{server_id} 抢匹配导致 405
import_router = APIRouter(tags=["servers"])


@import_router.post("/import-servers/")
def import_servers_excel(
    file: UploadFile = File(..., description="服务器导入模板 Excel"),
    receipt_id: int = Query(None, description="关联的入库单ID"),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    批量导入服务器：按服务器导入模板表头解析。
    如果提供 receipt_id，将导入的服务器关联到该入库单。
    """
    from app.models.receipt import Receipt as ReceiptModel
    
    # 验证入库单
    receipt = None
    if receipt_id:
        receipt = db.query(ReceiptModel).filter(ReceiptModel.id == receipt_id).first()
        if not receipt:
            raise HTTPException(status_code=404, detail="入库单不存在")
        if receipt.status != "draft":
            raise HTTPException(status_code=400, detail="只能向草稿状态的入库单添加服务器")
        if receipt.receipt_type != "server":
            raise HTTPException(status_code=400, detail="该入库单不是服务器入库单")
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
        if "serial_number" not in col_map:
            raise HTTPException(
                status_code=400,
                detail=f"缺少必填列，请使用模板。需要列：序列号(SN)；当前表头：{header_row}"
            )
        created = 0
        skipped = []
        errors = []
        for row_idx, row in enumerate(rows[2:], start=3):
            if not row:
                continue
            vals = [row[i] if i < len(row) else None for i in range(max(col_map.values()) + 1)]
            def get(f: str):
                if f not in col_map:
                    return None
                v = vals[col_map[f]]
                if v is None:
                    return None
                if f in ("cpu_cores", "memory_gb", "u_height"):
                    try:
                        return int(float(v))
                    except (TypeError, ValueError):
                        return None
                if f in ("purchase_date", "warranty_expire") and v:
                    try:
                        from datetime import datetime as dt
                        if hasattr(v, "date"):
                            return v.date() if hasattr(v, "date") else v
                        return dt.strptime(str(v).strip()[:10], "%Y-%m-%d").date() if str(v).strip() else None
                    except Exception:
                        return None
                s = str(v).strip() if v else None
                return s if s else None
            ip_address = get("ip_address")
            serial_number = get("serial_number")
            hostname = get("hostname") or serial_number or ip_address or ""
            # SN（序列号）必填，用于去重判断
            if not serial_number:
                errors.append({"row": row_idx, "reason": "序列号(SN)必填"})
                continue
            # 按SN去重，检查是否已存在相同序列号的服务器
            if db.query(ServerModel).filter(ServerModel.serial_number == serial_number).first():
                skipped.append({"row": row_idx, "sn": serial_number, "reason": "序列号已存在"})
                continue
            try:
                server_data = {
                    "asset_code": _next_asset_code(db),
                    "receipt_id": receipt_id,  # 关联入库单
                    "serial_number": serial_number,
                    "hostname": hostname,
                    "ip_address": ip_address or "",
                    "mac_address": get("mac_address") or "",
                    "brand": get("brand"),
                    "model": get("model"),
                    "bmc_ip": get("bmc_ip"),
                    "bmc_username": get("bmc_username"),
                    "bmc_password": get("bmc_password"),
                    "user_person": get("user_person"),
                    "system_username": get("system_username"),
                    "system_password": get("system_password"),
                    "u_position": get("u_position"),
                    "u_height": get("u_height"),
                    "status": get("status") or "offline",
                    "location": get("location"),
                    "department": get("department"),
                    "contract_number": get("contract_number"),
                    "purchase_date": get("purchase_date"),
                    "warranty_expire": get("warranty_expire"),
                    "remark": get("remark"),
                    "cpu_model": get("cpu_model"),
                    "cpu_cores": get("cpu_cores"),
                    "memory_gb": get("memory_gb"),
                    "disk_info": get("disk_info"),
                }
                server_data = {k: v for k, v in server_data.items() if v is not None}
                if not server_data.get("status"):
                    server_data["status"] = "offline"
                db_server = ServerModel(**server_data)
                db.add(db_server)
                db.commit()
                db.refresh(db_server)
                created += 1
            except Exception as e:
                db.rollback()
                errors.append({"row": row_idx, "reason": str(e)})
        wb.close()
        
        # 如果关联了入库单，更新入库单的资产数量
        if receipt and created > 0:
            receipt.asset_count = (receipt.asset_count or 0) + created
            db.commit()
        
        return {
            "message": "批量导入完成",
            "created": created,
            "skipped": len(skipped),
            "skipped_details": skipped[:20],
            "errors": errors[:20],
            "receipt_id": receipt_id,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("服务器批量导入失败: %s", e)
        raise HTTPException(status_code=500, detail=f"导入失败: {str(e)}")


@import_router.get("/servers-template/")
def download_servers_template():
    """下载服务器导入模板"""
    from openpyxl import Workbook
    from openpyxl.styles import Font, Alignment, PatternFill
    from openpyxl.utils import get_column_letter
    from fastapi.responses import StreamingResponse
    from urllib.parse import quote
    
    wb = Workbook()
    ws = wb.active
    ws.title = "服务器导入模板"
    
    # 第一行：说明（红色字体）
    notice_text = "【说明】1.序列号(SN)必填，用于去重判断；2.状态可选：online(在线)、offline(离线)、maintenance(维护中)；3.日期格式：YYYY-MM-DD；4.请删除示例数据后再导入"
    notice_cell = ws.cell(row=1, column=1, value=notice_text)
    notice_cell.font = Font(bold=True, color="FF0000")
    ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=21)
    
    # 定义表头（服务器基本信息，不含配件如内存/硬盘）- 第二行
    headers = [
        "序列号(SN)", "品牌", "型号", "CPU型号", "CPU核心数",
        "BMC IP", "BMC账号", "BMC密码",
        "使用人", "系统IP", "系统账号", "系统密码", "U位", "U高度",
        "状态", "位置", "部门", "合同号", "采购日期", "保修到期", "备注"
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
        ws.column_dimensions[get_column_letter(col_idx)].width = 15
    
    # 添加示例数据 - 从第三行开始
    example_data = [
        ["SN1234567811", "Dell", "PowerEdge R750", "Intel Xeon Gold 6348", "40",
         "192.168.1.10", "root", "password123",
         "", "10.0.0.100", "root", "syspassword", "", "2",
         "", "仓库", "IT部", "HT-2024-001", "2024-01-15", "2027-01-15", ""],
    ]
    
    for row_idx, row_data in enumerate(example_data, 3):
        for col_idx, value in enumerate(row_data, 1):
            ws.cell(row=row_idx, column=col_idx, value=value)
    
    # 保存到内存
    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    
    filename = quote("服务器导入模板.xlsx")
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{filename}"}
    )


@router.get("/", response_model=List[Server])
def read_servers(
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    try:
        # 默认排除待报废、已报废和已删除的服务器
        servers = db.query(ServerModel).filter(
            ~ServerModel.status.in_(['pending_scrap', 'scrapped', 'deleted'])
        ).offset(skip).limit(limit).all()
        return servers
    except Exception as e:
        logger.error(f"Error fetching servers: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/search", response_model=List[Server])
def search_servers(
    q: str = "",
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """搜索服务器（按SN、主机名、IP、资产编码模糊匹配）"""
    try:
        if not q or len(q.strip()) == 0:
            return []
        
        keyword = f"%{q.strip()}%"
        servers = db.query(ServerModel).filter(
            ~ServerModel.status.in_(['pending_scrap', 'scrapped', 'deleted']),
            (
                ServerModel.serial_number.ilike(keyword) |
                ServerModel.hostname.ilike(keyword) |
                ServerModel.ip_address.ilike(keyword) |
                ServerModel.asset_code.ilike(keyword)
            )
        ).limit(limit).all()
        return servers
    except Exception as e:
        logger.error(f"Error searching servers: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/", response_model=Server)
def create_server(
    server: ServerCreate, 
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    from app.models.receipt import Receipt as ReceiptModel
    
    try:
        data = server.dict(exclude_unset=True)
        # 兼容旧库中 hostname/ip_address/mac_address 为 NOT NULL 的情况
        data.setdefault("hostname", "")
        data.setdefault("ip_address", "")
        data.setdefault("mac_address", "")
        
        # SN（序列号）必填，用于去重判断
        serial_number = data.get("serial_number")
        if not serial_number or not str(serial_number).strip():
            raise HTTPException(status_code=400, detail="序列号(SN)必填")
        
        # 按SN去重，检查是否已存在相同序列号的服务器
        existing_server = db.query(ServerModel).filter(ServerModel.serial_number == serial_number).first()
        if existing_server:
            raise HTTPException(status_code=400, detail=f"序列号 {serial_number} 已存在")
        
        # 资产编码由后端自动生成，规则 SY-SR-0001
        generated_code = _next_asset_code(db)
        data["asset_code"] = generated_code
        
        # 验证入库单（如果提供）
        receipt_id = data.get("receipt_id")
        receipt = None
        if receipt_id:
            receipt = db.query(ReceiptModel).filter(ReceiptModel.id == receipt_id).first()
            if not receipt:
                raise HTTPException(status_code=404, detail="入库单不存在")
            if receipt.status != "draft":
                raise HTTPException(status_code=400, detail="只能向草稿状态的入库单添加服务器")
            if receipt.receipt_type != "server":
                raise HTTPException(status_code=400, detail="该入库单不是服务器入库单")
        
        db_server = ServerModel(**data)
        db.add(db_server)
        db.commit()
        db.refresh(db_server)
        
        # 更新入库单的资产数量
        if receipt:
            receipt.asset_count = (receipt.asset_count or 0) + 1
            db.commit()
        
        # 确保响应中一定带上 asset_code（部分环境 refresh 后可能未加载新列）
        if not getattr(db_server, "asset_code", None) or str(db_server.asset_code).strip() == "":
            db_server.asset_code = generated_code
        # 添加创建历史记录
        operator = current_user.username if hasattr(current_user, 'username') else str(current_user)
        _add_server_history(db, db_server.id, "创建服务器", operator, f"创建服务器 {db_server.serial_number or db_server.hostname}")
        return db_server
    except HTTPException:
        raise
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

# ServerUpdate 允许更新的字段名（与模型列名一致，避免多余/错误键）
_UPDATE_FIELDS = set(ServerUpdate.__fields__.keys())

# 字段名中文映射
_FIELD_NAME_CN = {
    'asset_code': '资产编码',
    'serial_number': '序列号',
    'hostname': '主机名',
    'ip_address': '系统IP',
    'mac_address': 'MAC地址',
    'brand': '品牌',
    'model': '型号',
    'bmc_ip': 'BMC IP',
    'bmc_username': 'BMC账号',
    'bmc_password': 'BMC密码',
    'user_person': '使用人',
    'system_username': '系统账号',
    'system_password': '系统密码',
    'u_position': 'U位',
    'u_height': 'U高度',
    'status': '状态',
    'location': '位置',
    'department': '部门',
    'contract_number': '合同号',
    'purchase_date': '采购日期',
    'warranty_expire': '保修到期',
    'remark': '备注',
    'cpu_model': 'CPU型号',
    'cpu_cores': 'CPU核心数',
    'memory_gb': '内存(GB)',
    'disk_info': '磁盘信息',
}

# 状态值中文映射
_STATUS_VALUE_CN = {
    'online': '使用中',
    'offline': '空闲',
    'maintenance': '在库',
    'pending_scrap': '待报废',
    'scrapped': '已报废',
}

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
        update_data = server.dict(exclude_unset=True)
        for key in list(update_data.keys()):
            if key not in _UPDATE_FIELDS:
                update_data.pop(key, None)
        # 记录变更内容
        changes = []
        for key, value in update_data.items():
            if hasattr(ServerModel, key):
                old_value = getattr(db_server, key)
                if old_value != value:
                    field_cn = _FIELD_NAME_CN.get(key, key)
                    # 如果是状态字段，将值转换为中文显示
                    if key == 'status':
                        old_display = _STATUS_VALUE_CN.get(old_value, old_value)
                        new_display = _STATUS_VALUE_CN.get(value, value)
                        changes.append(f"{field_cn}: {old_display} → {new_display}")
                    else:
                        changes.append(f"{field_cn}: {old_value} → {value}")
                setattr(db_server, key, value)
        db.commit()
        db.refresh(db_server)
        
        # 同步更新关联配件的状态、使用人和部门
        if db_server.serial_number:
            # 服务器状态映射到配件状态
            status_map = {
                'online': 'in_use',         # 服务器使用中 → 配件使用中
                'offline': 'idle',          # 服务器空闲 → 配件空闲
                'maintenance': 'in_storage',  # 服务器在库 → 配件在库
                'pending_scrap': 'pending_scrap',
                'scrapped': 'scrapped'
            }
            part_status = status_map.get(db_server.status, 'in_storage')
            
            # 查找关联的配件并更新
            related_parts = db.query(AssetModel).filter(
                AssetModel.purchased_with_server_sn == db_server.serial_number
            ).all()
            
            for part in related_parts:
                part.status = part_status
                part.user = db_server.user_person
                part.department = db_server.department
                part.location = db_server.location
            
            if related_parts:
                db.commit()
                logger.info(f"同步更新了 {len(related_parts)} 个关联配件的状态")
        
        # 添加更新历史记录
        if changes:
            operator = current_user.username if hasattr(current_user, 'username') else str(current_user)
            _add_server_history(db, db_server.id, "编辑服务器", operator, "\n".join(changes))
        return db_server
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating server {server_id}: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")

@router.put("/{server_id}/delete", response_model=Server)
def delete_server_to_recycle(
    server_id: int, 
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """将服务器移至回收站（软删除）"""
    from datetime import datetime
    import pytz
    
    try:
        db_server = db.query(ServerModel).filter(ServerModel.id == server_id).first()
        if db_server is None:
            raise HTTPException(status_code=404, detail="服务器未找到")
        
        # 软删除：设置 status 为 deleted，记录删除时间
        old_status = db_server.status
        db_server.status = "deleted"
        db_server.deleted_at = datetime.now(pytz.timezone('Asia/Shanghai'))
        db.commit()
        db.refresh(db_server)
        
        # 添加历史记录
        operator = current_user.username if hasattr(current_user, 'username') else str(current_user)
        _add_server_history(db, db_server.id, "删除服务器", operator, f"服务器已移至回收站，原状态：{old_status}")
        
        return db_server
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error soft deleting server {server_id}: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/deleted/list", response_model=List[Server])
def get_deleted_servers(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """获取已删除的服务器列表（回收站）"""
    try:
        servers = db.query(ServerModel).filter(
            ServerModel.status == "deleted",
            ServerModel.deleted_at.isnot(None)
        ).offset(skip).limit(limit).all()
        return servers
    except Exception as e:
        logger.error(f"Error fetching deleted servers: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.put("/{server_id}/restore", response_model=Server)
def restore_server(
    server_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """从回收站恢复服务器"""
    try:
        db_server = db.query(ServerModel).filter(ServerModel.id == server_id).first()
        if db_server is None:
            raise HTTPException(status_code=404, detail="服务器未找到")
        
        if db_server.status != "deleted":
            raise HTTPException(status_code=400, detail="只有已删除的服务器才能恢复")
        
        # 恢复服务器状态为 offline，清除删除时间
        db_server.status = "offline"
        db_server.deleted_at = None
        db.commit()
        db.refresh(db_server)
        
        # 添加历史记录
        operator = current_user.username if hasattr(current_user, 'username') else str(current_user)
        _add_server_history(db, db_server.id, "恢复服务器", operator, "服务器从回收站恢复")
        
        return db_server
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error restoring server {server_id}: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")


@router.delete("/{server_id}", status_code=status.HTTP_204_NO_CONTENT)
def permanently_delete_server(
    server_id: int, 
    db: Session = Depends(get_db),
    current_user = Depends(require_admin)
):
    """永久删除服务器（需要管理员权限）"""
    try:
        db_server = db.query(ServerModel).filter(ServerModel.id == server_id).first()
        if db_server is None:
            raise HTTPException(status_code=404, detail="服务器未找到")
        
        # 先删除关联的历史记录
        db.query(ServerHistoryModel).filter(ServerHistoryModel.server_id == server_id).delete()
        db.commit()
        
        # 再删除服务器
        db.delete(db_server)
        db.commit()
        return None
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error permanently deleting server {server_id}: {e}")
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


# 获取服务器历史记录
@router.get("/{server_id}/history")
def get_server_history(
    server_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """获取服务器的操作历史记录"""
    db_server = db.query(ServerModel).filter(ServerModel.id == server_id).first()
    if db_server is None:
        raise HTTPException(status_code=404, detail="服务器未找到")
    
    history = db.query(ServerHistoryModel).filter(
        ServerHistoryModel.server_id == server_id
    ).order_by(ServerHistoryModel.date.desc()).all()
    
    return [
        {
            "id": h.id,
            "server_id": h.server_id,
            "date": h.date.isoformat() if h.date else None,
            "action": h.action,
            "operator": h.operator,
            "remark": h.remark
        }
        for h in history
    ]


# 添加服务器历史记录（内部使用）
def _add_server_history(db: Session, server_id: int, action: str, operator: str, remark: str = None):
    """添加服务器操作历史记录"""
    from datetime import datetime
    import pytz
    now = datetime.now(pytz.timezone('Asia/Shanghai'))
    history = ServerHistoryModel(
        server_id=server_id,
        date=now,
        action=action,
        operator=operator,
        remark=remark
    )
    db.add(history)
    db.commit()


# ==================== 报废管理 ====================

# 报废服务器（移到待报废）
@router.put("/{server_id}/scrap")
def scrap_server(
    server_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """将服务器标记为待报废"""
    try:
        db_server = db.query(ServerModel).filter(ServerModel.id == server_id).first()
        if db_server is None:
            raise HTTPException(status_code=404, detail="服务器未找到")
        
        old_status = db_server.status
        db_server.status = "pending_scrap"
        db.commit()
        db.refresh(db_server)
        
        # 添加历史记录
        operator = current_user.username if hasattr(current_user, 'username') else str(current_user)
        _add_server_history(db, db_server.id, "申请报废", operator, f"状态: {old_status} → 待报废")
        
        return {"message": f"服务器 {db_server.asset_code or db_server.hostname} 已标记为待报废", "server": db_server}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error scrapping server {server_id}: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")


# 确认报废服务器
@router.put("/{server_id}/confirm-scrap")
def confirm_scrap_server(
    server_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(require_admin)
):
    """确认报废服务器（需要管理员权限）"""
    try:
        db_server = db.query(ServerModel).filter(ServerModel.id == server_id).first()
        if db_server is None:
            raise HTTPException(status_code=404, detail="服务器未找到")
        
        if db_server.status != "pending_scrap":
            raise HTTPException(status_code=400, detail="只能确认报废待报废状态的服务器")
        
        db_server.status = "scrapped"
        db.commit()
        db.refresh(db_server)
        
        # 添加历史记录
        operator = current_user.username if hasattr(current_user, 'username') else str(current_user)
        _add_server_history(db, db_server.id, "确认报废", operator, "状态: 待报废 → 已报废")
        
        return {"message": f"服务器 {db_server.asset_code or db_server.hostname} 已确认报废", "server": db_server}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error confirming scrap server {server_id}: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")


# 获取待报废服务器列表
@router.get("/scrap/pending")
def get_pending_scrap_servers(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """获取待报废服务器列表"""
    servers = db.query(ServerModel).filter(ServerModel.status == "pending_scrap").all()
    return servers


# 获取已报废服务器列表
@router.get("/scrap/scrapped")
def get_scrapped_servers(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """获取已报废服务器列表"""
    servers = db.query(ServerModel).filter(ServerModel.status == "scrapped").all()
    return servers