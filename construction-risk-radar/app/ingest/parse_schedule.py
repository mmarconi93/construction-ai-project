import pandas as pd
from .errors import ParseError

REQUIRED_COLUMNS = ["task_name", "start_date", "finish_date"]
OPTIONAL_COLUMNS = ["percent_complete", "is_critical", "baseline_finish_date"]


def parse_schedule_csv(df: pd.DataFrame) -> pd.DataFrame:
    if df is None:
        raise ParseError(
            kind="schedule",
            message="Schedule parser received empty input (None).",
            found_columns=[],
            mapped_columns={},
            missing_required=REQUIRED_COLUMNS[:],
        )

    df = df.copy()

    df.columns = [str(c).strip() for c in df.columns]
    found = list(df.columns)

    lower = {c: c.lower().replace(" ", "").replace("-", "_") for c in df.columns}

    col_map = {
        # task name
        "task": "task_name",
        "taskname": "task_name",
        "name": "task_name",
        "activity": "task_name",
        "activity_name": "task_name",
        # start
        "start": "start_date",
        "startdate": "start_date",
        "start_date": "start_date",
        "current_start": "start_date",
        "current_start_date": "start_date",
        # finish/current finish
        "finish": "finish_date",
        "finishdate": "finish_date",
        "finish_date": "finish_date",
        "current_finish": "finish_date",
        "current_finish_date": "finish_date",
        "currentfinish": "finish_date",
        "currentfinishdate": "finish_date",
        # percent
        "percentcomplete": "percent_complete",
        "%complete": "percent_complete",
        "percent_complete": "percent_complete",
        "%_complete": "percent_complete",
        # critical
        "critical": "is_critical",
        "iscritical": "is_critical",
        "is_critical": "is_critical",
        "critical_path": "is_critical",
        # baseline
        "baselinefinish": "baseline_finish_date",
        "baseline_finish": "baseline_finish_date",
        "baselinefinishdate": "baseline_finish_date",
        "baseline_finish_date": "baseline_finish_date",
        "bl_finish": "baseline_finish_date",
    }

    renamed = {}
    for original, norm in lower.items():
        if norm in col_map:
            renamed[original] = col_map[norm]
        elif norm in ["task_name", "start_date", "finish_date", "percent_complete", "is_critical", "baseline_finish_date"]:
            renamed[original] = norm

    df = df.rename(columns=renamed)

    missing = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    if missing:
        raise ParseError(
            kind="schedule",
            message=f"Schedule CSV missing required column(s): {missing}.",
            found_columns=found,
            mapped_columns=renamed,
            missing_required=missing,
        )

    for col in OPTIONAL_COLUMNS:
        if col not in df.columns:
            df[col] = None

    df["start_date"] = pd.to_datetime(df["start_date"], errors="coerce")
    df["finish_date"] = pd.to_datetime(df["finish_date"], errors="coerce")
    df["baseline_finish_date"] = pd.to_datetime(df["baseline_finish_date"], errors="coerce")

    df["percent_complete"] = pd.to_numeric(df["percent_complete"], errors="coerce").fillna(0.0)

    def to_bool(x):
        if pd.isna(x):
            return False
        s = str(x).strip().lower()
        return s in ["true", "1", "yes", "y", "critical", "cp"]

    df["is_critical"] = df["is_critical"].apply(to_bool)

    df = df.dropna(subset=["task_name", "start_date", "finish_date"]).reset_index(drop=True)
    df["task_name"] = df["task_name"].astype("string")

    return df[["task_name", "start_date", "finish_date", "percent_complete", "is_critical", "baseline_finish_date"]]