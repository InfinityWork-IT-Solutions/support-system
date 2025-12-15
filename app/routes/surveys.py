import secrets
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from pydantic import BaseModel

from app.database import get_db
from app.models import SatisfactionSurvey, Ticket

router = APIRouter(prefix="/api/surveys", tags=["surveys"])


class SurveyResponse(BaseModel):
    id: int
    ticket_id: int
    rating: int
    feedback: Optional[str]
    customer_email: str
    survey_token: str
    sent_at: Optional[datetime]
    completed_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class SurveySubmitRequest(BaseModel):
    rating: int
    feedback: Optional[str] = None


class CreateSurveyRequest(BaseModel):
    ticket_id: int


@router.get("/", response_model=List[SurveyResponse])
def list_surveys(
    completed_only: bool = Query(False),
    db: Session = Depends(get_db)
):
    query = db.query(SatisfactionSurvey)
    if completed_only:
        query = query.filter(SatisfactionSurvey.completed_at.isnot(None))
    surveys = query.order_by(desc(SatisfactionSurvey.created_at)).all()
    return surveys


@router.get("/stats")
def get_survey_stats(db: Session = Depends(get_db)):
    completed_surveys = db.query(SatisfactionSurvey).filter(
        SatisfactionSurvey.completed_at.isnot(None)
    ).all()
    
    total_completed = len(completed_surveys)
    total_sent = db.query(SatisfactionSurvey).filter(
        SatisfactionSurvey.sent_at.isnot(None)
    ).count()
    pending = db.query(SatisfactionSurvey).filter(
        SatisfactionSurvey.sent_at.isnot(None),
        SatisfactionSurvey.completed_at.is_(None)
    ).count()
    
    if total_completed > 0:
        ratings = [s.rating for s in completed_surveys]
        avg_rating = round(sum(ratings) / len(ratings), 2)
        rating_distribution = {}
        for r in range(1, 6):
            rating_distribution[str(r)] = ratings.count(r)
    else:
        avg_rating = 0
        rating_distribution = {"1": 0, "2": 0, "3": 0, "4": 0, "5": 0}
    
    response_rate = round((total_completed / total_sent * 100) if total_sent > 0 else 0, 1)
    
    return {
        "total_sent": total_sent,
        "total_completed": total_completed,
        "pending": pending,
        "average_rating": avg_rating,
        "response_rate": response_rate,
        "rating_distribution": rating_distribution
    }


@router.post("/create")
def create_survey(request: CreateSurveyRequest, db: Session = Depends(get_db)):
    ticket = db.query(Ticket).filter(Ticket.id == request.ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    existing = db.query(SatisfactionSurvey).filter(
        SatisfactionSurvey.ticket_id == request.ticket_id
    ).first()
    if existing:
        return {"status": "exists", "survey_id": existing.id, "token": existing.survey_token}
    
    token = secrets.token_urlsafe(32)
    
    survey = SatisfactionSurvey(
        ticket_id=request.ticket_id,
        customer_email=ticket.sender_email,
        survey_token=token,
        rating=0
    )
    db.add(survey)
    db.commit()
    db.refresh(survey)
    
    return {"status": "created", "survey_id": survey.id, "token": survey.survey_token}


@router.post("/{survey_id}/send")
def mark_survey_sent(survey_id: int, db: Session = Depends(get_db)):
    survey = db.query(SatisfactionSurvey).filter(SatisfactionSurvey.id == survey_id).first()
    if not survey:
        raise HTTPException(status_code=404, detail="Survey not found")
    
    survey.sent_at = datetime.utcnow()
    db.commit()
    
    return {"status": "sent"}


@router.get("/submit/{token}")
def get_survey_by_token(token: str, db: Session = Depends(get_db)):
    survey = db.query(SatisfactionSurvey).filter(
        SatisfactionSurvey.survey_token == token
    ).first()
    if not survey:
        raise HTTPException(status_code=404, detail="Survey not found")
    
    ticket = db.query(Ticket).filter(Ticket.id == survey.ticket_id).first()
    
    return {
        "survey_id": survey.id,
        "ticket_subject": ticket.subject if ticket else "Unknown",
        "already_completed": survey.completed_at is not None
    }


@router.post("/submit/{token}")
def submit_survey(token: str, request: SurveySubmitRequest, db: Session = Depends(get_db)):
    survey = db.query(SatisfactionSurvey).filter(
        SatisfactionSurvey.survey_token == token
    ).first()
    if not survey:
        raise HTTPException(status_code=404, detail="Survey not found")
    
    if survey.completed_at:
        raise HTTPException(status_code=400, detail="Survey already completed")
    
    if request.rating < 1 or request.rating > 5:
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 5")
    
    survey.rating = request.rating
    survey.feedback = request.feedback
    survey.completed_at = datetime.utcnow()
    db.commit()
    
    return {"status": "submitted", "message": "Thank you for your feedback!"}


@router.delete("/{survey_id}")
def delete_survey(survey_id: int, db: Session = Depends(get_db)):
    survey = db.query(SatisfactionSurvey).filter(SatisfactionSurvey.id == survey_id).first()
    if not survey:
        raise HTTPException(status_code=404, detail="Survey not found")
    
    db.delete(survey)
    db.commit()
    
    return {"status": "deleted"}
