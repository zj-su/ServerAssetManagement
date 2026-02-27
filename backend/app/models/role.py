import json
from sqlalchemy import Column, Integer, String, Text, DateTime
from sqlalchemy.sql import func
from app.core.database import Base


class Role(Base):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    description = Column(String, nullable=True)
    permissions = Column(Text, nullable=False, default="[]")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    def get_permissions(self):
        try:
            data = json.loads(self.permissions or "[]")
            return data if isinstance(data, list) else []
        except Exception:
            return []

    def set_permissions(self, values):
        self.permissions = json.dumps(values or [], ensure_ascii=False)
