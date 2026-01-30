"""
AD域用户自动同步调度器
使用APScheduler定时同步AD域用户到本地数据库
"""
import logging
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models.user import User as UserModel
from app.models.ad_config import ADConfig as ADConfigModel
from app.utils.ad_auth import ADAuth

logger = logging.getLogger(__name__)

scheduler = BackgroundScheduler()

def sync_all_ad_users_job():
    """定时任务：同步所有AD域用户"""
    db: Session = SessionLocal()
    try:
        # 获取AD域配置
        ad_config = db.query(ADConfigModel).filter(ADConfigModel.enabled == True).first()
        
        if not ad_config:
            logger.info("AD域未配置或未启用，跳过同步")
            return
        
        # 创建AD认证实例
        ad_config_dict = {
            'enabled': ad_config.enabled,
            'server': ad_config.server,
            'domain': ad_config.domain,
            'base_dn': ad_config.base_dn,
            'bind_user': ad_config.bind_user,
            'bind_password': ad_config.bind_password,
            'user_search_base': ad_config.user_search_base,
            'group_search_base': ad_config.group_search_base,
            'use_ssl': ad_config.use_ssl,
            'use_tls': ad_config.use_tls
        }
        
        ad_auth = ADAuth(ad_config_dict)
        
        # 这里应该实现批量同步逻辑
        # 由于需要LDAP搜索所有用户，这里只提供框架
        logger.info("AD域用户同步任务执行中...")
        
        # TODO: 实现批量同步逻辑
        # 1. 使用服务账号连接AD域
        # 2. 搜索所有用户
        # 3. 创建或更新本地用户记录
        
    except Exception as e:
        logger.error(f"AD域用户同步失败：{str(e)}", exc_info=True)
    finally:
        db.close()

def start_ad_sync_scheduler():
    """启动AD域用户自动同步调度器"""
    if not scheduler.running:
        # 每小时执行一次
        scheduler.add_job(
            sync_all_ad_users_job,
            trigger=CronTrigger(minute=0),  # 每小时的第0分钟执行
            id='sync_ad_users',
            name='同步AD域用户',
            replace_existing=True
        )
        scheduler.start()
        logger.info("AD域用户自动同步调度器已启动（每小时执行一次）")

def stop_ad_sync_scheduler():
    """停止AD域用户自动同步调度器"""
    if scheduler.running:
        scheduler.shutdown()
        logger.info("AD域用户自动同步调度器已停止")
