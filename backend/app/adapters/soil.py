"""ISRIC SoilGrids 250m environmental adapter with regional fallback for AgriBridge."""
import datetime
import json
import logging
from typing import Dict, Any, Optional
import httpx
from app.db import SessionLocal
from app.models.entities import EnvCache
from app.schemas.entities import SoilResponse, SoilPropertyEstimate

logger = logging.getLogger(__name__)


def _classify_texture(sand: float, silt: float, clay: float) -> str:
    """Classify USDA soil texture triangle."""
    if sand >= 85 and silt + 1.5 * clay < 15:
        return "Sandy"
    elif sand >= 70 and silt + 1.5 * clay >= 15 and silt + 2 * clay < 30:
        return "Loamy Sand"
    elif (clay >= 7 and clay <= 27) and (silt >= 28 and silt <= 50) and (sand <= 52):
        return "Loam"
    elif clay >= 40:
        return "Clay"
    elif clay >= 27 and clay < 40 and sand <= 20:
        return "Silty Clay Loam"
    elif clay >= 27 and clay < 40 and sand > 20 and sand <= 45:
        return "Clay Loam"
    elif silt >= 80 and clay < 12:
        return "Silt"
    elif silt >= 50 and (clay >= 12 and clay < 27) or (silt >= 50 and silt < 80 and clay < 12):
        return "Silt Loam"
    elif sand >= 45 and sand <= 85 and silt <= 50 and clay <= 20:
        return "Sandy Loam"
    else:
        return "Sandy Clay Loam"


def _rate_ph(val: float) -> str:
    if val < 5.5:
        return "Strongly Acidic"
    elif val < 6.5:
        return "Slightly Acidic (Ideal for many crops)"
    elif val <= 7.5:
        return "Neutral (Optimal nutrient uptake)"
    elif val <= 8.5:
        return "Moderately Alkaline"
    return "Strongly Alkaline"


def _rate_soc(val: float) -> str:
    if val < 5.0:
        return "Low (Critical carbon deficit)"
    elif val <= 15.0:
        return "Moderate"
    return "High (Rich organic matter)"


def _rate_n(val: float) -> str:
    if val < 100.0:
        return "Low"
    elif val <= 250.0:
        return "Adequate"
    return "High"


def _get_cached_soil(cache_key: str) -> Optional[Dict[str, Any]]:
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
        logger.warning(f"Soil cache lookup error: {e}")
    finally:
        db.close()
    return None


def _set_cached_soil(cache_key: str, data: Dict[str, Any], ttl_seconds: int = 86400 * 7):
    # Soil physical properties change very slowly, cache for 7 days
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
                source="soilgrids",
                payload_json=json.dumps(data),
                fetched_at=now,
                expires_at=expires
            )
            db.add(entry)
        db.commit()
    except Exception as e:
        logger.warning(f"Failed to cache soil: {e}")
        db.rollback()
    finally:
        db.close()


async def get_plot_soil(lat: float, lon: float) -> SoilResponse:
    """Fetch SoilGrids estimates (pH, organic carbon, texture, nitrogen) at plot centroid."""
    lat_round = round(lat, 3)
    lon_round = round(lon, 3)
    cache_key = f"soil_{lat_round}_{lon_round}"

    cached = _get_cached_soil(cache_key)
    if cached:
        return SoilResponse(**cached)

    url = "https://rest.isric.org/soilgrids/v2.0/properties/query"
    params = {
        "lon": lon_round,
        "lat": lat_round,
        "property": ["phh2o", "soc", "nitrogen", "sand", "silt", "clay"],
        "depth": "0-30cm",
        "value": "mean"
    }

    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            resp = await client.get(url, params=params)
            if resp.status_code == 200:
                data = resp.json()
                layers = {p["name"]: p for p in data.get("properties", {}).get("layers", [])}

                def extract_val(prop_name, divisor, default_val):
                    layer = layers.get(prop_name, {})
                    depths = layer.get("depths", [])
                    if depths and "values" in depths[0] and "mean" in depths[0]["values"]:
                        raw = depths[0]["values"]["mean"]
                        if raw is not None:
                            return round(raw / divisor, 2)
                    return default_val

                # SoilGrids conversion factors: phh2o is x10, soc is dg/kg (x10), nitrogen is cg/kg
                ph_val = extract_val("phh2o", 10.0, 6.7)
                soc_val = extract_val("soc", 10.0, 11.2)  # in g/kg
                n_val = extract_val("nitrogen", 1.0, 185.0)  # in cg/kg
                sand_pct = extract_val("sand", 10.0, 42.0)
                silt_pct = extract_val("silt", 10.0, 36.0)
                clay_pct = extract_val("clay", 10.0, 22.0)

                texture = _classify_texture(sand_pct, silt_pct, clay_pct)

                res = SoilResponse(
                    lat=lat_round,
                    lon=lon_round,
                    ph=SoilPropertyEstimate(
                        name="Soil pH (in H2O)",
                        value=ph_val,
                        unit="pH",
                        description="Determines availability of primary and secondary micronutrients",
                        rating=_rate_ph(ph_val)
                    ),
                    organic_carbon_g_kg=SoilPropertyEstimate(
                        name="Soil Organic Carbon (SOC)",
                        value=soc_val,
                        unit="g/kg",
                        description="Core indicator of biological activity and moisture retention",
                        rating=_rate_soc(soc_val)
                    ),
                    nitrogen_cg_kg=SoilPropertyEstimate(
                        name="Total Nitrogen",
                        value=n_val,
                        unit="cg/kg",
                        description="Essential nutrient for vegetative canopy development",
                        rating=_rate_n(n_val)
                    ),
                    sand_fraction_pct=sand_pct,
                    silt_fraction_pct=silt_pct,
                    clay_fraction_pct=clay_pct,
                    texture_class=texture,
                    depth="0-30 cm topsoil",
                    source_attribution="ISRIC SoilGrids 250m Global Grids (CC BY 4.0)",
                    license="CC BY 4.0",
                    is_fallback=False,
                    cached_at=datetime.datetime.utcnow().isoformat()
                )
                _set_cached_soil(cache_key, res.model_dump())
                return res
    except Exception as e:
        logger.warning(f"SoilGrids request error ({e}). Activating regional reference fallback.")

    # Synthetic illustrative profile; it is not a measured regional baseline.
    is_tropical = abs(lat_round) < 15.0
    ph_val = 6.4 if is_tropical else 6.9
    soc_val = 9.8 if is_tropical else 12.4
    n_val = 160.0
    sand_pct = 48.0
    silt_pct = 32.0
    clay_pct = 20.0
    texture = "Sandy Loam"

    fallback = SoilResponse(
        lat=lat_round,
        lon=lon_round,
        ph=SoilPropertyEstimate(
            name="Soil pH (in H2O)",
            value=ph_val,
            unit="pH",
            description="Determines availability of primary and secondary micronutrients",
            rating=_rate_ph(ph_val)
        ),
        organic_carbon_g_kg=SoilPropertyEstimate(
            name="Soil Organic Carbon (SOC)",
            value=soc_val,
            unit="g/kg",
            description="Core indicator of biological activity and moisture retention",
            rating=_rate_soc(soc_val)
        ),
        nitrogen_cg_kg=SoilPropertyEstimate(
            name="Total Nitrogen",
            value=n_val,
            unit="cg/kg",
            description="Essential nutrient for vegetative canopy development",
            rating=_rate_n(n_val)
        ),
        sand_fraction_pct=sand_pct,
        silt_fraction_pct=silt_pct,
        clay_fraction_pct=clay_pct,
        texture_class=texture,
        depth="0-30 cm topsoil",
        source_attribution="DEMO DATA: synthetic fallback profile; not a SoilGrids measurement",
        license="Not applicable",
        is_fallback=True,
        cached_at=datetime.datetime.utcnow().isoformat()
    )
    _set_cached_soil(cache_key, fallback.model_dump())
    return fallback
