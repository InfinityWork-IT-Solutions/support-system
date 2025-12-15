from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from app.database import get_db
from app.models import KnowledgeArticle

router = APIRouter(prefix="/api/knowledge", tags=["knowledge"])


class ArticleCreate(BaseModel):
    title: str
    category: Optional[str] = None
    keywords: Optional[str] = None
    content: str


class ArticleUpdate(BaseModel):
    title: Optional[str] = None
    category: Optional[str] = None
    keywords: Optional[str] = None
    content: Optional[str] = None


class ArticleResponse(BaseModel):
    id: int
    title: str
    category: Optional[str]
    keywords: Optional[str]
    content: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


@router.get("/", response_model=List[ArticleResponse])
def get_articles(
    category: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(KnowledgeArticle)
    
    if category:
        query = query.filter(KnowledgeArticle.category == category)
    
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                KnowledgeArticle.title.ilike(search_term),
                KnowledgeArticle.keywords.ilike(search_term),
                KnowledgeArticle.content.ilike(search_term)
            )
        )
    
    return query.order_by(KnowledgeArticle.updated_at.desc()).all()


@router.get("/suggestions")
def get_suggestions(
    category: Optional[str] = Query(None),
    keywords: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(KnowledgeArticle)
    
    if category:
        query = query.filter(KnowledgeArticle.category == category)
    
    if keywords:
        keyword_list = [k.strip().lower() for k in keywords.split(",") if k.strip()]
        if keyword_list:
            conditions = []
            for kw in keyword_list:
                conditions.append(KnowledgeArticle.keywords.ilike(f"%{kw}%"))
                conditions.append(KnowledgeArticle.title.ilike(f"%{kw}%"))
                conditions.append(KnowledgeArticle.content.ilike(f"%{kw}%"))
            query = query.filter(or_(*conditions))
    
    return query.order_by(KnowledgeArticle.updated_at.desc()).limit(5).all()


@router.get("/{article_id}", response_model=ArticleResponse)
def get_article(article_id: int, db: Session = Depends(get_db)):
    article = db.query(KnowledgeArticle).filter(KnowledgeArticle.id == article_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    return article


@router.post("/", response_model=ArticleResponse)
def create_article(data: ArticleCreate, db: Session = Depends(get_db)):
    article = KnowledgeArticle(
        title=data.title,
        category=data.category,
        keywords=data.keywords,
        content=data.content
    )
    db.add(article)
    db.commit()
    db.refresh(article)
    return article


@router.put("/{article_id}", response_model=ArticleResponse)
def update_article(article_id: int, data: ArticleUpdate, db: Session = Depends(get_db)):
    article = db.query(KnowledgeArticle).filter(KnowledgeArticle.id == article_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    
    if data.title is not None:
        article.title = data.title
    if data.category is not None:
        article.category = data.category
    if data.keywords is not None:
        article.keywords = data.keywords
    if data.content is not None:
        article.content = data.content
    
    db.commit()
    db.refresh(article)
    return article


@router.delete("/{article_id}")
def delete_article(article_id: int, db: Session = Depends(get_db)):
    article = db.query(KnowledgeArticle).filter(KnowledgeArticle.id == article_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    
    db.delete(article)
    db.commit()
    return {"status": "deleted"}
