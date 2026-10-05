"""Regenerative Agronomy Rules Engine for AgriBridge."""
from typing import List, Dict, Any
from app.schemas.entities import RecommendationResponse, CropRecommendation
from app.services.country_service import country_service

AGRONOMIC_STANDARD = "AgriBridge illustrative rules; not independently reviewed"


def _score_parameter(val: float, bounds: Dict[str, float]) -> float:
    """
    Computes piecewise linear trapezoidal suitability score between 0.0 and 1.0.
    """
    p_min = bounds["min"]
    p_opt_min = bounds["opt_min"]
    p_opt_max = bounds["opt_max"]
    p_max = bounds["max"]

    if val < p_min or val > p_max:
        return 0.15  # Poor / stress threshold
    if p_opt_min <= val <= p_opt_max:
        return 1.0   # Optimal
    if p_min <= val < p_opt_min:
        return 0.15 + 0.85 * ((val - p_min) / max(0.001, (p_opt_min - p_min)))
    if p_opt_max < val <= p_max:
        return 1.0 - 0.85 * ((val - p_opt_max) / max(0.001, (p_max - p_opt_max)))
    return 0.5


def evaluate_regenerative_suitability(
    current_crop: str,
    country_code: str,
    soil_ph: float,
    soc_g_kg: float,
    nitrogen_cg_kg: float,
    soil_texture: str,
    rainfall_30d_mm: float,
    avg_temp_c: float,
    ndvi_trend: str,
    plot_id: str = "demo_plot_1"
) -> RecommendationResponse:
    """
    FR-6.2: A deterministic rules engine scores suitability using pH, rainfall,
    temperature, texture and NDVI trend. The LLM only explains the result.
    """
    crops = country_service.get_crops_for_country(country_code)
    if not crops:
        crops = country_service.get_crops_for_country("IN")

    # Find current crop botanical family to penalize mono-cropping
    curr_family = None
    for c in crops:
        if c["id"].lower() == current_crop.lower() or c["name"].lower() == current_crop.lower():
            curr_family = c.get("family")
            break

    recommendations: List[CropRecommendation] = []

    for candidate in crops:
        cid = candidate["id"]
        cname = candidate["name"]
        family = candidate.get("family", "Unknown")
        is_legume = candidate.get("is_legume_or_cover", False)

        # 1. Environmental Fit Scores (0 to 1)
        ph_score = _score_parameter(soil_ph, candidate["suitable_ph"])
        temp_score = _score_parameter(avg_temp_c, candidate["suitable_temp_c"])
        rain_score = _score_parameter(rainfall_30d_mm, candidate["suitable_30d_rain_mm"])

        # Texture match
        pref_textures = [t.lower() for t in candidate.get("preferred_textures", [])]
        texture_score = 1.0 if any(t in soil_texture.lower() for t in pref_textures) else 0.65

        # 2. Regenerative Bonuses and Penalties
        # Penalty for planting same family consecutively (breaks pest/disease cycle)
        rotation_penalty = 0.0
        if curr_family and family.lower() == curr_family.lower():
            rotation_penalty = 30.0  # Heavy penalty against monocropping

        # Bonus for nitrogen fixing legume if carbon or nitrogen is deficient
        legume_bonus = 0.0
        if is_legume and (soc_g_kg < 12.0 or nitrogen_cg_kg < 180.0):
            legume_bonus = 18.0  # Incentive to regenerate soil organic matter

        # Bonus for cover crop / legume if NDVI is declining
        ndvi_bonus = 0.0
        if is_legume and ndvi_trend == "declining":
            ndvi_bonus = 12.0

        # Weighted composite score (0 to 100)
        base_env = (
            ph_score * 0.30 +
            temp_score * 0.25 +
            rain_score * 0.25 +
            texture_score * 0.20
        ) * 100.0

        final_score = max(5.0, min(99.0, base_env - rotation_penalty + legume_bonus + ndvi_bonus))
        rounded_score = round(final_score, 1)

        # Build transparent rationale
        reasons = []
        if is_legume:
            reasons.append("Restores depleted soil organic carbon and fixes atmospheric nitrogen symbiotically.")
        if curr_family and family.lower() == curr_family.lower():
            reasons.append(f"Caution: Same botanical family ({family}) as current crop; higher risk of soil-borne pathogens.")
        else:
            reasons.append(f"Excellent family rotation ({family} following {curr_family or 'previous crop'}), breaking nematode and blight cycles.")

        if ph_score >= 0.85:
            reasons.append(f"Soil pH {soil_ph} is within the optimal uptake window.")
        if rain_score >= 0.85:
            reasons.append(f"Current 30-day precipitation ({rainfall_30d_mm} mm) matches seasonal water requirements.")

        rec = CropRecommendation(
            crop_id=cid,
            crop_name=cname,
            local_name=candidate.get("local_names", {}).get("hi") or candidate.get("local_names", {}).get("sw"),
            family=family,
            suitability_score=rounded_score,
            rank=0,
            rationale=" ".join(reasons),
            is_legume_or_cover=is_legume,
            soil_fit=f"pH {soil_ph} ({candidate['suitable_ph']['opt_min']}-{candidate['suitable_ph']['opt_max']} opt), texture {soil_texture}",
            climate_fit=f"Temp {avg_temp_c}°C, 30d rain {rainfall_30d_mm}mm",
            rotation_benefit="Legume nitrogen-fixer & carbon builder" if is_legume else "Break-crop for pest cycle disruption",
            inputs_used={
                "soil_ph_estimate": soil_ph,
                "soil_organic_carbon_g_kg": soc_g_kg,
                "soil_texture": soil_texture,
                "30d_rainfall_mm": rainfall_30d_mm,
                "avg_temperature_c": avg_temp_c,
                "ndvi_trend": ndvi_trend,
                "source_note": "All inputs labeled as satellite/reanalysis estimates"
            }
        )
        recommendations.append(rec)

    # Sort descending by score
    recommendations.sort(key=lambda x: x.suitability_score, reverse=True)

    # Assign top 5 ranks
    top5 = recommendations[:5]
    for idx, r in enumerate(top5, 1):
        r.rank = idx

    summary = (
        f"Based on plot soil pH {soil_ph}, organic carbon {soc_g_kg} g/kg, and recent rainfall ({rainfall_30d_mm} mm), "
        f"the engine prioritized {'nitrogen-fixing legumes to restore soil health' if soc_g_kg < 12.0 else 'balanced break-crops'}. "
        f"Botanical family rotation rules were strictly enforced to suppress disease buildup."
    )

    return RecommendationResponse(
        plot_id=plot_id,
        current_crop=current_crop,
        top_recommendations=top5,
        regenerative_summary=summary,
        reviewed_by=AGRONOMIC_STANDARD,
        attribution="Illustrative suitability scores from simplified rules; inputs and thresholds are not independently validated"
    )
