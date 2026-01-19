import pandas as pd
from .errors import ParseError

REQUIRED_COLUMNS = ["created_date"]
OPTIONAL_COLUMNS = ["closed_date", "status", "discipline", "assignee"]


def parse_rfis_csv(df: pd.DataFrame) -> pd.DataFrame:
    """
    Canonical schema:
      created_date: datetime (required)
      closed_date: datetime
      status/discipline/assignee: strings
    """
    if df is None:
        raise ParseError(
            kind="rfis",
            message="RFIs parser received empty input (None).",
            found_columns=[],
            mapped_columns={},
            missing_required=REQUIRED_COLUMNS[:],
        )

    df = df.copy()

    df.columns = [str(c).strip() for c in df.columns]
    found = list(df.columns)

    lower = {c: c.lower().replace(" ", "").replace("-", "_") for c in df.columns}

    # alias map works on normalized (lower) keys
    col_map = {
        # created
        "created": "created_date",
        "createddate": "created_date",
        "date_created": "created_date",
        "opened": "created_date",
        "opened_date": "created_date",
        "open_date": "created_date",
        "date_opened": "created_date",
        "created_on": "created_date",
        # closed
        "closed": "closed_date",
        "closeddate": "closed_date",
        "date_closed": "closed_date",
        "dateclosed": "closed_date",
        "closed_on": "closed_date",
        "responded_date": "closed_date",
        "answered_date": "closed_date",
        # strings
        "rfi_status": "status",
        "status": "status",
        "discipline": "discipline",
        "assigned_to": "assignee",
        "assignee": "assignee",
        "owner": "assignee",
        "ball_in_court": "assignee",
    }

    renamed = {}
    for original, norm in lower.items():
        if norm in col_map:
            renamed[original] = col_map[norm]
        elif norm in ["created_date", "closed_date", "status", "discipline", "assignee"]:
            renamed[original] = norm

    df = df.rename(columns=renamed)

    # validate required
    missing = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    if missing:
        raise ParseError(
            kind="rfis",
            message=f"RFIs CSV missing required column(s): {missing}.",
            found_columns=found,
            mapped_columns=renamed,
            missing_required=missing,
        )

    # add optional columns if missing
    for col in OPTIONAL_COLUMNS:
        if col not in df.columns:
            df[col] = None

    df["created_date"] = pd.to_datetime(df["created_date"], errors="coerce")
    df["closed_date"] = pd.to_datetime(df["closed_date"], errors="coerce")

    # keep only rows with parseable created_date
    df = df.dropna(subset=["created_date"]).reset_index(drop=True)

    for c in ["status", "discipline", "assignee"]:
        df[c] = df[c].astype("string")

    return df[["created_date", "closed_date", "status", "discipline", "assignee"]]