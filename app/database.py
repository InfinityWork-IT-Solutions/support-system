"""
Database Connection Module
==========================
This module sets up the PostgreSQL database connection for the AI Support Desk.

It uses SQLAlchemy as the ORM (Object-Relational Mapper) to interact with the database.
SQLAlchemy allows us to work with Python objects instead of writing raw SQL queries.

HOW IT WORKS:
1. The DATABASE_URL environment variable contains the connection string
2. We create an "engine" - the connection pool to the database
3. We create a "SessionLocal" - a factory for database sessions
4. Routes use the "get_db" function to get a session for each request

REQUIRED ENVIRONMENT VARIABLE:
- DATABASE_URL: PostgreSQL connection string
  Format: postgresql://username:password@host:port/database_name
  Example: postgresql://user:pass@localhost:5432/supportdesk

TROUBLESHOOTING:
- "DATABASE_URL environment variable is required": Set the DATABASE_URL env var
- Connection errors: Check that PostgreSQL is running and credentials are correct
- "Too many connections": The connection pool may be exhausted; check for leaked connections
"""

import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# Load environment variables from .env file if it exists
load_dotenv()

# Get the database connection URL from environment variables
# This MUST be set for the application to start
DATABASE_URL = os.environ.get("DATABASE_URL")

if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable is required. Please configure your PostgreSQL database.")

# Create the SQLAlchemy engine
# The engine manages a pool of database connections
engine = create_engine(
    DATABASE_URL,
    # pool_recycle: Close and replace connections after 5 minutes (300 seconds)
    # This prevents errors from stale connections that the database has closed
    pool_recycle=300,
    # pool_pre_ping: Test connections before using them
    # This automatically handles connections that have gone stale
    pool_pre_ping=True,
)

# Create a session factory
# Each request gets its own session for database operations
# autocommit=False: We explicitly control when changes are committed
# autoflush=False: We explicitly control when changes are flushed to the DB
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for all database models
# All models in models.py inherit from this Base class
# This allows SQLAlchemy to track all tables and create them automatically
Base = declarative_base()


def get_db():
    """
    Dependency injection function for database sessions.
    
    This function is used with FastAPI's Depends() to provide
    a database session to route handlers. It ensures that:
    1. Each request gets a fresh database session
    2. The session is properly closed after the request completes
    3. Resources are not leaked even if an error occurs
    
    Usage in routes:
        @router.get("/items")
        def get_items(db: Session = Depends(get_db)):
            return db.query(Item).all()
    
    The "yield" keyword makes this a generator, which allows FastAPI
    to execute cleanup code (db.close()) after the request is done.
    
    Yields:
        Session: A SQLAlchemy database session
        
    TROUBLESHOOTING:
    - If you see "Session is already closed" errors, a route may be
      trying to use the session after the request has finished
    - For background tasks, create a new session instead of using get_db
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        # Always close the session, even if an error occurred
        db.close()
