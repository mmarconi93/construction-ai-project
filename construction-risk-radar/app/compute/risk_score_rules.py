from dataclasses import dataclass
from typing import List, Dict, Any

@dataclass
class Driver:
    factor: str
    value: float
    points: int

def score_from_metrics(m: Dict[str, Any]) -> Dict[str, Any]:
    drivers: List[Driver] = []
    score = 0

    def add(factor: str, value: float, pts: int, condition: bool):
        nonlocal score
        if condition:
            score += pts
            drivers.append(Driver(factor=factor, value=float(value), points=int(pts)))

    add("RFIs older than 14d", m.get("rfi_over_14d", 0), 20, m.get("rfi_over_14d", 0) >= 5)
    add("Avg RFI age (days)", m.get("rfi_avg_age_days", 0), 15, m.get("rfi_avg_age_days", 0) >= 10)
    add("RFI backlog growing", m.get("rfi_opened_this_week", 0) - m.get("rfi_closed_this_week", 0),
        10, m.get("rfi_opened_this_week", 0) > m.get("rfi_closed_this_week", 0))

    add("Overdue submittals", m.get("submittal_overdue", 0), 20, m.get("submittal_overdue", 0) >= 3)
    add("Slow submittal cycle", m.get("submittal_avg_cycle_days", 0), 10, m.get("submittal_avg_cycle_days", 0) >= 14)

    add("Critical tasks slipping", m.get("critical_tasks_slipping", 0), 25, m.get("critical_tasks_slipping", 0) >= 2)
    add("Baseline slip on critical path", m.get("critical_tasks_baseline_slip", 0), 10, m.get("critical_tasks_baseline_slip", 0) >= 1)

    score = max(0, min(100, score))
    band = "LOW" if score < 40 else "MED" if score < 70 else "HIGH"

    return {
        "risk_score": int(score),
        "risk_band": band,
        "drivers": [d.__dict__ for d in drivers],
    }