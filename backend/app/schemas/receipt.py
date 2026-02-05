from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from app.models.receipt import ReceiptType

# 入库单明细基础模型
class ReceiptItemBase(BaseModel):
    asset_id: int

# 入库单明细响应模型
class ReceiptItem(ReceiptItemBase):
    id: int
    receipt_id: int
    created_at: datetime
    
    class Config:
        orm_mode = True

# 入库单基础模型
class ReceiptBase(BaseModel):
    receipt_type: ReceiptType
    operator: Optional[str] = None  # 操作人，由后端从当前登录用户获取，前端不需要传递
    remark: Optional[str] = None

# 创建入库单模型
class ReceiptCreate(ReceiptBase):
    pass

# 入库单响应模型
class Receipt(ReceiptBase):
    id: int
    receipt_number: str
    status: str = "draft"  # draft=草稿, submitted=已入库
    asset_count: int
    created_at: datetime
    updated_at: datetime
    submitted_at: Optional[datetime] = None  # 入库时间
    items: List[ReceiptItem] = []
    
    class Config:
        orm_mode = True

# 入库单详情（包含资产信息）
class ReceiptDetail(Receipt):
    items: List[dict] = []  # 包含资产详细信息的明细列表
