"""Copernicus Sentinel-2 L2A STAC Satellite adapter with caching for AgriBridge."""
import datetime
import json
import logging
from typing import List, Dict, Any, Optional
import httpx

from app.db import SessionLocal
from app.models.entities import EnvCache
from app.schemas.entities import NDVIResponse, NDVIPoint

logger = logging.getLogger(__name__)

STAC_ENDPOINT = "https://earth-search.aws.element84.com/v1/search"


def _get_cached_ndvi(cache_key: str) -> Optional[Dict[str, Any]]:
    db = SessionLocal()
    try:
        now = datetime.datetime.utcnow()
        entry = db.query(EnvCache).filter(
            EnvCache.key == cache_key,
            EnvCache.expires_at > now
        ).first()
        if entry:
            return json.loads(entry.payload_json)
    except Exception as e:
        logger.warning(f"NDVI cache lookup failed: {e}")
    finally:
        db.close()
    return None


def _set_cached_ndvi(cache_key: str, data: Dict[str, Any], ttl_seconds: int = 86400):
    db = SessionLocal()
    try:
        now = datetime.datetime.utcnow()
        expires = now + datetime.timedelta(seconds=ttl_seconds)
        entry = db.query(EnvCache).filter(EnvCache.key == cache_key).first()
        if entry:
            entry.payload_json = json.dumps(data)
            entry.fetched_at = now
            entry.expires_at = expires
        else:
            entry = EnvCache(
                key=cache_key,
                source="earth_search_stac",
                payload_json=json.dumps(data),
                fetched_at=now,
                expires_at=expires
            )
            db.add(entry)
        db.commit()
    except Exception as e:
        logger.warning(f"Failed to cache NDVI: {e}")
        db.rollback()
    finally:
        db.close()


async def get_plot_ndvi(lat: float, lon: float) -> NDVIResponse:
    """
    Queries Sentinel-2 STAC scenes. NDVI values are currently synthetic demo values;
    STAC scene metadata alone does not provide the band calculations needed for NDVI.
    """
    lat_round = round(lat, 3)
    lon_round = round(lon, 3)
    cache_key = f"sentinel2_demo_v2_{lat_round}_{lon_round}"

    cached = _get_cached_ndvi(cache_key)
    if cached:
        return NDVIResponse(**cached)

    today = datetime.date.today()
    start_date = today - datetime.timedelta(days=90)
    delta = 0.02
    bbox = [lon_round - delta, lat_round - delta, lon_round + delta, lat_round + delta]

    payload = {
        "collections": ["sentinel-2-l2a"],
        "bbox": bbox,
        "datetime": f"{start_date.isoformat()}T00:00:00Z/{today.isoformat()}T23:59:59Z",
        "limit": 25
    }

    points: List[NDVIPoint] = []

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(STAC_ENDPOINT, json=payload)
            if resp.status_code == 200:
                data = resp.json()
                features = data.get("features", [])

                # Do not convert STAC metadata into NDVI; that requires Red/NIR band pixels.
    except Exception as err:
        logger.warning(f"Sentinel-2 STAC query error: {err}. Returning synthetic demo data.")

    # Synthetic demonstration values, never satellite measurements.
    if not points:
        for days_ago in [75, 60, 45, 30, 15, 2]:
            obs_dt = (today - datetime.timedelta(days=days_ago)).isoformat()
            points.append(NDVIPoint(
                date=obs_dt,
                ndvi=round(0.48 + ((90 - days_ago) / 90.0) * 0.18, 3),
                cloud_cover_pct=5.2
            ))

    current_val = points[-1].ndvi if points else 0.58
    past_val = points[0].ndvi if points else 0.45

    if current_val - past_val > 0.06:
        trend = "increasing"
        interpretation = "Synthetic illustrative trend only; it does not indicate actual crop condition."
    elif current_val - past_val < -0.06:
        trend = "declining"
        interpretation = "Synthetic illustrative trend only; it does not indicate actual crop condition."
    else:
        trend = "stable"
        interpretation = "Synthetic illustrative trend only; it does not indicate actual crop condition."

    result = NDVIResponse(
        lat=lat_round,
        lon=lon_round,
        series=points,
        current_ndvi=current_val,
        trend=trend,
        interpretation=interpretation,
        source_attribution="DEMO DATA: synthetic NDVI series; Sentinel-2 scene metadata is not processed into NDVI",
        license="Not applicable",
        is_demo_data=True
    )

    _set_cached_ndvi(cache_key, result.model_dump())
    return result
