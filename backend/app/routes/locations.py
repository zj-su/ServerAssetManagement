from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from app.core.database import get_db
from app.models.location import Location as LocationModel
from app.schemas.location import Location, LocationCreate, LocationUpdate
from app.utils.security import require_permission

router = APIRouter(prefix="/locations", tags=["locations"])


@router.get("/", response_model=List[Location])
def get_locations(
    query: Optional[str] = Query(None, description="按位置名称/地址模糊搜索"),
    skip: int = 0,
    limit: int = 200,
    db: Session = Depends(get_db),
    current_user=Depends(require_permission("server:read")),
):
    q = db.query(LocationModel)
    if query:
        keyword = f"%{query.strip()}%"
        q = q.filter(
            LocationModel.name.ilike(keyword) |
            LocationModel.address.ilike(keyword)
        )
    return q.order_by(LocationModel.id.desc()).offset(skip).limit(limit).all()


@router.get("/count")
def get_locations_count(
    query: Optional[str] = Query(None, description="按位置名称/地址模糊搜索"),
    db: Session = Depends(get_db),
    current_user=Depends(require_permission("server:read")),
):
    q = db.query(LocationModel)
    if query:
        keyword = f"%{query.strip()}%"
        q = q.filter(
            LocationModel.name.ilike(keyword) |
            LocationModel.address.ilike(keyword)
        )
    return {"total": q.count()}


@router.post("/", response_model=Location)
def create_location(
    payload: LocationCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_permission("server:write")),
):
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="位置名称不能为空")

    exists = db.query(LocationModel).filter(LocationModel.name == name).first()
    if exists:
        raise HTTPException(status_code=400, detail="位置名称已存在")

    row = LocationModel(
        name=name,
        address=(payload.address or "").strip() or None,
        description=(payload.description or "").strip() or None,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.put("/{location_id}", response_model=Location)
def update_location(
    location_id: int,
    payload: LocationUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_permission("server:write")),
):
    row = db.query(LocationModel).filter(LocationModel.id == location_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="位置不存在")

    data = payload.dict(exclude_unset=True)
    if "name" in data:
        new_name = (data["name"] or "").strip()
        if not new_name:
            raise HTTPException(status_code=400, detail="位置名称不能为空")
        dup = db.query(LocationModel).filter(
            LocationModel.name == new_name,
            LocationModel.id != location_id
        ).first()
        if dup:
            raise HTTPException(status_code=400, detail="位置名称已存在")
        row.name = new_name

    if "address" in data:
        row.address = (data["address"] or "").strip() or None
    if "description" in data:
        row.description = (data["description"] or "").strip() or None

    db.commit()
    db.refresh(row)
    return row


@router.delete("/{location_id}")
def delete_location(
    location_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_permission("server:delete")),
):
    row = db.query(LocationModel).filter(LocationModel.id == location_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="位置不存在")
    db.delete(row)
    db.commit()
    return {"message": "位置删除成功"}
