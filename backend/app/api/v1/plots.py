"""Plot management and environmental data endpoints for AgriBridge."""
import uuid
import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.entities import Plot
from app.schemas.entities import (
    PlotCreate,
    PlotResponse,
    WeatherResponse,
    SoilResponse,
    NDVIResponse,
    RecommendationResponse
)
from app.adapters.weather import get_plot_weather
from app.adapters.soil import get_plot_soil
from app.adapters.satellite import get_plot_ndvi
from app.services.regenerative_service import evaluate_regenerative_suitability

router = APIRouter(prefix="/plots", tags=["Plot Management & Environmental Analytics"])


@router.post("", response_model=PlotResponse, status_code=201, summary="Create a new agricultural plot")
def create_plot(plot_in: PlotCreate, db: Session = Depends(get_db)):
    """Registers a plot with coordinates and crop details."""
    new_plot = Plot(
        id=f"plot_{uuid.uuid4().hex[:8]}",
        device_id=plot_in.device_id,
        name=plot_in.name,
        crop=plot_in.crop,
        sowing_date=plot_in.sowing_date,
        lat=plot_in.lat,
        lon=plot_in.lon,
        area_ha=plot_in.area_ha or 0.5,
        geom_geojson=plot_in.geom_geojson,
        created_at=datetime.datetime.utcnow()
    )
    db.add(new_plot)
    db.commit()
    db.refresh(new_plot)
    return PlotResponse(
        id=new_plot.id,
        name=new_plot.name,
        crop=new_plot.crop,
        sowing_date=new_plot.sowing_date,
        lat=new_plot.lat,
        lon=new_plot.lon,
        area_ha=new_plot.area_ha,
        geom_geojson=new_plot.geom_geojson,
        created_at=new_plot.created_at.isoformat(),
        is_demo_data=False
    )


@router.get("", response_model=List[PlotResponse], summary="List all plots")
def list_plots(device_id: Optional[str] = None, db: Session = Depends(get_db)):
    """Returns stored plots for the device."""
    query = db.query(Plot)
    if device_id:
        query = query.filter(Plot.device_id == device_id)
    plots = query.order_by(Plot.created_at.desc()).all()

    return [
        PlotResponse(
            id=p.id,
            name=p.name,
            crop=p.crop,
            sowing_date=p.sowing_date,
            lat=p.lat,
            lon=p.lon,
            area_ha=p.area_ha,
            geom_geojson=p.geom_geojson,
            created_at=p.created_at.isoformat(),
            is_demo_data=False
        )
        for p in plots
    ]


@router.get("/{plot_id}", response_model=PlotResponse, summary="Get plot details")
def get_plot(plot_id: str, db: Session = Depends(get_db)):
    """Fetch plot metadata by ID."""
    p = db.query(Plot).filter(Plot.id == plot_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Plot not found")
    return PlotResponse(
        id=p.id,
        name=p.name,
        crop=p.crop,
        sowing_date=p.sowing_date,
        lat=p.lat,
        lon=p.lon,
        area_ha=p.area_ha,
        geom_geojson=p.geom_geojson,
        created_at=p.created_at.isoformat(),
        is_demo_data=False
    )


@router.delete("/{plot_id}", summary="Delete plot")
def delete_plot(plot_id: str, db: Session = Depends(get_db)):
    """Delete plot preserving user data autonomy."""
    p = db.query(Plot).filter(Plot.id == plot_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Plot not found")
    db.delete(p)
    db.commit()
    return {"status": "success", "message": "Plot deleted"}


@router.get("/{plot_id}/weather", response_model=WeatherResponse, summary="Get weather for plot")
async def get_plot_weather_endpoint(plot_id: str, db: Session = Depends(get_db)):
    """Returns real-time conditions, 7-day forecast, and 30-day precipitation."""
    p = db.query(Plot).filter(Plot.id == plot_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Plot not found")
    return await get_plot_weather(p.lat, p.lon)


@router.get("/{plot_id}/soil", response_model=SoilResponse, summary="Get soil estimates for plot")
async def get_plot_soil_endpoint(plot_id: str, db: Session = Depends(get_db)):
    """Returns SoilGrids 250m estimates (pH, organic carbon, texture, nitrogen)."""
    p = db.query(Plot).filter(Plot.id == plot_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Plot not found")
    return await get_plot_soil(p.lat, p.lon)


@router.get("/{plot_id}/ndvi", response_model=NDVIResponse, summary="Get NDVI demonstration series")
async def get_plot_ndvi_endpoint(plot_id: str, db: Session = Depends(get_db)):
    """Returns Sentinel-2 cloud-filtered NDVI time series."""
    p = db.query(Plot).filter(Plot.id == plot_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Plot not found")
    return await get_plot_ndvi(p.lat, p.lon)


@router.get("/{plot_id}/recommendations", response_model=RecommendationResponse, summary="Get regenerative crop recommendations")
async def get_plot_recommendations(
    plot_id: str,
    db: Session = Depends(get_db)
):
    """
    Evaluates multi-factor regenerative crop suitability based on live plot soil,
    weather, and vegetation trend.
    """
    p = db.query(Plot).filter(Plot.id == plot_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Plot not found")

    weather = await get_plot_weather(p.lat, p.lon)
    soil = await get_plot_soil(p.lat, p.lon)
    ndvi = await get_plot_ndvi(p.lat, p.lon)

    result = evaluate_regenerative_suitability(
        current_crop=p.crop,
        country_code="IN",
        soil_ph=soil.ph.value,
        soc_g_kg=soil.organic_carbon_g_kg.value,
        nitrogen_cg_kg=soil.nitrogen_cg_kg.value,
        soil_texture=soil.texture_class,
        rainfall_30d_mm=weather.precipitation_30d_mm,
        avg_temp_c=weather.current_temp_c,
        ndvi_trend=ndvi.trend,
        plot_id=p.id
    )
    result.is_demo_data = weather.is_demo_data or soil.is_fallback or ndvi.is_demo_data
    return result
