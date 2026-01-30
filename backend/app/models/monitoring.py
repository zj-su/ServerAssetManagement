from sqlalchemy import Column, Integer, String, DateTime, Float, ForeignKey
from sqlalchemy.sql import func
from app.core.database import Base

class MonitoringData(Base):
    __tablename__ = "monitoring_data"
    
    id = Column(Integer, primary_key=True, index=True)
    server_id = Column(Integer, ForeignKey("servers.id"), nullable=False)
    cpu_usage = Column(Float)
    memory_usage = Column(Float)
    disk_usage = Column(String)  # JSON format storage
    network_usage = Column(String)  # JSON format storage
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    
    def __repr__(self):
        return f"<MonitoringData(id={self.id}, server_id={self.server_id}, timestamp='{self.timestamp}')>"