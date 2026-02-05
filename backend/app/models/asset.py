from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base

class Asset(Base):
    """资产模型 - 与项目介绍 5.1 assets 表一致"""
    __tablename__ = "assets"
    
    id = Column(Integer, primary_key=True, index=True)
    sn = Column(String, unique=True, index=True, nullable=False)
    asset_code = Column(String, unique=True, index=True, nullable=True)  # 资产编码，自动生成
    model = Column(String, nullable=False)
    brand = Column(String)
    bmc_ip = Column(String)
    user = Column(String)
    system_ip = Column(String)
    system_username = Column(String)
    system_password = Column(String)
    u_position = Column(String)
    u_height = Column(Integer, default=1)
    purchase_date = Column(DateTime(timezone=True))
    warranty_expiry = Column(DateTime(timezone=True))
    status = Column(String, default="in_storage")  # in_storage, in_use, maintenance, idle, pending_scrap, scrapped, deleted
    location = Column(String)
    department = Column(String)
    contract_number = Column(String, nullable=True)
    purchased_with_server_sn = Column(String, nullable=True)
    remark = Column(Text, nullable=True)
    cpu_model = Column(String, nullable=True)
    cpu_cores = Column(Integer, nullable=True)
    memory_gb = Column(Integer, nullable=True)
    disk_info = Column(Text, nullable=True)
    # 配件专用字段
    part_type = Column(String, nullable=True)       # 配件类型
    capacity = Column(String, nullable=True)         # 容量（数值存字符串便于单位分离）
    capacity_unit = Column(String, nullable=True)   # 容量单位
    frequency = Column(String, nullable=True)        # 频率
    frequency_unit = Column(String, nullable=True)  # 频率单位
    interface_type = Column(String, nullable=True)   # 接口类型
    spec = Column(String, nullable=True)            # 规格
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    deleted_at = Column(DateTime(timezone=True), nullable=True)  # 软删除时间戳
    
    # 关联历史记录
    history_records = relationship("AssetHistory", back_populates="asset")
    
    def __repr__(self):
        return f"<Asset(id={self.id}, sn='{self.sn}', model='{self.model}', status='{self.status}')>"


class AssetHistory(Base):
    __tablename__ = "asset_history"
    
    id = Column(Integer, primary_key=True, index=True)
    asset_id = Column(Integer, ForeignKey("assets.id"), nullable=True)  # 改为可以为空
    date = Column(DateTime(timezone=True), server_default=func.now())
    action = Column(String, nullable=False)
    operator = Column(String, nullable=False)
    remark = Column(Text)  # 改为Text类型以支持更长的备注
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # 关联资产
    asset = relationship("Asset", back_populates="history_records")
    
    def __repr__(self):
        return f"<AssetHistory(id={self.id}, asset_id={self.asset_id}, action='{self.action}')>"