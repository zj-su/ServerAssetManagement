from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Enum as SQLEnum
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base
import enum

class ReceiptType(str, enum.Enum):
    SERVER = "server"  # 服务器入库单
    PART = "part"      # 配件入库单

class Receipt(Base):
    __tablename__ = "receipts"
    
    id = Column(Integer, primary_key=True, index=True)
    receipt_number = Column(String, unique=True, index=True, nullable=False)  # 入库单号（自动生成）
    receipt_type = Column(SQLEnum(ReceiptType), nullable=False)  # 入库单类型：server或part
    operator = Column(String, nullable=False)  # 操作人（由后端从当前登录用户获取）
    remark = Column(Text)  # 备注
    asset_count = Column(Integer, default=0)  # 资产数量
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
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
