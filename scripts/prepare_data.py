"""Build compact, conservative place matches from checked-in upstream snapshots."""

import argparse
import hashlib
import json
import re
import shutil
import subprocess
import unicodedata
from collections import Counter, defaultdict
from datetime import UTC, datetime
from pathlib import Path

import geonamescache
from shapely.geometry import Point, mapping, shape

ROOT = Path(__file__).resolve().parents[1]


def norm(value):
    value = unicodedata.normalize("NFKD", value or "").casefold()
    value = "".join(c for c in value if not unicodedata.combining(c))
    value = re.sub(r"(特别行政区|维吾尔自治区|壮族自治区|回族自治区|自治区|省|市)$", "", value)
    return re.sub(r"[^\w]", "", value)


def dump(path, obj):
    path.write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":")))


def region_index(features):
    """Canonical admin names outrank translated names and aliases; ties stay unresolved."""
    candidates = defaultdict(list)
    for f in features:
        p = f["properties"]
        geometry = shape(f["geometry"])
        largest = (
            max(geometry.geoms, key=lambda g: g.area)
            if geometry.geom_type == "MultiPolygon"
            else geometry
        )
        point = (
            Point(p["longitude"], p["latitude"])
            if p["longitude"] is not None and p["latitude"] is not None
            else largest.representative_point()
        )
        if not largest.covers(point):
            point = largest.representative_point()
        item = {
            "longitude": point.x,
            "latitude": point.y,
            "name": p["name"],
            "level": "region",
            "source": "Natural Earth",
            "region_id": p["adm1_code"],
            "bounds": list(largest.bounds),
        }
        names = [(p.get("name"), 0), (p.get("gn_name"), 0), (p.get("woe_name"), 0)]
        names += [(p.get(k), 1) for k in ("name_en", "name_zh", "name_local")]
        names += [(n, 2) for n in (p.get("name_alt") or "").split("|")]
        for name, rank in names:
            if name:
                candidates[(p["iso_a2"], norm(name))].append(
                    (rank, item, p.get("gn_a1_code"), geometry)
                )
    regions, codes, shapes = {}, {}, {}
    for key, values in candidates.items():
        best = min(v[0] for v in values)
        winners = {v[1]["region_id"]: v for v in values if v[0] == best}
        if len(winners) == 1:
            _, regions[key], codes[key], shapes[key] = next(iter(winners.values()))
    return regions, codes, shapes


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--ip2region", type=Path, required=True)
    args = parser.parse_args()
    country_geo = json.loads((ROOT / ".cache/countries.geojson").read_text())
    province_geo = json.loads((ROOT / ".cache/provinces.geojson").read_text())
    countries = {}
    provinces, province_codes, province_shapes = region_index(province_geo["features"])
    for f in country_geo["features"]:
        p = f["properties"]
        code = p["ISO_A2_EH"]
        f["properties"] = {
            "code": code,
            "name": p["NAME_EN"],
            "zh": p["NAME_ZH"],
            "lon": p["LABEL_X"],
            "lat": p["LABEL_Y"],
            "rank": p["LABELRANK"],
        }
        geometry = shape(f["geometry"])
        largest = (
            max(geometry.geoms, key=lambda g: g.area)
            if geometry.geom_type == "MultiPolygon"
            else geometry
        )
        point = Point(p["LABEL_X"], p["LABEL_Y"])
        if not largest.covers(point):
            point = largest.representative_point()
        countries[code] = {
            "bounds": list(largest.bounds),
            "longitude": point.x,
            "latitude": point.y,
            "name": p["NAME_EN"],
            "level": "country",
            "source": "Natural Earth",
        }
    cities = defaultdict(dict)
    for c in geonamescache.GeonamesCache().get_cities().values():
        for name in {c["name"], *c["alternatenames"]}:
            cities[(c["countrycode"], norm(name))][c["geonameid"]] = c
    keys = set()
    for version in (4, 6):
        for line in (args.ip2region / f"data/ipv{version}_source.txt").open():
            fields = line.rstrip().split("|")
            if len(fields) == 7:
                _country, province, city, _isp, code = fields[2:]
                keys.add((code, province, city))
        shutil.copyfile(
            args.ip2region / f"data/ip2region_v{version}.xdb",
            ROOT / f"data/ip2region_v{version}.xdb",
        )
    places, counts = {}, Counter()
    for code, province, city in sorted(keys):
        point = None
        if city not in ("0", "", "Reserved"):
            candidates = list(cities.get((code, norm(city)), {}).values())
            admin = province_codes.get((code, norm(province)))
            if admin:
                candidates = [c for c in candidates if f"{code}.{c['admin1code']}" == admin]
            region_shape = province_shapes.get((code, norm(province)))
            if region_shape is not None:
                candidates = [
                    c
                    for c in candidates
                    if region_shape.buffer(0.05).covers(Point(c["longitude"], c["latitude"]))
                ]
            if len(candidates) == 1:
                c = candidates[0]
                point = {
                    "latitude": c["latitude"],
                    "longitude": c["longitude"],
                    "name": c["name"],
                    "level": "city",
                    "source": "GeoNames",
                    "geoname_id": c["geonameid"],
                    "timezone": c["timezone"],
                }
        point = point or provinces.get((code, norm(province))) or countries.get(code)
        if point:
            places[f"{code}|{province}|{city}"] = point
            counts[point["level"]] += 1
        else:
            counts["unmapped"] += 1
    dump(ROOT / "data/places.json", places)
    dump(ROOT / "web/public/world.geojson", country_geo)
    outlines = {"type": "FeatureCollection", "features": []}
    for feature in province_geo["features"]:
        outlines["features"].append(
            {
                "type": "Feature",
                "properties": {"id": feature["properties"]["adm1_code"]},
                "geometry": mapping(
                    shape(feature["geometry"]).simplify(0.02, preserve_topology=True)
                ),
            }
        )
    dump(ROOT / "web/public/regions.geojson", outlines)
    commit = subprocess.check_output(
        ["git", "-C", str(args.ip2region), "rev-parse", "HEAD"], text=True
    ).strip()
    metadata = {
        "ip2region_commit": commit,
        "prepared": datetime.now(UTC).date().isoformat(),
        "natural_earth_commit": "ca96624a56bd078437bca8184e78163e5039ad19",
        "natural_earth_inputs": {
            name: hashlib.sha256((ROOT / ".cache" / f"{name}.geojson").read_bytes()).hexdigest()
            for name in ("countries", "provinces")
        },
        "mapping_counts": dict(counts),
        "files": {
            p.name: hashlib.sha256(p.read_bytes()).hexdigest()
            for p in (ROOT / "data").glob("*.xdb")
        },
        "coordinate_sources": [
            "GeoNames via geonamescache 3.0.2 (CC BY 4.0)",
            "Natural Earth (public domain)",
        ],
        "map_sha256": hashlib.sha256((ROOT / "web/public/world.geojson").read_bytes()).hexdigest(),
    }
    dump(ROOT / "data/manifest.json", metadata)
    print(json.dumps(metadata, indent=2))


if __name__ == "__main__":
    main()
