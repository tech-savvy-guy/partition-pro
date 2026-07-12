from __future__ import annotations

from datetime import date, datetime
from typing import Any
from uuid import UUID

import numpy as np
import pandas as pd


def json_safe_value(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, (datetime, date, pd.Timestamp)):
        return value.isoformat()
    if isinstance(value, (np.floating,)):
        if np.isnan(value) or np.isinf(value):
            return None
        return float(value)
    if isinstance(value, float) and (np.isnan(value) or np.isinf(value)):
        return None
    return value


def dataframe_to_table(df: pd.DataFrame) -> dict[str, Any]:
    clean = df.astype(object).where(pd.notna(df), None)
    columns = [str(column) for column in clean.columns.tolist()]
    rows = [
        [json_safe_value(value) for value in row]
        for row in clean.itertuples(index=False, name=None)
    ]
    return {"columns": columns, "rows": rows, "count": len(rows)}
