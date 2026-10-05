export interface Plot {
  id: str;
  name: str;
  crop: str;
  sowing_date?: string;
  lat: number;
  lon: number;
  area_ha: number;
  geom_geojson?: string;
  created_at: string;
  is_demo_data?: boolean;
}

type str = string;

export interface WeatherDayForecast {
  date: string;
  max_temp_c: number;
  min_temp_c: number;
  precipitation_sum_mm: number;
  condition: string;
}

export interface WeatherData {
  lat: number;
  lon: number;
  current_temp_c: number;
  current_humidity_pct: number;
  current_condition: string;
  precipitation_30d_mm: number;
  forecast_7d: WeatherDayForecast[];
  source_attribution: string;
  license: string;
  cached_at: string;
  is_demo_data?: boolean;
}

export interface SoilEstimate {
  name: string;
  value: number;
  unit: string;
  description: string;
  rating: string;
}

export interface SoilData {
  lat: number;
  lon: number;
  ph: SoilEstimate;
  organic_carbon_g_kg: SoilEstimate;
  nitrogen_cg_kg: SoilEstimate;
  sand_fraction_pct: number;
  silt_fraction_pct: number;
  clay_fraction_pct: number;
  texture_class: string;
  depth: string;
  source_attribution: string;
  license: string;
  is_fallback: boolean;
  cached_at: string;
}

export interface NDVIPoint {
  date: string;
  ndvi: number;
  cloud_cover_pct: number;
}

export interface NDVIData {
  lat: number;
  lon: number;
  series: NDVIPoint[];
  current_ndvi: number;
  trend: 'increasing' | 'stable' | 'declining';
  interpretation: string;
  source_attribution: string;
  license: string;
  is_demo_data?: boolean;
}

export interface DiseasePrediction {
  class_name: string;
  crop: string;
  disease_name: string;
  confidence: number;
}

export interface SourceCitation {
  source_id: string;
  title: string;
  publisher: string;
  url?: string;
  license: string;
  passage_text: string;
}

export interface ScanResult {
  scan_id: string;
  plot_id?: string;
  crop?: string;
  top_disease: string;
  confidence: number;
  status: 'confident' | 'uncertain';
  predictions: DiseasePrediction[];
  symptoms: string[];
  causes: string[];
  management_summary: string;
  cultural_practices: string[];
  chemical_warning: string;
  retake_guidance?: string;
  sources: SourceCitation[];
  model_version: string;
  is_demo_data?: boolean;
  guidance_is_demo_data?: boolean;
  created_at: string;
  local_image_url?: string;
  gradcam_heatmap_url?: string;
}

export interface CropRecommendation {
  crop_id: string;
  crop_name: string;
  local_name?: string;
  family: string;
  suitability_score: number;
  rank: number;
  rationale: string;
  is_legume_or_cover: boolean;
  soil_fit: string;
  climate_fit: string;
  rotation_benefit: string;
  inputs_used: Record<string, any>;
}

export interface RecommendationData {
  plot_id: string;
  current_crop: string;
  top_recommendations: CropRecommendation[];
  regenerative_summary: string;
  reviewed_by: string;
  attribution: string;
  is_demo_data?: boolean;
}

export interface AdvisoryMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  sources?: SourceCitation[];
  safety_disclaimer?: string;
  generation_source?: 'gemma_4_api' | 'local_demo_fallback' | 'local_safety_guardrail';
  is_demo_data?: boolean;
  timestamp: string;
}

export interface CountryConfig {
  country_code: string;
  country_name: string;
  default_locale: string;
  supported_languages: { code: string; name: string; local_name: string }[];
  default_coordinates: { lat: number; lon: number; zoom: number };
  default_plots?: any[];
  crops: any[];
  extension_service?: { agency: string; kisan_toll_free: string; portal_url: string };
}

export interface YearlyCarbonPoint {
  year: number;
  soc_stock_t_per_ha: number;
  cumulative_co2e_t: number;
  carbon_dividend_usd: number;
}

export interface CarbonCalculatorRequest {
  plot_id?: string;
  area_ha: number;
  soil_ph: number;
  soc_g_kg: number;
  soil_texture: string;
  current_ndvi: number;
  tillage_practice: 'conventional' | 'reduced' | 'zero_till';
  cover_crop: 'none' | 'non_legume' | 'legume';
  organic_amendment: 'none' | 'manure' | 'biochar' | 'manure_biochar';
  agroforestry_border: boolean;
  carbon_price_per_ton: number;
  years_projection: number;
  language: string;
}

export interface CarbonCalculatorResponse {
  baseline_soc_stock_t_per_ha: number;
  total_baseline_soc_t: number;
  annual_sequestration_rate_t_co2e_per_ha: number;
  total_annual_co2e_sequestered_t: number;
  cumulative_co2e_sequestered_t: number;
  avoided_n2o_emissions_kg: number;
  soil_microbial_biomass_kg_per_ha: number;
  aboveground_canopy_biomass_kg_per_ha: number;
  belowground_root_biomass_kg_per_ha: number;
  annual_carbon_dividend_usd: number;
  annual_carbon_dividend_local: number;
  local_currency_symbol: string;
  stewardship_tier: string;
  yearly_trajectory: YearlyCarbonPoint[];
  practice_breakdown: Record<string, number>;
  recommendations: string[];
  methodology: string;
  india_certificate_hash: string;
  certificate_hash?: string;
  is_demo_data?: boolean;
}
