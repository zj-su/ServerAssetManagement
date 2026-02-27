from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime
from app.core.database import get_db
from app.models.ad_config import ADConfig as ADConfigModel
from app.schemas.ad_config import ADConfig, ADConfigCreate, ADConfigUpdate, ADConfigTest, ADConfigTestResponse
from app.utils.security import require_permission

router = APIRouter(prefix="/ad-config", tags=["ad-config"])

@router.get("/", response_model=ADConfig)
def get_ad_config(db: Session = Depends(get_db)):
    """获取AD域配置（单例模式，只返回第一条）"""
    config = db.query(ADConfigModel).first()
    if config is None:
        # 返回默认配置
        return ADConfig(
            id=0,
            enabled=False,
            server=None,
            domain=None,
            base_dn=None,
            bind_user=None,
            bind_password=None,
            user_search_base=None,
            group_search_base=None,
            use_ssl=False,
            use_tls=True,
            description=None,
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
    
    # 不返回密码
    config_dict = {
        "id": config.id,
        "enabled": config.enabled,
        "server": config.server,
        "domain": config.domain,
        "base_dn": config.base_dn,
        "bind_user": config.bind_user,
        "bind_password": None,  # 不返回密码
        "user_search_base": config.user_search_base,
        "group_search_base": config.group_search_base,
        "use_ssl": config.use_ssl,
        "use_tls": config.use_tls,
        "description": config.description,
        "created_at": config.created_at,
        "updated_at": config.updated_at
    }
    return ADConfig(**config_dict)

@router.post("/", response_model=ADConfig)
def create_or_update_ad_config(
    config: ADConfigCreate,
    db: Session = Depends(get_db),
    current_user = Depends(require_permission("role:write"))
):
    """创建或更新AD域配置（单例模式，只保留一条配置）"""
    # 查找现有配置
    existing_config = db.query(ADConfigModel).first()
    
    if existing_config:
        # 更新现有配置
        for key, value in config.dict(exclude_unset=True).items():
            # 前端密码字段留空表示“不修改”，避免把已保存的绑定密码覆盖成空串
            if key == "bind_password" and (value is None or (isinstance(value, str) and value.strip() == "")):
                continue
            setattr(existing_config, key, value)
        db.commit()
        db.refresh(existing_config)
        return existing_config
    else:
        # 创建新配置
        db_config = ADConfigModel(**config.dict())
        db.add(db_config)
        db.commit()
        db.refresh(db_config)
        return db_config

@router.delete("/")
def delete_ad_config(
    db: Session = Depends(get_db),
    current_user = Depends(require_permission("role:write"))
):
    """删除AD域配置"""
    config = db.query(ADConfigModel).first()
    if config:
        db.delete(config)
        db.commit()
    return {"message": "AD域配置已删除"}

@router.post("/test", response_model=ADConfigTestResponse)
def test_ad_config(
    test_data: ADConfigTest,
    db: Session = Depends(get_db)
):
    """测试AD域连接和认证"""
    # 获取AD域配置
    config = db.query(ADConfigModel).filter(ADConfigModel.enabled == True).first()
    
    if not config:
        return ADConfigTestResponse(
            success=False,
            message="AD域未配置或未启用"
        )
    
    try:
        # 尝试导入AD认证工具
        from app.utils.ad_auth import ADAuth
        
        # 创建AD认证实例
        ad_config_dict = {
            'enabled': config.enabled,
            'server': config.server,
            'domain': config.domain,
            'base_dn': config.base_dn,
            'bind_user': config.bind_user,
            'bind_password': config.bind_password,
            'user_search_base': config.user_search_base,
            'group_search_base': config.group_search_base,
            'use_ssl': config.use_ssl,
            'use_tls': config.use_tls
        }
        
        ad_auth = ADAuth(ad_config_dict)
        
        # 测试认证
        user_info = ad_auth.authenticate(test_data.username, test_data.password)
        
        if user_info:
            return ADConfigTestResponse(
                success=True,
                message="AD域连接和认证成功",
                user_info=user_info
            )
        else:
            detail = ad_auth.last_error or "AD域认证失败，请检查用户名和密码"
            return ADConfigTestResponse(
                success=False,
                message=detail
            )
    except ImportError:
        return ADConfigTestResponse(
            success=False,
            message="AD域认证工具未实现"
        )
    except Exception as e:
        return ADConfigTestResponse(
            success=False,
            message=f"AD域连接失败: {str(e)}"
        )
