from pydantic import BaseModel
from typing import Any, Dict, List, Optional


class ProjectCreate(BaseModel):
    name: str
    timezone: str = "America/Chicago"


class ProjectOut(BaseModel):
    id: int
    name: str
    timezone: str

    class Config:
        from_attributes = True


class UploadOut(BaseModel):
    id: int
    project_id: int
    kind: str
    filename: str
    stored_path: str

    class Config:
        from_attributes = True


class Driver(BaseModel):
    factor: str
    value: float
    points: int


class RiskScore(BaseModel):
    risk_score: int
    risk_band: str
    drivers: List[Driver] = []


class WeeklyStoredResult(BaseModel):
    project_id: int
    week_start: str
    metrics: Dict[str, Any]
    score: RiskScore


class PortfolioRow(BaseModel):
    project_id: int
    project_name: str
    week_start: str
    risk_score: int
    risk_band: str
    drivers: List[Driver]