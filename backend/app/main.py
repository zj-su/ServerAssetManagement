import time
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from app.routes import servers, users, deployments, monitoring, assets, receipts, ad_config, roles, locations
from app.core.database import engine, Base
from app.core.logging_config import setup_logging, get_logger

# 启动时初始化日志（本地环境：控制台 + 项目根目录/logs/idc_asset.log；可通过环境变量 LOG_LEVEL 调整）
import os as _os
_log_level = _os.getenv("LOG_LEVEL", "INFO").strip().upper()
setup_logging(level=_log_level, to_console=True)
logger = get_logger("app.main")

# 创建数据库表
Base.metadata.create_all(bind=engine)

app = FastAPI(title="IDC资产管理系统", version="1.0.0")


@app.middleware("http")
async def log_requests(request: Request, call_next):
    """记录每次请求：方法、路径、状态码、耗时、客户端，便于分析日志"""
    start = time.perf_counter()
    method = request.method
    path = request.url.path
    client = request.client.host if request.client else "-"
    try:
        response = await call_next(request)
        status = response.status_code
        duration_ms = (time.perf_counter() - start) * 1000
        logger.info(
            "请求 | %s %s | 状态=%s | 耗时=%.2f ms | 客户端=%s",
            method, path, status, duration_ms, client,
        )
        return response
    except Exception as e:
        duration_ms = (time.perf_counter() - start) * 1000
        logger.exception(
            "请求异常 | %s %s | 客户端=%s | 耗时=%.2f ms | 错误=%s",
            method, path, client, duration_ms, e,
        )
        raise


# 配置CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 包含路由（批量导入单独挂到 POST /api/v1/import-xxx，避免被 /{id} 路由匹配导致 405）
app.include_router(users.router, prefix="/api/v1")
app.include_router(servers.import_router, prefix="/api/v1")
app.include_router(servers.router, prefix="/api/v1")
app.include_router(deployments.router, prefix="/api/v1")
app.include_router(monitoring.router, prefix="/api/v1")
app.include_router(assets.import_router, prefix="/api/v1")  # 配件批量导入
app.include_router(assets.router, prefix="/api/v1")
app.include_router(receipts.router, prefix="/api/v1")
app.include_router(ad_config.router, prefix="/api/v1")
app.include_router(roles.router, prefix="/api/v1")
app.include_router(locations.router, prefix="/api/v1")

@app.get("/")
def read_root():
    return {"message": "欢迎使用IDC资产管理系统API"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}