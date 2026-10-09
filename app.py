import logging
import os
import sqlite3
from typing import Literal

from fastapi import FastAPI, HTTPException, Query, Request, Response
from pydantic import BaseModel, Field
from starlette.responses import JSONResponse

from plotip.lookup import lookup, manifest
from plotip.ranges import list_areas, list_ranges

app = FastAPI(
    title="Plotip",
    version="0.1.0",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
    redoc_url=None,
)
logger = logging.getLogger("plotip")


class LookupInput(BaseModel):
    ip: str = Field(min_length=1, max_length=64)


def resolve(value: str):
    try:
        return lookup(value)
    except ValueError:
        raise HTTPException(status_code=400, detail="invalid_ip") from None
    except (OSError, RuntimeError):
        logger.exception("Offline lookup data unavailable")
        raise HTTPException(status_code=503, detail="data_unavailable") from None


@app.post("/api/lookup")
def query(body: LookupInput, response: Response):
    response.headers["Cache-Control"] = "no-store"
    return resolve(body.ip)


@app.get("/api/me")
def me(request: Request, response: Response):
    response.headers["Cache-Control"] = "private, no-store"
    # Only trust the platform-owned header while actually hosted on Vercel.
    value = request.headers.get("x-vercel-forwarded-for", "") if os.environ.get("VERCEL") else ""
    value = value.split(",")[0].strip() or (request.client.host if request.client else "")
    if not value:
        raise HTTPException(status_code=400, detail="client_ip_unavailable")
    return resolve(value)


@app.get("/api/health")
def health():
    data = manifest()
    return {
        "status": "ok",
        "data_version": data["ip2region_commit"][:7],
        "data_prepared": data["prepared"],
    }


def reverse_response(response: Response, action, *args):
    try:
        result = action(*args)
    except KeyError:
        raise HTTPException(status_code=404, detail="area_not_found") from None
    except sqlite3.Error:
        logger.exception("Reverse lookup index unavailable")
        raise HTTPException(status_code=503, detail="data_unavailable") from None
    response.headers["Cache-Control"] = "public, max-age=300, s-maxage=3600"
    return result


@app.get("/api/areas")
def areas(response: Response, country: str | None = Query(None, pattern=r"^[A-Z]{2}$")):
    return reverse_response(response, list_areas, country)


@app.get("/api/ranges")
def ranges(
    response: Response,
    area: str = Query(
        ..., min_length=1, max_length=64, pattern=r"^(country:[A-Z]{2}|region:[A-Za-z0-9-]+)$"
    ),
    version: Literal["4", "6"] = "4",
    after: int = Query(0, ge=0, le=9223372036854775807),
):
    return reverse_response(response, list_ranges, area, int(version), after)


# Vercel promotes frontend files to its CDN and omits that directory from
# the Python bundle. A CDN miss must return 404, not a static-directory error.
@app.exception_handler(RuntimeError)
async def missing_frontend(request: Request, exc: RuntimeError):
    if os.environ.get("VERCEL") and str(exc) == "StaticFiles directory 'public' does not exist.":
        return JSONResponse({"detail": "Not Found"}, status_code=404)
    raise exc


# Declare the build output explicitly so Vercel promotes generated assets to its CDN.
# check_dir=False also permits running API tests before the frontend is built.
app.frontend("/", directory="public", fallback=None, check_dir=False)
