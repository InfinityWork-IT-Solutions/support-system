from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database import get_db
from app.models import TeamMember

router = APIRouter(prefix="/api/team", tags=["team"])


class TeamMemberCreate(BaseModel):
    name: str
    email: str
    role: str = "agent"


class TeamMemberUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None


class TeamMemberResponse(BaseModel):
    id: int
    name: str
    email: str
    role: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


@router.get("/", response_model=List[TeamMemberResponse])
def list_team_members(active_only: bool = False, db: Session = Depends(get_db)):
    query = db.query(TeamMember)
    if active_only:
        query = query.filter(TeamMember.is_active == True)
    return query.order_by(TeamMember.name).all()


@router.get("/{member_id}", response_model=TeamMemberResponse)
def get_team_member(member_id: int, db: Session = Depends(get_db)):
    member = db.query(TeamMember).filter(TeamMember.id == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Team member not found")
    return member


@router.post("/", response_model=TeamMemberResponse)
def create_team_member(request: TeamMemberCreate, db: Session = Depends(get_db)):
    existing = db.query(TeamMember).filter(TeamMember.email == request.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already exists")
    
    member = TeamMember(
        name=request.name,
        email=request.email,
        role=request.role
    )
    db.add(member)
    db.commit()
    db.refresh(member)
    return member


@router.put("/{member_id}", response_model=TeamMemberResponse)
def update_team_member(member_id: int, request: TeamMemberUpdate, db: Session = Depends(get_db)):
    member = db.query(TeamMember).filter(TeamMember.id == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Team member not found")
    
    if request.name is not None:
        member.name = request.name
    if request.email is not None:
        existing = db.query(TeamMember).filter(
            TeamMember.email == request.email,
            TeamMember.id != member_id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email already exists")
        member.email = request.email
    if request.role is not None:
        member.role = request.role
    if request.is_active is not None:
        member.is_active = request.is_active
    
    db.commit()
    db.refresh(member)
    return member


@router.delete("/{member_id}")
def delete_team_member(member_id: int, db: Session = Depends(get_db)):
    member = db.query(TeamMember).filter(TeamMember.id == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Team member not found")
    
    db.delete(member)
    db.commit()
    return {"status": "deleted"}
