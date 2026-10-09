"""Prepare a read-only, indexed reverse lookup from the same IP source snapshot."""

import json
import sqlite3
from collections import Counter, defaultdict
from ipaddress import ip_address

from shapely.geometry import shape


def build_ranges(source, root, countries, provinces, region_geo, commit):
    from scripts.prepare_data import norm

    target = root / "data/ranges.sqlite"
    temporary = root / ".cache/ranges.sqlite"
    temporary.unlink(missing_ok=True)
    db = sqlite3.connect(temporary)
    db.executescript("""
        PRAGMA journal_mode=OFF;
        PRAGMA synchronous=OFF;
        CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT);
        CREATE TABLE areas (id INTEGER PRIMARY KEY, key TEXT UNIQUE, level TEXT,
                            country TEXT, name TEXT, zh TEXT, bounds TEXT);
        CREATE TABLE details (id INTEGER PRIMARY KEY, region TEXT, city TEXT, isp TEXT);
        CREATE TABLE ranges (id INTEGER PRIMARY KEY, country INTEGER, region INTEGER,
                             version INTEGER, start BLOB, end BLOB, detail INTEGER);
        CREATE TABLE stats (area INTEGER, version INTEGER, total INTEGER, addresses TEXT,
                            PRIMARY KEY (area, version)) WITHOUT ROWID;
    """)
    db.execute("INSERT INTO metadata VALUES ('data_version', ?)", (commit[:7],))
    country_ids, region_ids, detail_ids = {}, {}, {}
    for code, point in sorted(countries.items()):
        if len(code) != 2 or not code.isalpha():
            continue
        country_ids[code] = db.execute(
            "INSERT INTO areas(key,level,country,name,zh,bounds) VALUES (?,?,?,?,?,?)",
            (f"country:{code}", "country", code, point["name"], "", json.dumps(point["bounds"])),
        ).lastrowid
    for feature in region_geo["features"]:
        p = feature["properties"]
        code, key = p["iso_a2"], p["adm1_code"]
        if code not in country_ids:
            continue
        geometry = shape(feature["geometry"])
        largest = (
            max(geometry.geoms, key=lambda g: g.area)
            if geometry.geom_type == "MultiPolygon"
            else geometry
        )
        region_ids[key] = db.execute(
            "INSERT INTO areas(key,level,country,name,zh,bounds) VALUES (?,?,?,?,?,?)",
            (
                f"region:{key}",
                "region",
                code,
                p["name"],
                p.get("name_zh") or p["name"],
                json.dumps(largest.bounds),
            ),
        ).lastrowid
    stats, addresses, skipped = Counter(), defaultdict(int), Counter()
    for version in (4, 6):
        batch = []
        for line in (source / f"data/ipv{version}_source.txt").open():
            start, end, _country, province, city, isp, code = line.rstrip().split("|")
            if code not in country_ids:
                skipped["no_country"] += 1
                continue
            first, last = ip_address(start), ip_address(end)
            if not first.is_global or not last.is_global or first.is_multicast or last.is_multicast:
                skipped["non_public"] += 1
                continue
            if first.version != version or last.version != version or first > last:
                raise ValueError("Malformed source interval")
            point = provinces.get((code, norm(province)))
            region = region_ids.get(point["region_id"]) if point else None
            country = country_ids[code]
            detail = tuple(None if v in ("0", "", "Reserved") else v for v in (province, city, isp))
            if detail not in detail_ids:
                detail_ids[detail] = db.execute(
                    "INSERT INTO details(region,city,isp) VALUES (?,?,?)", detail
                ).lastrowid
            batch.append((country, region, version, first.packed, last.packed, detail_ids[detail]))
            for area in (country, region):
                if area is not None:
                    stats[area, version] += 1
                    addresses[area, version] += int(last) - int(first) + 1
            if len(batch) >= 10000:
                db.executemany(
                    "INSERT INTO ranges(country,region,version,start,end,detail) VALUES (?,?,?,?,?,?)",
                    batch,
                )
                batch.clear()
        db.executemany(
            "INSERT INTO ranges(country,region,version,start,end,detail) VALUES (?,?,?,?,?,?)",
            batch,
        )
    db.executemany(
        "INSERT INTO stats VALUES (?,?,?,?)",
        [
            (area, version, total, str(addresses[area, version]))
            for (area, version), total in stats.items()
        ],
    )
    db.executescript("""
        CREATE INDEX ranges_country ON ranges(country,version);
        CREATE INDEX ranges_region ON ranges(region,version) WHERE region IS NOT NULL;
        ANALYZE;
    """)
    count = db.execute("SELECT count(*) FROM ranges").fetchone()[0]
    db.commit()
    db.close()
    temporary.replace(target)
    return {"rows": count, "bytes": target.stat().st_size, "skipped": dict(skipped)}
