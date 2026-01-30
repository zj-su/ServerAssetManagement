from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import servers, users, deployments, monitoring, assets, receipts, ad_config
from app.core.database import engine, Base

# 创建数据库表
Base.metadata.create_all(bind=engine)

app = FastAPI(title="IDC资产管理系统", version="1.0.0")

# 配置CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 包含路由
app.include_router(users.router, prefix="/api/v1")
app.include_router(servers.router, prefix="/api/v1")
app.include_router(deployments.router, prefix="/api/v1")
app.include_router(monitoring.router, prefix="/api/v1")
app.include_router(assets.router, prefix="/api/v1")
app.include_router(receipts.router, prefix="/api/v1")
app.include_router(ad_config.router, prefix="/api/v1")

@app.get("/")
def read_root():
    return {"message": "欢迎使用IDC资产管理系统API"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}