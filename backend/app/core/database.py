from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from .config import settings

# 创建数据库引擎
engine = create_engine(
    settings.SQLALCHEMY_DATABASE_URI,
    connect_args={"check_same_thread": False} if "sqlite" in settings.SQLALCHEMY_DATABASE_URI else {}
)

# 创建SessionLocal类
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 创建Base类
Base = declarative_base()

# 获取数据库session的依赖项
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()