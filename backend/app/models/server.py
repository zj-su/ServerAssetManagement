from sqlalchemy import Column, Integer, String, DateTime, Date, ForeignKey, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base

class Server(Base):
    __tablename__ = "servers"
    
    id = Column(Integer, primary_key=True, index=True)
    asset_code = Column(String, unique=True, index=True)  # 资产编码，规则 SY-SR-0001，添加时自动生成
    # 基础标识
    serial_number = Column(String, index=True)  # 序列号(SN)
    hostname = Column(String, index=True)  # 主机名，可与 SN 或系统IP 对应
    ip_address = Column(String, index=True)  # 系统IP
    mac_address = Column(String)
    # 品牌与型号
    brand = Column(String)  # 品牌
    model = Column(String)  # 型号
    # BMC
    bmc_ip = Column(String)
    bmc_username = Column(String)  # BMC账号
    bmc_password = Column(String)  # BMC密码（明文存储，生产环境建议加密）
    # 系统登录
    system_username = Column(String)  # 系统账号
    system_password = Column(String)  # 系统密码
    # 使用与位置
    user_person = Column(String)  # 使用人
    u_position = Column(String)  # U位
    u_height = Column(Integer)  # U高度
    location = Column(String)  # 位置
    department = Column(String)  # 部门
    # 状态
    status = Column(String, default="offline")  # offline, online, maintenance
    # 合同与日期
    contract_number = Column(String)  # 合同号
    purchase_date = Column(Date)  # 采购日期
    warranty_expire = Column(Date)  # 保修到期
    remark = Column(String)  # 备注
    # 兼容旧字段（可选）
    cpu_model = Column(String)
    cpu_cores = Column(Integer)
    memory_gb = Column(Integer)
    disk_info = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # 关联历史记录
    history_records = relationship("ServerHistory", back_populates="server")
    
    def __repr__(self):
        return f"<Server(id={self.id}, sn='{self.serial_number}', ip='{self.ip_address}', status='{self.status}')>"


class ServerHistory(Base):
    """服务器操作历史记录"""
    __tablename__ = "server_history"
    
    id = Column(Integer, primary_key=True, index=True)
    server_id = Column(Integer, ForeignKey("servers.id"), nullable=True)
    date = Column(DateTime(timezone=True), server_default=func.now())
    action = Column(String, nullable=False)  # 操作类型：创建、编辑、状态变更等
    operator = Column(String, nullable=False)  # 操作人
    remark = Column(Text)  # 备注/详情
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # 关联服务器
    server = relationship("Server", back_populates="history_records")
    
    def __repr__(self):
        return f"<ServerHistory(id={self.id}, server_id={self.server_id}, action='{self.action}')>"