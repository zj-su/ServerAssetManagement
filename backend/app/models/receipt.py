from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Enum as SQLEnum
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base
import enum

class ReceiptType(str, enum.Enum):
    SERVER = "server"  # 服务器入库单
    PART = "part"      # 配件入库单


class ReceiptStatus(str, enum.Enum):
    """入库单状态：业界常见流转 草稿 → 已入库"""
    DRAFT = "draft"        # 草稿：可编辑、可删
    SUBMITTED = "submitted"  # 已入库：不可改明细，仅可按规定撤销


class Receipt(Base):
    __tablename__ = "receipts"
    
    id = Column(Integer, primary_key=True, index=True)
    receipt_number = Column(String, unique=True, index=True, nullable=False)  # 入库单号（自动生成）
    receipt_type = Column(SQLEnum(ReceiptType), nullable=False)  # 入库单类型：server或part
    status = Column(String, default=ReceiptStatus.DRAFT.value, nullable=False)  # 状态：draft / submitted
    operator = Column(String, nullable=False)  # 制单人/操作人（入库人）
    purchaser = Column(String, nullable=True)  # 采购人
    company = Column(String, nullable=True)  # 所属/承租公司
    department = Column(String, nullable=True)  # 资产归属部门
    receipt_date = Column(DateTime(timezone=True), nullable=True)  # 入库日期
    remark = Column(Text)  # 备注
    asset_count = Column(Integer, default=0)  # 资产数量
    created_at = Column(DateTime(timezone=True), server_default=func.now())   # 制单时间
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    submitted_at = Column(DateTime(timezone=True), nullable=True)  # 入库时间（提交时写入）
    
    # 关联入库单明细
    items = relationship("ReceiptItem", back_populates="receipt", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Receipt(id={self.id}, receipt_number='{self.receipt_number}', type='{self.receipt_type}')>"

class ReceiptItem(Base):
    __tablename__ = "receipt_items"
    
    id = Column(Integer, primary_key=True, index=True)
    receipt_id = Column(Integer, ForeignKey("receipts.id"), nullable=False)
    asset_id = Column(Integer, ForeignKey("assets.id"), nullable=False)  # 关联的资产ID
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # 关联入库单
    receipt = relationship("Receipt", back_populates="items")
    # 关联资产
    asset = relationship("Asset", foreign_keys=[asset_id])
    
    def __repr__(self):
        return f"<ReceiptItem(id={self.id}, receipt_id={self.receipt_id}, asset_id={self.asset_id})>"
