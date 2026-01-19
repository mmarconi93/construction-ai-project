import pandas as pd
from datetime import datetime
from typing import Dict

def compute_rfi_metrics(rfis: pd.DataFrame, week_start: datetime, week_end: datetime) -> Dict:
    rfis = rfis.copy()
    rfis["created_date"] = pd.to_datetime(rfis["created_date"], errors="coerce")
    rfis["closed_date"] = pd.to_datetime(rfis["closed_date"], errors="coerce")

    open_mask = rfis["closed_date"].isna()
    open_rfis = rfis[open_mask]

    age_days = (pd.Timestamp(week_end) - open_rfis["created_date"]).dt.days
    rfi_avg_age_days = float(age_days.mean()) if len(open_rfis) else 0.0
    rfi_over_14d = int((age_days >= 14).sum()) if len(open_rfis) else 0

    opened_this_week = int(((rfis["created_date"] >= week_start) & (rfis["created_date"] < week_end)).sum())
    closed_this_week = int(((rfis["closed_date"] >= week_start) & (rfis["closed_date"] < week_end)).sum())

    return {
        "rfi_open": int(open_mask.sum()),
        "rfi_avg_age_days": round(rfi_avg_age_days, 2),
        "rfi_over_14d": rfi_over_14d,
        "rfi_opened_this_week": opened_this_week,
        "rfi_closed_this_week": closed_this_week,
    }

def compute_submittal_metrics(submittals: pd.DataFrame, week_start: datetime, week_end: datetime, overdue_days: int = 14) -> Dict:
    s = submittals.copy()
    s["submitted_date"] = pd.to_datetime(s["submitted_date"], errors="coerce")
    s["approved_date"] = pd.to_datetime(s["approved_date"], errors="coerce")

    pending = s["approved_date"].isna()
    pending_s = s[pending]

    pending_age = (pd.Timestamp(week_end) - pending_s["submitted_date"]).dt.days
    overdue = int((pending_age >= overdue_days).sum()) if len(pending_s) else 0

    cycle = (s["approved_date"] - s["submitted_date"]).dt.days
    avg_cycle = float(cycle.dropna().mean()) if cycle.notna().any() else 0.0

    submitted_this_week = int(((s["submitted_date"] >= week_start) & (s["submitted_date"] < week_end)).sum())
    approved_this_week = int(((s["approved_date"] >= week_start) & (s["approved_date"] < week_end)).sum())

    return {
        "submittal_pending": int(pending.sum()),
        "submittal_overdue": overdue,
        "submittal_avg_cycle_days": round(avg_cycle, 2),
        "submittal_submitted_this_week": submitted_this_week,
        "submittal_approved_this_week": approved_this_week,
    }

def compute_schedule_metrics(schedule: pd.DataFrame, week_start: datetime, week_end: datetime) -> Dict:
    t = schedule.copy()
    t["start_date"] = pd.to_datetime(t["start_date"], errors="coerce")
    t["finish_date"] = pd.to_datetime(t["finish_date"], errors="coerce")
    t["baseline_finish_date"] = pd.to_datetime(t["baseline_finish_date"], errors="coerce")

    # critical tasks finishing this week but not close to done
    finishing_this_week = (t["finish_date"] >= week_start) & (t["finish_date"] < week_end)
    crit = t["is_critical"] == True
    slipping = t[finishing_this_week & crit & (t["percent_complete"] < 80.0)]

    # baseline slippage if baseline exists
    has_baseline = t["baseline_finish_date"].notna()
    baseline_slip = t[has_baseline & (t["finish_date"] > t["baseline_finish_date"]) & crit]

    return {
        "critical_tasks_finishing_this_week": int((finishing_this_week & crit).sum()),
        "critical_tasks_slipping": int(len(slipping)),
        "critical_tasks_baseline_slip": int(len(baseline_slip)),
    }

def compute_week_metrics(
    rfis: pd.DataFrame,
    submittals: pd.DataFrame,
    schedule: pd.DataFrame,
    week_start: datetime,
    week_end: datetime,
) -> Dict:
    metrics = {}
    metrics.update(compute_rfi_metrics(rfis, week_start, week_end))
    metrics.update(compute_submittal_metrics(submittals, week_start, week_end))
    metrics.update(compute_schedule_metrics(schedule, week_start, week_end))
    return metrics