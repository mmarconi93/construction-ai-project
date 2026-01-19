from sqlalchemy import Column, DateTime, Integer, String, Text, ForeignKey, JSON
from sqlalchemy.sql import func
from .db import Base

class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    timezone = Column(String(64), nullable=False, default="America/Chicago")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Upload(Base):
    __tablename__ = "uploads"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    kind = Column(String(50), nullable=False)  # rfis/submittals/schedule
    filename = Column(String(512), nullable=False)
    stored_path = Column(Text, nullable=False)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())

class ProjectWeekMetric(Base):
    __tablename__ = "project_week_metrics"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    week_start = Column(String(10), nullable=False)  # YYYY-MM-DD
    metrics_json = Column(JSON, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class RiskScoreRow(Base):
    __tablename__ = "risk_scores"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    week_start = Column(String(10), nullable=False)
    risk_score = Column(Integer, nullable=False)
    risk_band = Column(String(10), nullable=False)
    drivers_json = Column(JSON, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())