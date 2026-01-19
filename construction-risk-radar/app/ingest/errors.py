from dataclasses import dataclass
from typing import Any, Dict, List, Optional


@dataclass
class ParseError(Exception):
    kind: str
    message: str
    found_columns: List[str]
    mapped_columns: Dict[str, str]
    missing_required: List[str]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "kind": self.kind,
            "message": self.message,
            "missing_required": self.missing_required,
            "found_columns": self.found_columns,
            "mapped_columns": self.mapped_columns,
            "hint": "Fix headers or update alias mapping. You can also upload a template export that matches canonical columns.",
        }
