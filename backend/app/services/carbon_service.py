"""Illustrative deterministic carbon estimate service; not field calibrated or certified."""
import math
import hashlib
import datetime
from typing import List, Dict, Tuple
from app.schemas.entities import (
    CarbonCalculatorRequest,
    CarbonCalculatorResponse,
    YearlyCarbonPoint
)


def _estimate_bulk_density(soil_texture: str, soc_g_kg: float) -> float:
    """
    Pedotransfer estimation of bulk density (g/cm^3) based on Saxton & Rawls (2006)
    and USDA-NRCS soil texture bulk density reference values.
    """
    texture_lower = (soil_texture or "clay loam").lower()
    if "sand" in texture_lower:
        base_bd = 1.52
    elif "clay" in texture_lower:
        base_bd = 1.25
    elif "silt" in texture_lower:
        base_bd = 1.32
    else:  # loam / clay loam
        base_bd = 1.35

    # Organic carbon reduces bulk density (spongier soil matrix)
    # 1 g/kg = 0.1% SOC
    soc_pct = soc_g_kg * 0.1
    adjusted_bd = max(1.05, min(1.65, base_bd - (0.045 * math.sqrt(max(0.1, soc_pct)))))
    return round(adjusted_bd, 3)


def calculate_carbon_and_biomass(req: CarbonCalculatorRequest) -> CarbonCalculatorResponse:
    """
    Executes comprehensive regenerative soil carbon sequestration and biomass modeling.
    """
    depth_cm = 30.0  # Standard agricultural root-zone topsoil layer
    gravel_fraction = 0.05  # Average mineral stone fraction in cultivated soils

    # 1. Baseline Soil Organic Carbon (SOC) Stock (t C/ha)
    bulk_density = _estimate_bulk_density(req.soil_texture, req.soc_g_kg)
    # SOC stock (t C/ha) = SOC (g/kg) * BD (g/cm^3) * depth (cm) * 0.1 * (1 - gravel)
    baseline_soc_stock = req.soc_g_kg * bulk_density * depth_cm * 0.1 * (1.0 - gravel_fraction)
    baseline_soc_stock = round(baseline_soc_stock, 2)
    total_baseline_soc = round(baseline_soc_stock * req.area_ha, 2)

    # 2. Annual Sequestration Rates by Regenerative Interventions (t CO2e / ha / year)
    # Note: 1 ton of Soil Carbon (C) = 3.67 tons of CO2 equivalent (44/12)
    practice_breakdown: Dict[str, float] = {}

    # Tillage Practice
    tillage_rates = {
        "conventional": 0.0,
        "reduced": 0.75,
        "zero_till": 1.55
    }
    tillage_sequestration = tillage_rates.get(req.tillage_practice.lower(), 1.55)
    practice_breakdown["tillage_management"] = tillage_sequestration

    # Cover Cropping & Legume Inoculation
    cover_rates = {
        "none": 0.0,
        "non_legume": 0.70,
        "legume": 1.25  # High root exudates and biomass return
    }
    cover_sequestration = cover_rates.get(req.cover_crop.lower(), 1.25)
    practice_breakdown["cover_crop_roots"] = cover_sequestration

    # Organic Carbon Amendment
    amendment_rates = {
        "none": 0.0,
        "compost": 0.85,
        "manure": 0.95,
        "biochar": 2.35,  # Pyrogenic persistent carbon with decadal stability
        "manure_biochar": 3.10
    }
    amendment_sequestration = amendment_rates.get(req.organic_amendment.lower(), 0.85)
    practice_breakdown["organic_amendment"] = amendment_sequestration

    # Agroforestry / Windbreak Buffer Planting
    agroforestry_rate = 1.60 if req.agroforestry_border else 0.0
    practice_breakdown["agroforestry_border"] = agroforestry_rate

    annual_sequestration_rate_per_ha = round(
        tillage_sequestration + cover_sequestration + amendment_sequestration + agroforestry_rate,
        2
    )
    total_annual_co2e = round(annual_sequestration_rate_per_ha * req.area_ha, 2)

    # 3. Simplified exponential projection model
    # Soils gradually reach carbon saturation capacity as active pools stabilize
    k_saturation = 0.16
    yearly_trajectory: List[YearlyCarbonPoint] = []
    years_to_compute = max(1, min(10, req.years_projection))

    for yr in range(1, years_to_compute + 1):
        # Saturation coefficient: (1 - exp(-k * yr)) / k
        effective_years = (1.0 - math.exp(-k_saturation * yr)) / k_saturation
        cum_co2e_per_ha = annual_sequestration_rate_per_ha * effective_years
        cum_c_stock = baseline_soc_stock + (cum_co2e_per_ha / 3.67)
        cum_total_co2e = round(cum_co2e_per_ha * req.area_ha, 2)
        dividend_usd = round(cum_total_co2e * req.carbon_price_per_ton, 2)

        yearly_trajectory.append(YearlyCarbonPoint(
            year=yr,
            soc_stock_t_per_ha=round(cum_c_stock, 2),
            cumulative_co2e_t=cum_total_co2e,
            carbon_dividend_usd=dividend_usd
        ))

    cumulative_co2e_sequestered = yearly_trajectory[-1].cumulative_co2e_t if yearly_trajectory else 0.0

    # 4. Formula-based illustrative biomass indices
    ndvi = max(0.15, min(0.92, req.current_ndvi))
    # Above-ground biomass (kg/ha) exponential allometric canopy relation
    aboveground_biomass = round(1450.0 * math.exp(1.82 * ndvi), 1)
    # Below-ground root biomass: 28% root-to-shoot ratio
    belowground_biomass = round(aboveground_biomass * 0.28, 1)
    # Soil microbial biomass carbon (SMBC): 2.8% of total active SOC pool
    soil_microbial_biomass = round(baseline_soc_stock * 1000.0 * 0.028, 1)

    # 5. Avoided Synthetic Fertilizer Greenhouse Gas Emissions
    # 1 kg synthetic nitrogen fertilizer avoided = 5.8 kg CO2e avoided (Haber-Bosch + N2O field emission)
    if req.cover_crop == "legume":
        fixed_nitrogen_kg_per_ha = 65.0
        avoided_n2o_kg = round(fixed_nitrogen_kg_per_ha * 5.8 * req.area_ha, 1)
    else:
        avoided_n2o_kg = 0.0

    # 6. Carbon Dividend & Valuation
    annual_dividend_usd = round(total_annual_co2e * req.carbon_price_per_ton, 2)
    # Currency conversions: INR (India) is default for South Asia demo
    inr_rate = 84.0
    annual_dividend_local = round(annual_dividend_usd * inr_rate, 2)
    local_currency_symbol = "₹"

    # 7. Illustrative score tier
    if annual_sequestration_rate_per_ha >= 4.5:
        stewardship_tier = "Platinum Illustrative Score"
    elif annual_sequestration_rate_per_ha >= 2.5:
        stewardship_tier = "High Illustrative Score"
    elif annual_sequestration_rate_per_ha >= 1.0:
        stewardship_tier = "Moderate Illustrative Score"
    else:
        stewardship_tier = "Low Illustrative Score"

    # 8. Localized Agronomic Recommendations
    recs: List[str] = []
    lang = (req.language or "en").lower()

    if lang == "hi":
        if req.tillage_practice != "zero_till":
            recs.append("शून्य-जुताई (Zero-till) अपनाएं: इससे मिट्टी की संरचना सुरक्षित रहती है और प्रति हेक्टेयर 1.55 टन अतिरिक्त कार्बन संचित होता है।")
        if req.cover_crop != "legume":
            recs.append("दलहनी फसल चक्र शामिल करें: चना, मूंग या सनई से हवा की नाइट्रोजन मिट्टी में स्थिर होती है और रासायनिक यूरिया का खर्च बचता है।")
        if "biochar" not in req.organic_amendment:
            recs.append("बायोचार (Biochar) या वर्मीकम्पोस्ट मिलाएं: बायोचार का कार्बन 100 वर्षों से अधिक समय तक मिट्टी में स्थिर रहकर जल धारण क्षमता बढ़ाता है।")
        if not req.agroforestry_border:
            recs.append("खेत की मेड़ों पर कृषि-वानिकी वृक्ष लगाएं: हवा के कटाव से बचाव के साथ अतिरिक्त कार्बन क्रेडिट अर्जित करें।")
    elif lang == "bn":
        if req.tillage_practice != "zero_till":
            recs.append("শূন্য-চাষ পদ্ধতি অবলম্বন করুন: এতে মাটির গঠন সুরক্ষিত থাকে এবং হেক্টর প্রতি কার্বন সঞ্চয় বৃদ্ধি পায়।")
        if req.cover_crop != "legume":
            recs.append("ডালজাতীয় ফসলের পর্যায়ক্রম অন্তর্ভুক্ত করুন: এটি মাটিতে প্রাকৃতিক নাইট্রোজেন যোগ করে রাসায়নিক সারের ব্যবহার কমায়।")
        if "biochar" not in req.organic_amendment:
            recs.append("বায়োচার বা কেঁচো সার প্রয়োগ করুন: মাটির জল ধারণ ক্ষমতা ও উর্বরতা দীর্ঘমেয়াদে বাড়ে।")
    else:
        if req.tillage_practice != "zero_till":
            recs.append("Transition to Zero-Tillage: Minimizes aggregate disturbance, locking in +1.55 t CO2e/ha/yr into stable macro-aggregates.")
        if req.cover_crop != "legume":
            recs.append("Integrate Legume Cover Cropping: Chickpea, cowpea or sunn hemp fix atmospheric nitrogen, slashing synthetic urea needs.")
        if "biochar" not in req.organic_amendment:
            recs.append("Incorporate Biochar Amendment: Pyrogenic recalcitrant carbon provides a >100-year stable carbon sink and boosts cation exchange.")
        if not req.agroforestry_border:
            recs.append("Consider windbreak trees for shelter and shade; this estimate does not calculate carbon credits.")

    # 9. Calculation fingerprint; this is not a certificate or verification.
    cert_input = f"{req.plot_id or 'anon'}-{baseline_soc_stock}-{annual_sequestration_rate_per_ha}-{req.area_ha}-{datetime.date.today().isoformat()}"
    cert_hash = f"INDIA-AGRISMART-SOC-{hashlib.sha256(cert_input.encode()).hexdigest()[:16].upper()}"

    methodology_info = "Illustrative deterministic estimate using user-provided inputs and simplified assumptions; not field-calibrated, IPCC-verified, or eligible as a carbon-credit measurement."

    return CarbonCalculatorResponse(
        baseline_soc_stock_t_per_ha=baseline_soc_stock,
        total_baseline_soc_t=total_baseline_soc,
        annual_sequestration_rate_t_co2e_per_ha=annual_sequestration_rate_per_ha,
        total_annual_co2e_sequestered_t=total_annual_co2e,
        cumulative_co2e_sequestered_t=cumulative_co2e_sequestered,
        avoided_n2o_emissions_kg=avoided_n2o_kg,
        soil_microbial_biomass_kg_per_ha=soil_microbial_biomass,
        aboveground_canopy_biomass_kg_per_ha=aboveground_biomass,
        belowground_root_biomass_kg_per_ha=belowground_biomass,
        annual_carbon_dividend_usd=annual_dividend_usd,
        annual_carbon_dividend_local=annual_dividend_local,
        local_currency_symbol=local_currency_symbol,
        stewardship_tier=stewardship_tier,
        yearly_trajectory=yearly_trajectory,
        practice_breakdown=practice_breakdown,
        recommendations=recs,
        methodology=methodology_info,
        india_certificate_hash=cert_hash,
        certificate_hash=cert_hash
    )
