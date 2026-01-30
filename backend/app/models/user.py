from sqlalchemy import Column, Integer, String, DateTime, Boolean
from sqlalchemy.sql import func
from app.core.database import Base

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=True)  # AD域用户可为空
    hashed_password = Column(String, nullable=True, default="")  # AD域用户使用空字符串
    role = Column(String, default="user", nullable=False)  # user, admin
    is_ad_user = Column(Boolean, default=False, nullable=False, server_default='0')  # 是否为AD域用户
    ad_dn = Column(String, nullable=True, default=None)  # AD域用户的DN
    display_name = Column(String, nullable=True, default=None)  # 显示名称
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    def __repr__(self):
        return f"<User(id={self.id}, username='{self.username}', email='{self.email}', role='{self.role}', is_ad_user={self.is_ad_user})>"