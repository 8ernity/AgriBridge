"""Illustrative carbon estimate API router; results are not certified or field calibrated."""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.entities import Plot
from app.schemas.entities import (
    CarbonCalculatorRequest,
    CarbonCalculatorResponse
)
from app.services.carbon_service import calculate_carbon_and_biomass
from app.adapters.soil import get_plot_soil
from app.adapters.satellite import get_plot_ndvi

router = APIRouter(prefix="/carbon", tags=["Carbon Sequestration & Soil Biomass Calculator"])


@router.post("/calculate", response_model=CarbonCalculatorResponse, summary="Calculate regenerative carbon sequestration & biomass")
def calculate_carbon_endpoint(req: CarbonCalculatorRequest):
    """
    Returns an illustrative formula-based estimate for user-supplied practices; it is not field calibrated or certified.
    """
    return calculate_carbon_and_biomass(req)


@router.get("/plot/{plot_id}", response_model=CarbonCalculatorResponse, summary="Get illustrative carbon estimate for plot")
async def get_plot_carbon_endpoint(
    plot_id: str,
    tillage: Optional[str] = Query("zero_till", description="conventional, reduced, or zero_till"),
    cover_crop: Optional[str] = Query("legume", description="none, non_legume, or legume"),
    organic_amendment: Optional[str] = Query("compost", description="none, manure, biochar, manure_biochar"),
    agroforestry: Optional[bool] = Query(False, description="Agroforestry shelterbelt border"),
    years: Optional[int] = Query(5, ge=1, le=10, description="Projection years"),
    carbon_price: Optional[float] = Query(20.0, ge=5.0, le=100.0, description="Carbon credit price USD/t"),
    lang: Optional[str] = Query("en", description="Target language (en, hi, bn, sw)"),
    db: Session = Depends(get_db)
):
    """
    Uses environmental adapter values (which may be synthetic demo data) as inputs to an illustrative formula.
    """
    p = db.query(Plot).filter(Plot.id == plot_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Plot not found")

    soil = await get_plot_soil(p.lat, p.lon)
    ndvi = await get_plot_ndvi(p.lat, p.lon)

    latest_ndvi = 0.65
    if ndvi and ndvi.series and len(ndvi.series) > 0:
        latest_ndvi = ndvi.series[-1].ndvi

    req = CarbonCalculatorRequest(
        plot_id=p.id,
        area_ha=p.area_ha or 1.0,
        soil_ph=soil.ph.value if soil and soil.ph else 6.8,
        soc_g_kg=soil.organic_carbon_g_kg.value if soil and soil.organic_carbon_g_kg else 8.5,
        soil_texture=soil.texture_class if soil and soil.texture_class else "Clay Loam",
        current_ndvi=latest_ndvi,
        tillage_practice=tillage,
        cover_crop=cover_crop,
        organic_amendment=organic_amendment,
        agroforestry_border=agroforestry,
        carbon_price_per_ton=carbon_price,
        years_projection=years,
        language=lang
    )

    return calculate_carbon_and_biomass(req)


@router.get("/methodology", summary="Scientific methodology & emission factor standards")
def get_methodology():
    """Returns scientific reference citations, pedotransfer constants, and emission factor standards."""
    return {
        "framework": "Simplified illustrative calculation; not an IPCC Tier-2 inventory",
        "volume": "Not implemented",
        "pedotransfer_function": "Not implemented",
        "biomass_model": "Illustrative formula-based estimate; no Sentinel-2 band-derived inputs or field calibration are currently implemented",
        "microbial_biomass": "Illustrative estimate only; no fumigation-extraction measurements are collected",
        "india_initiative": "No INDIA AgriSmart certification or registry integration is implemented",
        "open_source_commitment": "A SHA-256 calculation fingerprint is returned for repeatability; it is not a certificate, audit, or carbon-credit verification"
    }
