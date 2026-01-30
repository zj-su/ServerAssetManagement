from celery import Celery
from .core.config import settings

# 创建Celery实例
celery = Celery(
    "server_management_worker",
    broker="redis://redis:6379/0",
    backend="redis://redis:6379/0"
)

# 配置Celery
celery.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    result_expires=3600,  # 结果过期时间（秒）
)

# 自动发现任务
celery.autodiscover_tasks(["app.tasks"])

@celery.task
def test_task():
    """测试任务"""
    return "Hello from Celery!"

@celery.task
def deploy_server_task(server_id: int, os_image: str):
    """部署服务器任务"""
    # 这里应该是实际的部署逻辑
    # 例如：通过PXE启动服务器并安装操作系统
    print(f"正在部署服务器 {server_id} 使用镜像 {os_image}")
    return f"服务器 {server_id} 部署完成"