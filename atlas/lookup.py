"""Offline lookup. XDB buffers and coordinate tables stay on the server."""

import json
from functools import lru_cache
from ipaddress import ip_address, ip_network
from pathlib import Path
from threading import Lock

from ip2region import searcher, util

DATA = Path(__file__).resolve().parents[1] / "data"
_LOAD_LOCK = Lock()
_BUFFERS: dict[int, bytes] = {}


@lru_cache(maxsize=1)
def places():
    return json.loads((DATA / "places.json").read_text())


@lru_cache(maxsize=1)
def manifest():
    return json.loads((DATA / "manifest.json").read_text())


def buffer_for(version: int) -> bytes:
    with _LOAD_LOCK:
        if version not in _BUFFERS:
            path = str(DATA / f"ip2region_v{version}.xdb")
            util.verify_from_file(path)
            _BUFFERS[version] = util.load_content_from_file(path)
        return _BUFFERS[version]


def classify(address):
    if address.is_loopback:
        return "loopback"
    if address.is_unspecified:
        return "unspecified"
    if address.is_link_local:
        return "link_local"
    if address.is_multicast:
        return "multicast"
    if address.version == 4 and address in ip_network("100.64.0.0/10"):
        return "shared"
    if not address.is_global:
        return "non_public"
    return "public"


@lru_cache(maxsize=2048)
def lookup(value: str):
    # Reject IPv6 scope IDs: meaningful on a local interface, not a public IP lookup.
    if "%" in value:
        raise ValueError("scope IDs are not supported")
    address = ip_address(value.strip())
    if address.version == 6 and address.ipv4_mapped:
        address = address.ipv4_mapped
    scope = classify(address)
    result = {
        "ip": str(address),
        "version": address.version,
        "scope": scope,
        "country": None,
        "region": None,
        "city": None,
        "isp": None,
        "country_code": None,
        "location": None,
        "data_version": manifest()["ip2region_commit"][:7],
    }
    if scope != "public":
        return result
    version = util.IPv4 if address.version == 4 else util.IPv6
    # New lightweight searcher per request; immutable content buffer is shared.
    client = searcher.new_with_buffer(version, buffer_for(address.version))
    try:
        raw = client.search(str(address))
    finally:
        client.close()
    if not raw:
        result["scope"] = "unmapped"
        return result
    fields = raw.split("|")
    if len(fields) != 5:
        raise RuntimeError("Unexpected XDB field format")
    _country, region, city, _isp, code = fields
    for name, field in zip(("country", "region", "city", "isp", "country_code"), fields):
        result[name] = None if field in ("", "0", "Reserved") else field
    result["location"] = places().get(f"{code}|{region}|{city}")
    return result
