from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import json

from app.core.database import get_db
from app.models.role import Role as RoleModel
from app.schemas.role import Role, RoleCreate, RoleUpdate
from app.utils.security import require_permission

router = APIRouter(prefix="/roles", tags=["roles"])


DEFAULT_ROLES = [
    {
        "name": "admin",
        "description": "管理员",
        "permissions": ["*"],
    },
    {
        "name": "user",
        "description": "普通用户",
        "permissions": ["server:read", "part:read", "receipt:read", "scrap:read"],
    },
]


def ensure_default_roles(db: Session):
    for item in DEFAULT_ROLES:
        exists = db.query(RoleModel).filter(RoleModel.name == item["name"]).first()
        if not exists:
            row = RoleModel(
                name=item["name"],
                description=item["description"],
                permissions=json.dumps(item["permissions"], ensure_ascii=False),
            )
            db.add(row)
    db.commit()


def to_schema(row: RoleModel) -> Role:
    return Role(
        id=row.id,
        name=row.name,
        description=row.description,
        permissions=row.get_permissions(),
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


@router.get("/", response_model=List[Role])
def get_roles(
    db: Session = Depends(get_db),
    current_user=Depends(require_permission("role:read")),
):
    ensure_default_roles(db)
    rows = db.query(RoleModel).order_by(RoleModel.id.asc()).all()
    return [to_schema(r) for r in rows]


@router.get("/{role_id}", response_model=Role)
def get_role(
    role_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_permission("role:read")),
):
    ensure_default_roles(db)
    row = db.query(RoleModel).filter(RoleModel.id == role_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="角色不存在")
    return to_schema(row)


@router.post("/", response_model=Role)
def create_role(
    payload: RoleCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_permission("role:write")),
):
    ensure_default_roles(db)
    exists = db.query(RoleModel).filter(RoleModel.name == payload.name).first()
    if exists:
        raise HTTPException(status_code=400, detail="角色名称已存在")
    row = RoleModel(
        name=payload.name,
        description=payload.description,
        permissions=json.dumps(payload.permissions or [], ensure_ascii=False),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return to_schema(row)


@router.put("/{role_id}", response_model=Role)
def update_role(
    role_id: int,
    payload: RoleUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_permission("role:write")),
):
    ensure_default_roles(db)
    row = db.query(RoleModel).filter(RoleModel.id == role_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="角色不存在")
    if row.name == "admin":
        raise HTTPException(status_code=400, detail="admin 角色不允许修改")

    data = payload.dict(exclude_unset=True)
    if "name" in data:
        exists = db.query(RoleModel).filter(RoleModel.name == data["name"], RoleModel.id != role_id).first()
        if exists:
            raise HTTPException(status_code=400, detail="角色名称已存在")
        row.name = data["name"]
    if "description" in data:
        row.description = data["description"]
    if "permissions" in data:
        row.permissions = json.dumps(data["permissions"] or [], ensure_ascii=False)

    db.commit()
    db.refresh(row)
    return to_schema(row)


@router.delete("/{role_id}")
def delete_role(
    role_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_permission("role:delete")),
):
    ensure_default_roles(db)
    row = db.query(RoleModel).filter(RoleModel.id == role_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="角色不存在")
    if row.name in ("admin", "user"):
        raise HTTPException(status_code=400, detail="系统内置角色不允许删除")
    db.delete(row)
    db.commit()
    return {"message": "角色删除成功"}
