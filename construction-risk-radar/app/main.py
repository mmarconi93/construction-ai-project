from fastapi import FastAPI, Request, UploadFile, File, HTTPException, Depends, Form
from fastapi.responses import HTMLResponse, Response, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import select, func

from datetime import datetime, timedelta
from pathlib import Path
import shutil
import pandas as pd

from .db import get_db, engine, Base
from .models import Project, Upload, ProjectWeekMetric, RiskScoreRow

from .ingest.parse_rfis import parse_rfis_csv
from .ingest.parse_submittals import parse_submittals_csv
from .ingest.parse_schedule import parse_schedule_csv
from .ingest.errors import ParseError

from .compute.week_metrics import compute_week_metrics
from .compute.risk_score_rules import score_from_metrics
from .report.render_html import render_weekly_report_html
from .report.render_html import render_portfolio_report_html

from .schemas import (
    ProjectCreate,
    ProjectOut,
    UploadOut,
)

app = FastAPI(title="Construction Risk Radar", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        # later:
        # "https://your-vercel-app.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_DIR = Path("data").resolve()


@app.on_event("startup")
def startup():
    # Simple mode for now: auto-create tables. Later we switch to Alembic migrations.
    Base.metadata.create_all(bind=engine)
    DATA_DIR.mkdir(parents=True, exist_ok=True)


@app.get("/favicon.ico")
def favicon():
    return Response(status_code=204)


@app.get("/health")
def health():
    return {"ok": True}


def _parse_week_start(week_start: str) -> datetime:
    try:
        return datetime.fromisoformat(week_start)
    except ValueError:
        raise HTTPException(status_code=400, detail="week_start must be ISO format YYYY-MM-DD")


def _read_csv(upload: UploadFile, label: str) -> pd.DataFrame:
    try:
        upload.file.seek(0)
        return pd.read_csv(upload.file)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read {label} CSV '{upload.filename}': {e}")


def _ensure_df(df, label: str) -> pd.DataFrame:
    if df is None:
        raise HTTPException(status_code=400, detail=f"{label} parser returned None (missing return?)")
    if not isinstance(df, pd.DataFrame):
        raise HTTPException(status_code=400, detail=f"{label} parser returned {type(df)} not a DataFrame")
    if df.empty:
        raise HTTPException(status_code=400, detail=f"{label} DataFrame is empty after parsing")
    return df


def _project_week_dir(project_id: int, week_start: str) -> Path:
    return (DATA_DIR / str(project_id) / week_start).resolve()


def _save_upload_to_disk(project_id: int, week_start: str, kind: str, upload: UploadFile) -> Path:
    wkdir = _project_week_dir(project_id, week_start)
    wkdir.mkdir(parents=True, exist_ok=True)

    # Standardize filenames by kind
    if kind not in ("rfis", "submittals", "schedule"):
        raise HTTPException(status_code=400, detail="kind must be one of: rfis, submittals, schedule")

    dest = wkdir / f"{kind}.csv"

    upload.file.seek(0)
    with dest.open("wb") as f:
        shutil.copyfileobj(upload.file, f)

    return dest


def _load_kind_csv(project_id: int, week_start: str, kind: str) -> pd.DataFrame:
    path = _project_week_dir(project_id, week_start) / f"{kind}.csv"
    if not path.exists():
        raise HTTPException(status_code=400, detail=f"Missing required upload: {kind}.csv for project={project_id} week={week_start}")
    try:
        return pd.read_csv(path)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read stored {kind}.csv at {path}: {e}")


def _has_required_uploads(project_id: int, week_start: str) -> tuple[bool, list[str]]:
    missing = []
    wkdir = _project_week_dir(project_id, week_start)
    for kind in ("rfis", "submittals", "schedule"):
        if not (wkdir / f"{kind}.csv").exists():
            missing.append(f"{kind}.csv")
    return (len(missing) == 0, missing)


# ----------------------------
# Projects
# ----------------------------

@app.post("/v1/projects", response_model=ProjectOut)
def create_project(payload: ProjectCreate, db: Session = Depends(get_db)):
    p = Project(name=payload.name, timezone=payload.timezone)
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


@app.get("/v1/projects", response_model=list[ProjectOut])
def list_projects(db: Session = Depends(get_db)):
    rows = db.execute(select(Project).order_by(Project.id)).scalars().all()
    return rows


# ----------------------------
# Uploads
# ----------------------------

@app.post("/v1/projects/{project_id}/uploads", response_model=UploadOut)
async def upload_project_file(
    project_id: int,
    kind: str = Form(...),  # rfis/submittals/schedule
    week_start: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    # Ensure project exists
    p = db.get(Project, project_id)
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")

    # Validate week_start
    _ = _parse_week_start(week_start)

    stored_path = _save_upload_to_disk(project_id, week_start, kind, file)

    row = Upload(
        project_id=project_id,
        kind=kind,
        filename=file.filename or f"{kind}.csv",
        stored_path=str(stored_path),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


# ----------------------------
# Run weekly compute + store
# ----------------------------

@app.post("/v1/projects/{project_id}/run-weekly")
def run_weekly(
    project_id: int,
    week_start: str = Form(...),
    db: Session = Depends(get_db),
):
    p = db.get(Project, project_id)
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")

    week_start_dt = _parse_week_start(week_start)
    week_end_dt = week_start_dt + timedelta(days=7)

    # Load stored CSVs
    rfis_raw = _load_kind_csv(project_id, week_start, "rfis")
    submittals_raw = _load_kind_csv(project_id, week_start, "submittals")
    schedule_raw = _load_kind_csv(project_id, week_start, "schedule")

    # Parse/normalize
    rfis_df = _ensure_df(parse_rfis_csv(rfis_raw), "rfis")
    submittals_df = _ensure_df(parse_submittals_csv(submittals_raw), "submittals")
    schedule_df = _ensure_df(parse_schedule_csv(schedule_raw), "schedule")

    # Compute + score
    metrics = compute_week_metrics(rfis_df, submittals_df, schedule_df, week_start_dt, week_end_dt)
    score = score_from_metrics(metrics)

    # Upsert-ish: delete existing for that project/week to keep it simple
    existing_m = db.execute(
        select(ProjectWeekMetric).where(
            ProjectWeekMetric.project_id == project_id,
            ProjectWeekMetric.week_start == week_start,
        )
    ).scalars().all()
    for r in existing_m:
        db.delete(r)

    existing_s = db.execute(
        select(RiskScoreRow).where(
            RiskScoreRow.project_id == project_id,
            RiskScoreRow.week_start == week_start,
        )
    ).scalars().all()
    for r in existing_s:
        db.delete(r)

    db.commit()

    mrow = ProjectWeekMetric(
        project_id=project_id,
        week_start=week_start,
        metrics_json=metrics,
    )
    srow = RiskScoreRow(
        project_id=project_id,
        week_start=week_start,
        risk_score=int(score["risk_score"]),
        risk_band=str(score["risk_band"]),
        drivers_json=score["drivers"],
    )
    db.add(mrow)
    db.add(srow)
    db.commit()

    return {
        "project_id": project_id,
        "week_start": week_start,
        "metrics": metrics,
        "score": score,
    }


@app.post("/v1/run-all")
def run_all_projects(
    week_start: str = Form(...),
    db: Session = Depends(get_db),
):
    week_start_dt = _parse_week_start(week_start)
    week_end_dt = week_start_dt + timedelta(days=7)

    projects = db.execute(select(Project).order_by(Project.id)).scalars().all()

    results = []
    for p in projects:
        ok, missing = _has_required_uploads(p.id, week_start)
        if not ok:
            results.append({
                "project_id": p.id,
                "project_name": p.name,
                "status": "skipped",
                "reason": "missing_uploads",
                "missing": missing,
            })
            continue

        try:
            # Load stored CSVs
            rfis_raw = _load_kind_csv(p.id, week_start, "rfis")
            submittals_raw = _load_kind_csv(p.id, week_start, "submittals")
            schedule_raw = _load_kind_csv(p.id, week_start, "schedule")

            # Parse/normalize (only this part gets ParseError special handling)
            try:
                rfis_df = _ensure_df(parse_rfis_csv(rfis_raw), "rfis")
                submittals_df = _ensure_df(parse_submittals_csv(submittals_raw), "submittals")
                schedule_df = _ensure_df(parse_schedule_csv(schedule_raw), "schedule")
            except ParseError as e:
                results.append({
                    "project_id": p.id,
                    "project_name": p.name,
                    "status": "error",
                    "error_type": "parse_error",
                    "detail": e.to_dict(),
                })
                continue

            # Compute + score
            metrics = compute_week_metrics(rfis_df, submittals_df, schedule_df, week_start_dt, week_end_dt)
            score = score_from_metrics(metrics)

            # Delete existing rows for that project/week (simple upsert)
            existing_m = db.execute(
                select(ProjectWeekMetric).where(
                    ProjectWeekMetric.project_id == p.id,
                    ProjectWeekMetric.week_start == week_start,
                )
            ).scalars().all()
            for r in existing_m:
                db.delete(r)

            existing_s = db.execute(
                select(RiskScoreRow).where(
                    RiskScoreRow.project_id == p.id,
                    RiskScoreRow.week_start == week_start,
                )
            ).scalars().all()
            for r in existing_s:
                db.delete(r)

            db.commit()

            mrow = ProjectWeekMetric(project_id=p.id, week_start=week_start, metrics_json=metrics)
            srow = RiskScoreRow(
                project_id=p.id,
                week_start=week_start,
                risk_score=int(score["risk_score"]),
                risk_band=str(score["risk_band"]),
                drivers_json=score["drivers"],
            )
            db.add(mrow)
            db.add(srow)
            db.commit()

            results.append({
                "project_id": p.id,
                "project_name": p.name,
                "status": "ok",
                "risk_score": int(score["risk_score"]),
                "risk_band": str(score["risk_band"]),
            })

        except Exception as e:
            results.append({
                "project_id": p.id,
                "project_name": p.name,
                "status": "error",
                "error": str(e),
            })

    ok_projects = [r for r in results if r.get("status") == "ok"]
    ok_projects.sort(key=lambda r: r.get("risk_score", 0), reverse=True)

    return {
        "week_start": week_start,
        "summary": {
            "total_projects": len(projects),
            "ok": len([r for r in results if r["status"] == "ok"]),
            "skipped": len([r for r in results if r["status"] == "skipped"]),
            "error": len([r for r in results if r["status"] == "error"]),
        },
        "results": results,
        "ranked_ok": ok_projects,
    }


# ----------------------------
# Reports
# ----------------------------

@app.get("/v1/projects/{project_id}/reports/week/{week_start}", response_class=HTMLResponse)
def get_weekly_report_html(
    project_id: int,
    week_start: str,
    db: Session = Depends(get_db),
):
    p = db.get(Project, project_id)
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")

    mrow = db.execute(
        select(ProjectWeekMetric).where(
            ProjectWeekMetric.project_id == project_id,
            ProjectWeekMetric.week_start == week_start,
        )
    ).scalar_one_or_none()

    srow = db.execute(
        select(RiskScoreRow).where(
            RiskScoreRow.project_id == project_id,
            RiskScoreRow.week_start == week_start,
        )
    ).scalar_one_or_none()

    if not mrow or not srow:
        raise HTTPException(status_code=404, detail="No stored results for this project/week. Run /run-weekly first.")

    week_start_dt = _parse_week_start(week_start)
    week_end_dt = week_start_dt + timedelta(days=7)

    score = {
        "risk_score": srow.risk_score,
        "risk_band": srow.risk_band,
        "drivers": srow.drivers_json,
    }

    html = render_weekly_report_html(
        {
            "project_name": p.name,
            "week_start": week_start_dt.date().isoformat(),
            "week_end": week_end_dt.date().isoformat(),
            "metrics": mrow.metrics_json,
            "score": score,
        }
    )
    return HTMLResponse(content=html)


# ----------------------------
# Portfolio ranking
# ----------------------------

@app.get("/v1/portfolio/week/{week_start}")
def portfolio_week(week_start: str, db: Session = Depends(get_db)):
    # Join-like behavior without explicit join complexity
    scores = db.execute(
        select(RiskScoreRow).where(RiskScoreRow.week_start == week_start)
    ).scalars().all()

    if not scores:
        return {"week_start": week_start, "projects": []}

    # Fetch projects in bulk
    proj_ids = list({s.project_id for s in scores})
    projects = db.execute(select(Project).where(Project.id.in_(proj_ids))).scalars().all()
    proj_map = {p.id: p for p in projects}

    rows = []
    for s in scores:
        p = proj_map.get(s.project_id)
        if not p:
            continue
        rows.append(
            {
                "project_id": s.project_id,
                "project_name": p.name,
                "week_start": week_start,
                "risk_score": s.risk_score,
                "risk_band": s.risk_band,
                "drivers": s.drivers_json,
            }
        )

    rows.sort(key=lambda r: r["risk_score"], reverse=True)
    return {"week_start": week_start, "projects": rows}


@app.get("/v1/portfolio/week/{week_start}/report", response_class=HTMLResponse)
def portfolio_week_report_html(week_start: str, request: Request, db: Session = Depends(get_db)):
    scores = db.execute(
        select(RiskScoreRow).where(RiskScoreRow.week_start == week_start)
    ).scalars().all()

    if not scores:
        raise HTTPException(status_code=404, detail="No portfolio results for this week")

    proj_ids = list({s.project_id for s in scores})
    projects = db.execute(select(Project).where(Project.id.in_(proj_ids))).scalars().all()
    proj_map = {p.id: p for p in projects}

    rows = []
    for s in scores:
        p = proj_map.get(s.project_id)
        if not p:
            continue
        rows.append(
            {
                "project_id": s.project_id,
                "project_name": p.name,
                "week_start": week_start,
                "risk_score": s.risk_score,
                "risk_band": s.risk_band,
                "drivers": s.drivers_json,
            }
        )

    rows.sort(key=lambda r: r["risk_score"], reverse=True)

    week_start_dt = _parse_week_start(week_start)
    week_end_dt = week_start_dt + timedelta(days=7)

    # base_url like "http://localhost:8000"
    base_url = str(request.base_url).rstrip("/")

    html = render_portfolio_report_html(
        {
            "base_url": base_url,
            "week_start": week_start_dt.date().isoformat(),
            "week_end": week_end_dt.date().isoformat(),
            "projects": rows,
        }
    )
    return HTMLResponse(content=html)


@app.get("/v1/portfolio/latest/report", response_class=HTMLResponse)
def portfolio_latest_report_html(request: Request, db: Session = Depends(get_db)):
    latest_week = db.execute(select(func.max(RiskScoreRow.week_start))).scalar_one_or_none()
    if not latest_week:
        raise HTTPException(status_code=404, detail="No portfolio results yet")

    return portfolio_week_report_html(latest_week, request, db)


# ----------------------------
# Latest + Trend
# ----------------------------

@app.get("/v1/projects/{project_id}/results/latest")
def project_latest_json(project_id: int, db: Session = Depends(get_db)):
    p = db.get(Project, project_id)
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")

    latest_week = db.execute(
        select(func.max(RiskScoreRow.week_start)).where(RiskScoreRow.project_id == project_id)
    ).scalar_one_or_none()

    if not latest_week:
        raise HTTPException(status_code=404, detail="No results yet for this project")

    mrow = db.execute(
        select(ProjectWeekMetric).where(
            ProjectWeekMetric.project_id == project_id,
            ProjectWeekMetric.week_start == latest_week,
        )
    ).scalar_one_or_none()

    srow = db.execute(
        select(RiskScoreRow).where(
            RiskScoreRow.project_id == project_id,
            RiskScoreRow.week_start == latest_week,
        )
    ).scalar_one_or_none()

    if not mrow or not srow:
        raise HTTPException(status_code=404, detail="Stored score exists but metrics missing (inconsistent state)")

    return {
        "project_id": project_id,
        "project_name": p.name,
        "week_start": latest_week,
        "metrics": mrow.metrics_json,
        "score": {
            "risk_score": srow.risk_score,
            "risk_band": srow.risk_band,
            "drivers": srow.drivers_json,
        },
    }


@app.get("/v1/projects/{project_id}/reports/latest", response_class=HTMLResponse)
def project_latest_report_html(project_id: int, db: Session = Depends(get_db)):
    p = db.get(Project, project_id)
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")

    latest_week = db.execute(
        select(func.max(RiskScoreRow.week_start)).where(RiskScoreRow.project_id == project_id)
    ).scalar_one_or_none()

    if not latest_week:
        raise HTTPException(status_code=404, detail="No results yet for this project")

    mrow = db.execute(
        select(ProjectWeekMetric).where(
            ProjectWeekMetric.project_id == project_id,
            ProjectWeekMetric.week_start == latest_week,
        )
    ).scalar_one_or_none()

    srow = db.execute(
        select(RiskScoreRow).where(
            RiskScoreRow.project_id == project_id,
            RiskScoreRow.week_start == latest_week,
        )
    ).scalar_one_or_none()

    # IMPORTANT: this error should only happen if DB is inconsistent
    if not mrow or not srow:
        raise HTTPException(
            status_code=500,
            detail=f"Inconsistent stored state for project={project_id} week={latest_week}. "
                   f"Have_metrics={bool(mrow)} have_score={bool(srow)}"
        )

    week_start_dt = _parse_week_start(latest_week)
    week_end_dt = week_start_dt + timedelta(days=7)

    score = {
        "risk_score": srow.risk_score,
        "risk_band": srow.risk_band,
        "drivers": srow.drivers_json,
    }

    html = render_weekly_report_html(
        {
            "project_name": p.name,
            "week_start": week_start_dt.date().isoformat(),
            "week_end": week_end_dt.date().isoformat(),
            "metrics": mrow.metrics_json,
            "score": score,
        }
    )
    return HTMLResponse(content=html)


@app.get("/v1/projects/{project_id}/trend")
def project_trend(project_id: int, limit: int = 12, db: Session = Depends(get_db)):
    """
    Returns the most recent N weeks (default 12) of risk scores for a project.
    """
    p = db.get(Project, project_id)
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")

    # Week_start is stored as YYYY-MM-DD, so lexicographic ordering works.
    rows = db.execute(
        select(RiskScoreRow)
        .where(RiskScoreRow.project_id == project_id)
        .order_by(RiskScoreRow.week_start.desc())
        .limit(max(1, min(limit, 104)))  # cap 2 years
    ).scalars().all()

    series = [
        {
            "week_start": r.week_start,
            "risk_score": r.risk_score,
            "risk_band": r.risk_band,
            "drivers": r.drivers_json,  # optional; remove if you want slimmer payload
        }
        for r in rows
    ]

    # Return in chronological order for charting
    series = list(reversed(series))

    return {
        "project_id": project_id,
        "project_name": p.name,
        "points": series,
    }


@app.get("/v1/portfolio/latest")
def portfolio_latest(db: Session = Depends(get_db)):
    latest_week = db.execute(select(func.max(RiskScoreRow.week_start))).scalar_one_or_none()

    if not latest_week:
        return {"week_start": None, "projects": []}

    # Reuse existing portfolio logic for that week
    scores = db.execute(
        select(RiskScoreRow).where(RiskScoreRow.week_start == latest_week)
    ).scalars().all()

    proj_ids = list({s.project_id for s in scores})
    projects = db.execute(select(Project).where(Project.id.in_(proj_ids))).scalars().all()
    proj_map = {p.id: p for p in projects}

    rows = []
    for s in scores:
        p = proj_map.get(s.project_id)
        if not p:
            continue
        rows.append(
            {
                "project_id": s.project_id,
                "project_name": p.name,
                "week_start": latest_week,
                "risk_score": s.risk_score,
                "risk_band": s.risk_band,
                "drivers": s.drivers_json,
            }
        )

    rows.sort(key=lambda r: r["risk_score"], reverse=True)
    return {"week_start": latest_week, "projects": rows}