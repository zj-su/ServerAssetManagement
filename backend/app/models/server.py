from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.core.database import Base

class Server(Base):
    __tablename__ = "servers"
    
    id = Column(Integer, primary_key=True, index=True)
    hostname = Column(String, index=True, nullable=False)
    ip_address = Column(String, nullable=False)
    mac_address = Column(String, nullable=False)
    bmc_ip = Column(String)
    bmc_username = Column(String)
    bmc_password_encrypted = Column(String)
    cpu_model = Column(String)
    cpu_cores = Column(Integer)
    memory_gb = Column(Integer)
    disk_info = Column(String)  # JSON format storage
    status = Column(String, default="offline")  # offline, online, maintenance
    location = Column(String)  # 机柜位置信息
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    def __repr__(self):
        return f"<Server(id={self.id}, hostname='{self.hostname}', ip='{self.ip_address}', status='{self.status}')>"