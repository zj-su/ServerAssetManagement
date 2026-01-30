from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.core.database import Base

class DeploymentTask(Base):
    __tablename__ = "deployment_tasks"
    
    id = Column(Integer, primary_key=True, index=True)
    server_id = Column(Integer, ForeignKey("servers.id"), nullable=False)
    os_image = Column(String, nullable=False)
    status = Column(String, default="pending")  # pending, running, completed, failed
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    log = Column(String)
    
    def __repr__(self):
        return f"<DeploymentTask(id={self.id}, server_id={self.server_id}, os_image='{self.os_image}', status='{self.status}')>"