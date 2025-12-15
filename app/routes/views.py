from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database import get_db
from app.models import SavedView

router = APIRouter(prefix="/api/views", tags=["views"])


class SavedViewRequest(BaseModel):
    name: str
    status: Optional[str] = None
    category: Optional[str] = None
    urgency: Optional[str] = None
    search: Optional[str] = None
    sla_breached: Optional[bool] = None
    assigned_to: Optional[int] = None
    is_default: bool = False


class SavedViewResponse(BaseModel):
    id: int
    name: str
    status: Optional[str]
    category: Optional[str]
    urgency: Optional[str]
    search: Optional[str]
    sla_breached: Optional[bool]
    assigned_to: Optional[int]
    is_default: bool
    sort_order: int

    class Config:
        from_attributes = True


@router.get("/", response_model=List[SavedViewResponse])
def list_saved_views(db: Session = Depends(get_db)):
    views = db.query(SavedView).order_by(SavedView.sort_order, SavedView.name).all()
    return views


@router.post("/", response_model=SavedViewResponse)
def create_saved_view(request: SavedViewRequest, db: Session = Depends(get_db)):
    if request.is_default:
        db.query(SavedView).filter(SavedView.is_default == True).update({"is_default": False})
    
    max_order = db.query(SavedView).count()
    
    view = SavedView(
        name=request.name,
        status=request.status,
        category=request.category,
        urgency=request.urgency,
        search=request.search,
        sla_breached=request.sla_breached,
        assigned_to=request.assigned_to,
        is_default=request.is_default,
        sort_order=max_order
    )
    db.add(view)
    db.commit()
    db.refresh(view)
    return view


@router.get("/{view_id}", response_model=SavedViewResponse)
def get_saved_view(view_id: int, db: Session = Depends(get_db)):
    view = db.query(SavedView).filter(SavedView.id == view_id).first()
    if not view:
        raise HTTPException(status_code=404, detail="View not found")
    return view


@router.put("/{view_id}", response_model=SavedViewResponse)
def update_saved_view(view_id: int, request: SavedViewRequest, db: Session = Depends(get_db)):
    view = db.query(SavedView).filter(SavedView.id == view_id).first()
    if not view:
        raise HTTPException(status_code=404, detail="View not found")
    
    if request.is_default and not view.is_default:
        db.query(SavedView).filter(SavedView.is_default == True).update({"is_default": False})
    
    view.name = request.name
    view.status = request.status
    view.category = request.category
    view.urgency = request.urgency
    view.search = request.search
    view.sla_breached = request.sla_breached
    view.assigned_to = request.assigned_to
    view.is_default = request.is_default
    
    db.commit()
    db.refresh(view)
    return view


@router.delete("/{view_id}")
def delete_saved_view(view_id: int, db: Session = Depends(get_db)):
    view = db.query(SavedView).filter(SavedView.id == view_id).first()
    if not view:
        raise HTTPException(status_code=404, detail="View not found")
    
    db.delete(view)
    db.commit()
    return {"status": "deleted"}


@router.get("/quick-filters/list")
def get_quick_filters():
    return [
        {"id": "all", "name": "All Tickets", "filters": {}},
        {"id": "pending", "name": "Pending Review", "filters": {"status": "PENDING"}},
        {"id": "approved", "name": "Approved", "filters": {"status": "APPROVED"}},
        {"id": "urgent", "name": "High Urgency", "filters": {"urgency": "High"}},
        {"id": "sla_breach", "name": "SLA Breached", "filters": {"sla_breached": True}},
        {"id": "unassigned", "name": "Unassigned", "filters": {"assigned_to": None}},
    ]
