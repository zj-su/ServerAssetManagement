import os
from typing import List, Union
from pydantic import AnyHttpUrl, validator
try:
    from pydantic_settings import BaseSettings
except ImportError:
    # 兼容旧版本pydantic
    from pydantic import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "IDC资产管理系统"
    API_V1_STR: str = "/api/v1"
    
    # 数据库配置 - 使用SQLite作为本地开发数据库
    SQLALCHEMY_DATABASE_URI: str = os.getenv("DATABASE_URL", "sqlite:///./server_management.db")
    
    # JWT配置
    SECRET_KEY: str = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8  # 8 days
    
    # CORS配置
    BACKEND_CORS_ORIGINS: List[AnyHttpUrl] = []
    
    @validator("BACKEND_CORS_ORIGINS", pre=True)
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> Union[List[str], str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, (list, str)):
            return v
        raise ValueError(v)

    class Config:
        case_sensitive = True
        env_file = ".env"

settings = Settings()