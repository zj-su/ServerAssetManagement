from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text
from sqlalchemy.sql import func
from app.core.database import Base

class ADConfig(Base):
    __tablename__ = "ad_config"
    
    id = Column(Integer, primary_key=True, index=True)
    enabled = Column(Boolean, default=False, nullable=False)  # 是否启用AD域
    server = Column(String, nullable=True)  # AD域服务器地址
    domain = Column(String, nullable=True)  # AD域域名
    base_dn = Column(String, nullable=True)  # 基础DN
    bind_user = Column(String, nullable=True)  # 服务账号
    bind_password = Column(String, nullable=True)  # 服务账号密码
    user_search_base = Column(String, nullable=True)  # 用户搜索基础DN
    group_search_base = Column(String, nullable=True)  # 组搜索基础DN
    use_ssl = Column(Boolean, default=False, nullable=False)  # 是否使用SSL
    use_tls = Column(Boolean, default=True, nullable=False)  # 是否使用TLS
    description = Column(Text, nullable=True)  # 配置说明
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    def __repr__(self):
        return f"<ADConfig(id={self.id}, enabled={self.enabled}, server='{self.server}')>"
