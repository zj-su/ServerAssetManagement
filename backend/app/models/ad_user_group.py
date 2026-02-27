from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, UniqueConstraint
from sqlalchemy.sql import func
from app.core.database import Base


class ADUserGroup(Base):
    __tablename__ = "ad_user_groups"
    __table_args__ = (
        UniqueConstraint("user_id", "group_name", name="uq_ad_user_group_user_group"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    group_name = Column(String, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
