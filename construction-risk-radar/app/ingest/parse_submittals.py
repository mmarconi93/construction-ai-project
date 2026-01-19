import pandas as pd
from .errors import ParseError

REQUIRED_COLUMNS = ["submitted_date"]
OPTIONAL_COLUMNS = ["approved_date", "status", "spec_section", "lead_time_days"]


def parse_submittals_csv(df: pd.DataFrame) -> pd.DataFrame:
    if df is None:
        raise ParseError(
            kind="submittals",
            message="Submittals parser received empty input (None).",
            found_columns=[],
            mapped_columns={},
            missing_required=REQUIRED_COLUMNS[:],
        )

    df = df.copy()

    df.columns = [str(c).strip() for c in df.columns]
    found = list(df.columns)

    lower = {c: c.lower().replace(" ", "").replace("-", "_") for c in df.columns}

    col_map = {
        # submitted
        "submitted": "submitted_date",
        "submitteddate": "submitted_date",
        "date_submitted": "submitted_date",
        "submitted_on": "submitted_date",
        "received_date": "submitted_date",
        # approved
        "approved": "approved_date",
        "approveddate": "approved_date",
        "date_approved": "approved_date",
        "approved_on": "approved_date",
        "returned_date": "approved_date",
        # strings/numbers
        "submittal_status": "status",
        "status": "status",
        "spec": "spec_section",
        "specsection": "spec_section",
        "spec_section": "spec_section",
        "leadtime": "lead_time_days",
        "lead_time": "lead_time_days",
        "lead_time_days": "lead_time_days",
    }

    renamed = {}
    for original, norm in lower.items():
        if norm in col_map:
            renamed[original] = col_map[norm]
        elif norm in ["submitted_date", "approved_date", "status", "spec_section", "lead_time_days"]:
            renamed[original] = norm

    df = df.rename(columns=renamed)

    missing = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    if missing:
        raise ParseError(
            kind="submittals",
            message=f"Submittals CSV missing required column(s): {missing}.",
            found_columns=found,
            mapped_columns=renamed,
            missing_required=missing,
        )

    for col in OPTIONAL_COLUMNS:
        if col not in df.columns:
            df[col] = None

    df["submitted_date"] = pd.to_datetime(df["submitted_date"], errors="coerce")
    df["approved_date"] = pd.to_datetime(df["approved_date"], errors="coerce")

    df["lead_time_days"] = pd.to_numeric(df["lead_time_days"], errors="coerce")

    df = df.dropna(subset=["submitted_date"]).reset_index(drop=True)

    for c in ["status", "spec_section"]:
        df[c] = df[c].astype("string")

    return df[["submitted_date", "approved_date", "status", "spec_section", "lead_time_days"]]