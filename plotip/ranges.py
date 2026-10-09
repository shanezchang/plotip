"""Regional IP ranges. Read-only SQLite stays in the function bundle, never public/."""

import json
import sqlite3
from contextlib import contextmanager
from ipaddress import ip_address, summarize_address_range

from plotip.lookup import DATA

PAGE_SIZE = 20


@contextmanager
def connect():
    path = DATA / "ranges.sqlite"
    db = sqlite3.connect(f"{path.as_uri()}?mode=ro&immutable=1", uri=True)
    db.row_factory = sqlite3.Row
    try:
        yield db
    finally:
        db.close()


def area_json(row):
    return {
        "id": row["key"],
        "level": row["level"],
        "country_code": row["country"],
        "name": row["name"],
        "zh": row["zh"],
        "bounds": json.loads(row["bounds"]),
    }


def list_areas(country=None):
    with connect() as db:
        if country is None:
            rows = db.execute("SELECT * FROM areas WHERE level='country' ORDER BY name")
        else:
            if not db.execute(
                "SELECT 1 FROM areas WHERE key=?", (f"country:{country}",)
            ).fetchone():
                raise KeyError(country)
            rows = db.execute(
                "SELECT * FROM areas WHERE level='region' AND country=? ORDER BY name", (country,)
            )
        return {"items": [area_json(row) for row in rows]}


def list_ranges(area_key, version=4, after=0):
    with connect() as db:
        area = db.execute("SELECT * FROM areas WHERE key=?", (area_key,)).fetchone()
        if area is None:
            raise KeyError(area_key)
        # Field choice is internal; values are always bound parameters.
        field = "country" if area["level"] == "country" else "region"
        rows = db.execute(
            f"SELECT r.*, d.region AS region_name, d.city, d.isp FROM ranges r "
            f"JOIN details d ON d.id=r.detail WHERE r.{field}=? AND r.version=? AND r.id>? "
            "ORDER BY r.id LIMIT ?",
            (area["id"], version, after, PAGE_SIZE + 1),
        ).fetchall()
        stat = db.execute(
            "SELECT * FROM stats WHERE area=? AND version=?", (area["id"], version)
        ).fetchone()
        items = []
        for row in rows[:PAGE_SIZE]:
            first, last = ip_address(row["start"]), ip_address(row["end"])
            items.append(
                {
                    "id": row["id"],
                    "start": str(first),
                    "end": str(last),
                    "cidrs": [str(network) for network in summarize_address_range(first, last)],
                    "region": row["region_name"],
                    "city": row["city"],
                    "isp": row["isp"],
                    # Strings preserve exact IPv6 counts beyond JavaScript's safe integers.
                    "address_count": str(int(last) - int(first) + 1),
                }
            )
        return {
            "area": area_json(area),
            "version": version,
            "items": items,
            "total_ranges": stat["total"] if stat else 0,
            "address_count": stat["addresses"] if stat else "0",
            "next_cursor": items[-1]["id"] if len(rows) > PAGE_SIZE else None,
            "data_version": db.execute(
                "SELECT value FROM metadata WHERE key='data_version'"
            ).fetchone()[0],
        }
