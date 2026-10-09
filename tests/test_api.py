from concurrent.futures import ThreadPoolExecutor

import pytest
from fastapi.testclient import TestClient

from app import app
from atlas.lookup import lookup

client = TestClient(app)


def test_ipv4_city_and_server_only_data():
    result = client.post("/api/lookup", json={"ip": "114.114.114.114"})
    assert result.status_code == 200
    data = result.json()
    assert data["city"] == "南京市"
    assert data["location"]["level"] == "city"
    assert 118 < data["location"]["longitude"] < 120
    assert result.headers["cache-control"] == "no-store"
    assert len(result.content) < 2000


def test_ipv6_and_country_fallback():
    d = lookup("240e:3b7:3272:d8d0:db09:c067:8d59:539e")
    assert d["version"] == 6 and d["city"] == "深圳市"
    assert d["location"]["level"] == "city"
    assert 113 < d["location"]["longitude"] < 115
    assert lookup("8.8.8.8")["location"]["level"] == "region"


@pytest.mark.parametrize(
    "ip",
    [
        "127.0.0.1",
        "10.0.0.1",
        "::1",
        "fe80::1",
        "100.64.0.1",
        "192.0.2.1",
        "224.0.0.1",
        "2001:db8::1",
    ],
)
def test_non_public_never_gets_pin(ip):
    data = lookup(ip)
    assert data["scope"] != "public"
    assert data["location"] is None


@pytest.mark.parametrize(
    "ip", ["example.com", "999.1.1.1", "<script>", "fe80::1%en0", "1.2.3.4/24"]
)
def test_invalid_addresses(ip):
    assert client.post("/api/lookup", json={"ip": ip}).status_code == 400


def test_validation_and_mapped_ip():
    assert client.post("/api/lookup", json={"ip": "a" * 1000}).status_code == 422
    assert client.post("/api/lookup", json={}).status_code == 422
    assert lookup("::ffff:114.114.114.114")["ip"] == "114.114.114.114"


def test_untrusted_forward_header_is_ignored(monkeypatch):
    monkeypatch.delenv("VERCEL", raising=False)
    with TestClient(app, client=("127.0.0.1", 5000)) as local:
        result = local.get("/api/me", headers={"x-vercel-forwarded-for": "8.8.8.8"})
    assert result.json()["ip"] == "127.0.0.1"
    assert result.headers["cache-control"] == "private, no-store"


def test_concurrent_queries_remain_independent():
    ips = ["114.114.114.114", "8.8.8.8", "2001:4860:4860::8888"] * 20
    lookup.cache_clear()
    with ThreadPoolExecutor(max_workers=12) as pool:
        results = list(pool.map(lookup, ips))
    assert all(result["ip"] == ip for result, ip in zip(results, ips))


def test_vercel_missing_paths_without_frontend_bundle(monkeypatch, tmp_path):
    import runpy
    from pathlib import Path

    source = Path(__file__).resolve().parents[1] / "app.py"
    monkeypatch.setenv("VERCEL", "1")
    monkeypatch.chdir(tmp_path)
    deployed = TestClient(runpy.run_path(str(source))["app"])
    for path in ["/data/ip2region_v4.xdb", "/data/places.json", "/.env.local", "/missing"]:
        assert deployed.get(path).status_code == 404
    assert deployed.get("/api/health").status_code == 200


def test_washington_state_is_not_the_district_of_columbia():
    point = lookup("195.211.97.37")["location"]
    assert point["level"] == "region"
    assert -125 < point["longitude"] < -116
    assert 45 < point["latitude"] < 50
    west, south, east, north = point["bounds"]
    assert west < point["longitude"] < east
    assert south < point["latitude"] < north


def test_region_names_prefer_canonical_names_and_reject_equal_aliases():
    from scripts.prepare_data import region_index

    def feature(name, alias, identifier):
        return {
            "properties": {
                "name": name,
                "name_en": alias,
                "iso_a2": "US",
                "adm1_code": identifier,
                "longitude": 0.5,
                "latitude": 0.5,
            },
            "geometry": {
                "type": "Polygon",
                "coordinates": [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
            },
        }

    state = feature("Washington", "Shared", "state")
    district = feature("District of Columbia", "Washington", "district")
    other = feature("Other", "Shared", "other")
    for features in ([state, district, other], [other, district, state]):
        regions, _, _ = region_index(features)
        assert regions[("US", "washington")]["region_id"] == "state"
        assert regions[("US", "districtofcolumbia")]["region_id"] == "district"
        assert ("US", "shared") not in regions
