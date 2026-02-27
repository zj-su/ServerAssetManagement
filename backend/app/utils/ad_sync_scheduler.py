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
from app.models.ad_user_group import ADUserGroup as ADUserGroupModel
from app.models.ad_config import ADConfig as ADConfigModel
from app.utils.ad_auth import ADAuth

logger = logging.getLogger(__name__)

scheduler = BackgroundScheduler()


def _build_unique_ad_email(db: Session, username: str, candidate_email: str, current_user_id=None) -> str:
    raw = (candidate_email or "").strip()
    if raw in ("", "[]", "None", "null"):
        raw = ""
    base = raw or f"{username}@ad.local"

    local, at, domain = base.partition("@")
    if not at:
        local = local or username
        domain = "ad.local"
    local = local or username
    domain = domain or "ad.local"

    email = f"{local}@{domain}"
    idx = 1
    while True:
        exists = db.query(UserModel).filter(UserModel.email == email).first()
        if not exists or (current_user_id is not None and exists.id == current_user_id):
            return email
        idx += 1
        email = f"{local}.{idx}@{domain}"

def sync_all_ad_users_job():
    """定时任务：同步所有AD域用户"""
    db: Session = SessionLocal()
    try:
        # 获取AD域配置
        ad_config = db.query(ADConfigModel).filter(ADConfigModel.enabled == True).first()
        
        if not ad_config:
            logger.info("AD域未配置或未启用，跳过同步")
            return {"total": 0, "created": 0, "updated": 0, "groups": 0}
        
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
        
        logger.info("AD域用户同步任务执行中...")

        ad_users = ad_auth.list_all_users()
        if not ad_users:
            logger.info("未从AD获取到可同步用户")
            return {"total": 0, "created": 0, "updated": 0}

        created = 0
        updated = 0
        group_rows = 0

        # 全量重建 AD 用户组快照
        db.query(ADUserGroupModel).delete()
        for ad_user_info in ad_users:
            username = (ad_user_info.get("username") or "").strip()
            if not username:
                continue
            db_user = db.query(UserModel).filter(UserModel.username == username).first()
            ad_email = _build_unique_ad_email(db, username, ad_user_info.get("email"))
            if not db_user:
                db_user = UserModel(
                    username=username,
                    email=ad_email,
                    hashed_password="",
                    role="user",
                    is_ad_user=True,
                    ad_dn=ad_user_info.get("dn"),
                    display_name=ad_user_info.get("display_name") or username,
                )
                db.add(db_user)
                db.flush()
                created += 1
            else:
                db_user.is_ad_user = True
                db_user.email = _build_unique_ad_email(
                    db,
                    db_user.username,
                    ad_user_info.get("email") or db_user.email,
                    current_user_id=db_user.id,
                )
                db_user.ad_dn = ad_user_info.get("dn")
                db_user.display_name = ad_user_info.get("display_name") or db_user.display_name
                updated += 1

            groups = ad_user_info.get("groups") or []
            for group_name in groups:
                name = (group_name or "").strip()
                if not name:
                    continue
                db.add(ADUserGroupModel(user_id=db_user.id, group_name=name))
                group_rows += 1

        db.commit()
        logger.info(f"AD用户同步完成，总计={len(ad_users)}，新增={created}，更新={updated}，组关系={group_rows}")
        return {"total": len(ad_users), "created": created, "updated": updated, "groups": group_rows}
    except Exception as e:
        err_msg = str(e) or repr(e) or "未知错误"
        logger.error(f"AD域用户同步失败：{err_msg}", exc_info=True)
        return {"total": 0, "created": 0, "updated": 0, "error": err_msg}
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
