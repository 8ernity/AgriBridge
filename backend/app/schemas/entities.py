"""Pydantic request and response schemas for AgriBridge REST API."""
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


# Plot Schemas
class PlotCreate(BaseModel):
    name: str = Field(..., json_schema_extra={"example": "Varanasi Tomato Field"})
    crop: str = Field(..., json_schema_extra={"example": "tomato"})
    sowing_date: Optional[str] = Field(None, json_schema_extra={"example": "2026-08-15"})
    lat: float = Field(..., json_schema_extra={"example": 25.3176})
    lon: float = Field(..., json_schema_extra={"example": 82.9739})
    area_ha: Optional[float] = Field(0.5, json_schema_extra={"example": 0.5})
    geom_geojson: Optional[str] = None
    device_id: Optional[str] = None


class PlotResponse(BaseModel):
    id: str
    name: str
    crop: str
    sowing_date: Optional[str]
    lat: float
    lon: float
    area_ha: float
    geom_geojson: Optional[str]
    created_at: str
    is_demo_data: bool = False

    class Config:
        from_attributes = True


# Environmental Schemas
class WeatherDayForecast(BaseModel):
    date: str
    max_temp_c: float
    min_temp_c: float
    precipitation_sum_mm: float
    condition: str


class WeatherResponse(BaseModel):
    lat: float
    lon: float
    current_temp_c: float
    current_humidity_pct: float
    current_condition: str
    precipitation_30d_mm: float
    forecast_7d: List[WeatherDayForecast]
    source_attribution: str
    license: str
    cached_at: str
    is_demo_data: bool = False


class SoilPropertyEstimate(BaseModel):
    name: str
    value: float
    unit: str
    description: str
    rating: str  # "Low", "Optimal", "High", "Acidic", "Neutral", "Alkaline"


class SoilResponse(BaseModel):
    lat: float
    lon: float
    ph: SoilPropertyEstimate
    organic_carbon_g_kg: SoilPropertyEstimate
    nitrogen_cg_kg: SoilPropertyEstimate
    sand_fraction_pct: float
    silt_fraction_pct: float
    clay_fraction_pct: float
    texture_class: str
    depth: str
    source_attribution: str
    license: str
    is_fallback: bool
    cached_at: str


class NDVIPoint(BaseModel):
    date: str
    ndvi: float
    cloud_cover_pct: float


class NDVIResponse(BaseModel):
    lat: float
    lon: float
    series: List[NDVIPoint]
    current_ndvi: float
    trend: str  # "increasing", "stable", "declining"
    interpretation: str
    source_attribution: str
    license: str
    is_demo_data: bool = False


# Disease Classifier Schemas
class DiseasePrediction(BaseModel):
    class_name: str
    crop: str
    disease_name: str
    confidence: float


class SourceCitation(BaseModel):
    source_id: str
    title: str
    publisher: str
    url: Optional[str] = None
    license: str
    passage_text: str


class ScanResponse(BaseModel):
    model_config = {"protected_namespaces": ()}

    scan_id: str
    plot_id: Optional[str] = None
    crop: Optional[str] = None
    top_disease: str
    confidence: float
    status: str  # "confident" | "uncertain"
    predictions: List[DiseasePrediction]
    symptoms: List[str]
    causes: List[str]
    management_summary: str
    cultural_practices: List[str]
    chemical_warning: str
    retake_guidance: Optional[str] = None
    gradcam_heatmap_url: Optional[str] = None
    sources: List[SourceCitation]
    model_version: str
    created_at: str
    is_demo_data: bool = False
    guidance_is_demo_data: bool = True


# Regenerative Agronomy Schemas
class CropRecommendation(BaseModel):
    crop_id: str
    crop_name: str
    local_name: Optional[str] = None
    family: str
    suitability_score: float  # 0 to 100
    rank: int
    rationale: str
    is_legume_or_cover: bool
    soil_fit: str
    climate_fit: str
    rotation_benefit: str
    inputs_used: Dict[str, Any]


class RecommendationResponse(BaseModel):
    plot_id: str
    current_crop: str
    top_recommendations: List[CropRecommendation]
    regenerative_summary: str
    reviewed_by: str
    attribution: str
    is_demo_data: bool = False


# RAG Advisory Schemas
class AdvisoryRequest(BaseModel):
    plot_id: Optional[str] = None
    scan_id: Optional[str] = None
    question: str
    language: Optional[str] = "en"
    history: List[Dict[str, str]] = []


class AdvisoryResponse(BaseModel):
    advisory_id: str
    question: str
    answer: str
    sources: List[SourceCitation]
    language: str
    safety_disclaimer: str
    generation_source: str = "local_demo_fallback"
    is_demo_data: bool = True
    extension_helpline: Optional[str] = None
    created_at: str


# Feedback Schema
class FeedbackRequest(BaseModel):
    feedback: str  # "helpful" or "not_helpful"
    reason: Optional[str] = None


# Carbon Sequestration & Soil Biomass Schemas
class YearlyCarbonPoint(BaseModel):
    year: int
    soc_stock_t_per_ha: float
    cumulative_co2e_t: float
    carbon_dividend_usd: float


class CarbonCalculatorRequest(BaseModel):
    plot_id: Optional[str] = None
    area_ha: float = 1.0
    soil_ph: float = 6.8
    soc_g_kg: float = 8.5
    soil_texture: str = "Clay Loam"
    current_ndvi: float = 0.65
    tillage_practice: str = "zero_till"  # "conventional", "reduced", "zero_till"
    cover_crop: str = "legume"  # "none", "non_legume", "legume"
    organic_amendment: str = "compost"  # "none", "manure", "biochar", "manure_biochar"
    agroforestry_border: bool = False
    carbon_price_per_ton: float = 20.0
    years_projection: int = 5
    language: str = "en"


class CarbonCalculatorResponse(BaseModel):
    baseline_soc_stock_t_per_ha: float
    total_baseline_soc_t: float
    annual_sequestration_rate_t_co2e_per_ha: float
    total_annual_co2e_sequestered_t: float
    cumulative_co2e_sequestered_t: float
    avoided_n2o_emissions_kg: float
    soil_microbial_biomass_kg_per_ha: float
    aboveground_canopy_biomass_kg_per_ha: float
    belowground_root_biomass_kg_per_ha: float
    annual_carbon_dividend_usd: float
    annual_carbon_dividend_local: float
    local_currency_symbol: str
    stewardship_tier: str  # "Silver", "Gold", "Platinum INDIA AgriSmart Champion"
    yearly_trajectory: List[YearlyCarbonPoint]
    practice_breakdown: Dict[str, float]
    recommendations: List[str]
    methodology: str
    certificate_hash: Optional[str] = None
    india_certificate_hash: str
    is_demo_data: bool = True

