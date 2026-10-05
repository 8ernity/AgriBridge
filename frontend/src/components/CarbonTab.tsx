import React, { useState, useEffect, useMemo } from 'react';
import {
  Leaf,
  Shield,
  Award,
  TrendingUp,
  DollarSign,
  Layers,
  Sparkles,
  TreeDeciduous,
  Sprout,
  HelpCircle,
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  Info
} from 'lucide-react';
import { Plot, CarbonCalculatorRequest, CarbonCalculatorResponse } from '../types';
import { apiClient } from '../services/api';
import { Locale, TRANSLATIONS } from '../services/i18n';

interface CarbonTabProps {
  locale: Locale;
  plots: Plot[];
  selectedPlot: Plot | null;
  onSelectPlot: (plot: Plot) => void;
}

export const CarbonTab: React.FC<CarbonTabProps> = ({
  locale,
  plots,
  selectedPlot,
  onSelectPlot,
}) => {
  const t = TRANSLATIONS[locale] || TRANSLATIONS.en;

  // Form State
  const [selectedPlotId, setSelectedPlotId] = useState<string>(selectedPlot ? selectedPlot.id : 'custom');
  const [areaHa, setAreaHa] = useState<number>(selectedPlot ? selectedPlot.area_ha : 1.0);
  const [soilTexture, setSoilTexture] = useState<string>('Clay Loam');
  const [socGKg, setSocGKg] = useState<number>(8.8);
  const [currentNdvi, setCurrentNdvi] = useState<number>(0.68);
  const [tillagePractice, setTillagePractice] = useState<'conventional' | 'reduced' | 'zero_till'>('zero_till');
  const [coverCrop, setCoverCrop] = useState<'none' | 'non_legume' | 'legume'>('legume');
  const [organicAmendment, setOrganicAmendment] = useState<'none' | 'manure' | 'biochar' | 'manure_biochar'>('biochar');
  const [agroforestryBorder, setAgroforestryBorder] = useState<boolean>(true);
  const [carbonPrice, setCarbonPrice] = useState<number>(25.0);
  const [yearsProjection, setYearsProjection] = useState<number>(5);

  // Calculation State
  const [result, setResult] = useState<CarbonCalculatorResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [copiedHash, setCopiedHash] = useState<boolean>(false);
  const [showMethodology, setShowMethodology] = useState<boolean>(false);

  // When selectedPlot prop changes or is clicked
  useEffect(() => {
    if (selectedPlot) {
      setSelectedPlotId(selectedPlot.id);
      setAreaHa(selectedPlot.area_ha || 1.0);
      // Fetch actual soil baseline if available
      apiClient.getPlotSoil(selectedPlot.id).then((soil) => {
        if (soil && soil.organic_carbon_g_kg) {
          setSocGKg(soil.organic_carbon_g_kg.value);
        }
        if (soil && soil.texture_class) {
          setSoilTexture(soil.texture_class);
        }
      }).catch(() => {});
    }
  }, [selectedPlot]);

  // Handle Plot Dropdown Change
  const handlePlotChange = (id: string) => {
    setSelectedPlotId(id);
    if (id === 'custom') return;
    const found = plots.find((p) => p.id === id);
    if (found) {
      onSelectPlot(found);
      setAreaHa(found.area_ha || 1.0);
    }
  };

  // Run calculation
  const runCalculation = async () => {
    setLoading(true);
    try {
      const req: CarbonCalculatorRequest = {
        plot_id: selectedPlotId !== 'custom' ? selectedPlotId : undefined,
        area_ha: areaHa,
        soil_ph: 6.8,
        soc_g_kg: socGKg,
        soil_texture: soilTexture,
        current_ndvi: currentNdvi,
        tillage_practice: tillagePractice,
        cover_crop: coverCrop,
        organic_amendment: organicAmendment,
        agroforestry_border: agroforestryBorder,
        carbon_price_per_ton: carbonPrice,
        years_projection: yearsProjection,
        language: locale
      };
      const res = await apiClient.calculateCarbon(req);
      setResult(res);
    } catch (e) {
      console.error('Carbon calculation failed', e);
    } finally {
      setLoading(false);
    }
  };

  // Run calculation on parameter updates
  useEffect(() => {
    const timer = setTimeout(() => {
      runCalculation();
    }, 180);
    return () => clearTimeout(timer);
  }, [
    selectedPlotId,
    areaHa,
    soilTexture,
    socGKg,
    currentNdvi,
    tillagePractice,
    coverCrop,
    organicAmendment,
    agroforestryBorder,
    carbonPrice,
    yearsProjection,
    locale
  ]);

  const copyCertHash = () => {
    const hash = result?.certificate_hash || result?.india_certificate_hash;
    if (!hash) return;
    navigator.clipboard.writeText(hash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2200);
  };

  // Trajectory Chart Calculation for SVG rendering
  const trajectoryChartData = useMemo(() => {
    if (!result?.yearly_trajectory || result.yearly_trajectory.length === 0) return null;
    const points = result.yearly_trajectory;
    const maxCo2e = Math.max(...points.map((p) => p.cumulative_co2e_t), 1.0);
    const minCo2e = 0;
    const width = 580;
    const height = 180;
    const padding = { top: 20, right: 30, bottom: 35, left: 50 };

    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    const coords = points.map((p, index) => {
      const x = padding.left + (index / Math.max(1, points.length - 1)) * chartW;
      const y = padding.top + chartH - ((p.cumulative_co2e_t - minCo2e) / (maxCo2e - minCo2e || 1)) * chartH;
      return { x, y, point: p };
    });

    const pathD = coords.reduce((acc, curr, idx) => {
      return idx === 0 ? `M ${curr.x} ${curr.y}` : `${acc} L ${curr.x} ${curr.y}`;
    }, '');

    const areaD = coords.length > 0
      ? `${pathD} L ${coords[coords.length - 1].x} ${padding.top + chartH} L ${coords[0].x} ${padding.top + chartH} Z`
      : '';

    return { coords, pathD, areaD, width, height, padding, maxCo2e };
  }, [result?.yearly_trajectory]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '3rem' }}>
      {/* Hero Header Card */}
      <div
        className="glass-card"
        style={{
          padding: '1.75rem',
          borderRadius: '1.25rem',
          position: 'relative',
          overflow: 'hidden',
          background: 'var(--card)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--glass-shadow)'
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: 'rgba(154, 205, 50, 0.15)',
                  border: '1px solid rgba(154, 205, 50, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--brand-green)'
                }}
              >
                <Leaf size={20} />
              </div>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--brand-green)',
                  background: 'rgba(154, 205, 50, 0.12)',
                  padding: '0.2rem 0.6rem',
                  borderRadius: '1rem',
                  border: '1px solid rgba(154, 205, 50, 0.3)'
                }}
              >
                Illustrative Carbon Estimate • Demo Data
              </span>
            </div>
            <h1
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '1.65rem',
                fontWeight: 800,
                color: 'var(--foreground)',
                margin: 0,
                lineHeight: 1.25
              }}
            >
              {t.carbonTitle || 'Regenerative Carbon & Soil Biomass Calculator'}
            </h1>
            <p
              style={{
                color: 'var(--text-muted)',
                fontSize: '0.88rem',
                marginTop: '0.35rem',
                marginBottom: 0,
                maxWidth: '680px'
              }}
            >
              {t.carbonSubtitle || 'Simplified estimates for demonstration only; not field calibrated or suitable for carbon-credit claims.'}
            </p>
          </div>

          <button
            onClick={() => setShowMethodology(!showMethodology)}
            className="modern-btn-secondary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.82rem',
              padding: '0.55rem 0.95rem',
              borderRadius: '0.75rem',
              background: 'var(--muted)',
              border: '1px solid var(--border)',
              color: 'var(--foreground)',
              cursor: 'pointer'
            }}
          >
            <Info size={16} />
            <span>Calculation Assumptions</span>
            <ChevronDown size={14} style={{ transform: showMethodology ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </button>
        </div>

        {/* Methodology Accordion */}
        {showMethodology && (
          <div
            style={{
              marginTop: '1.25rem',
              padding: '1rem 1.25rem',
              borderRadius: '0.85rem',
              background: 'var(--muted)',
              border: '1px solid var(--border)',
              fontSize: '0.82rem',
              lineHeight: 1.6,
              color: 'var(--text-muted)'
            }}
          >
            <div style={{ fontWeight: 600, color: 'var(--brand-green)', marginBottom: '0.3rem' }}>
              🔬 Illustrative Calculation Assumptions
            </div>
            <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
              <li>The calculator uses simplified, uncalibrated formulas and user-entered or demo inputs.</li>
              <li>It does not implement verified IPCC Tier-2, SoilGrids pedotransfer, RothC, or satellite-band processing.</li>
              <li><strong>Calculation fingerprint:</strong> The SHA-256 value helps identify the calculation inputs; it is not a certificate, audit, or carbon-credit verification.</li>
            </ul>
          </div>
        )}
      </div>

      {/* Main Grid: Controls on Left, KPIs & Visualizations on Right */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '1.5rem',
          alignItems: 'start'
        }}
      >
        {/* Left Column: Interactive Parameters */}
        <div
          className="glass-card"
          style={{
            padding: '1.5rem',
            borderRadius: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.35rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Layers size={18} style={{ color: 'var(--brand-green)' }} />
              <span>{t.carbonPlotSoilBaseline || 'Plot & Soil Baseline'}</span>
            </h2>
            {loading && <RefreshCw size={16} className="animate-spin" style={{ color: 'var(--brand-green)' }} />}
          </div>

          {/* Plot Selector */}
          <div>
            <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
              {t.carbonSelectPlot || 'Select Registered Farm Plot'}
            </label>
            <select
              value={selectedPlotId}
              onChange={(e) => handlePlotChange(e.target.value)}
              className="modern-input"
              style={{ width: '100%', padding: '0.65rem', borderRadius: '0.65rem' }}
            >
              <option value="custom">{t.carbonCustomParcel || '-- Custom Parcel Parameters --'}</option>
              {plots.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.crop} - {p.area_ha} ha)
                </option>
              ))}
            </select>
          </div>

          {/* Area & SOC Sliders */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '0.25rem' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{t.carbonParcelArea || 'Parcel Area'}</span>
                <span style={{ color: 'var(--brand-green)', fontWeight: 700 }}>{areaHa.toFixed(2)} ha</span>
              </div>
              <input
                type="range"
                min="0.2"
                max="25.0"
                step="0.1"
                value={areaHa}
                onChange={(e) => setAreaHa(parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--brand-green)' }}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '0.25rem' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{t.carbonBaselineSoc || 'Baseline SOC'}</span>
                <span style={{ color: 'var(--brand-cyan)', fontWeight: 700 }}>{socGKg.toFixed(1)} g/kg</span>
              </div>
              <input
                type="range"
                min="2.0"
                max="35.0"
                step="0.5"
                value={socGKg}
                onChange={(e) => setSocGKg(parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--brand-cyan)' }}
              />
            </div>
          </div>

          {/* Soil Texture & Current NDVI */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
                {t.carbonSoilTexture || 'Soil Texture Class'}
              </label>
              <select
                value={soilTexture}
                onChange={(e) => setSoilTexture(e.target.value)}
                className="modern-input"
                style={{ width: '100%', padding: '0.65rem', borderRadius: '0.65rem' }}
              >
                <option value="Clay Loam">Clay Loam</option>
                <option value="Sandy Loam">Sandy Loam</option>
                <option value="Silty Clay">Silty Clay</option>
                <option value="Loam">Loam</option>
                <option value="Black Cotton Soil">Black Vertisol</option>
              </select>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '0.35rem' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{t.carbonNdviInput || 'NDVI input (demo data)'}</span>
                <span style={{ color: 'var(--brand-lime)', fontWeight: 700 }}>{currentNdvi.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.15"
                max="0.90"
                step="0.05"
                value={currentNdvi}
                onChange={(e) => setCurrentNdvi(parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--brand-lime)', marginTop: '0.45rem' }}
              />
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 0.85rem 0', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <Sprout size={16} style={{ color: 'var(--brand-green)' }} />
              <span>{t.carbonPractices || 'Regenerative Interventions'}</span>
            </h3>

            {/* Tillage Practice */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>
                {t.tillagePractice || 'Tillage Practice'}
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                {[
                  { id: 'conventional', label: 'Conventional', rate: '+0.0 t' },
                  { id: 'reduced', label: 'Reduced', rate: '+0.75 t' },
                  { id: 'zero_till', label: 'Zero-Till', rate: '+1.55 t', recommended: true }
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTillagePractice(item.id as any)}
                    style={{
                      padding: '0.55rem 0.4rem',
                      borderRadius: '0.65rem',
                      fontSize: '0.75rem',
                      textAlign: 'center',
                      background: tillagePractice === item.id ? 'rgba(154, 205, 50, 0.15)' : 'var(--muted)',
                      border: tillagePractice === item.id ? '1.5px solid var(--brand-green)' : '1px solid var(--border)',
                      color: tillagePractice === item.id ? 'var(--brand-green)' : 'var(--foreground)',
                      fontWeight: tillagePractice === item.id ? 700 : 500,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div>{item.label}</div>
                    <div style={{ fontSize: '0.68rem', opacity: 0.85, marginTop: '2px', color: tillagePractice === item.id ? 'var(--brand-green)' : 'var(--text-muted)' }}>{item.rate}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Cover Crop */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>
                {t.coverCrop || 'Cover Cropping'}
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                {[
                  { id: 'none', label: 'None / Fallow', rate: '+0.0 t' },
                  { id: 'non_legume', label: 'Non-Legume', rate: '+0.65 t' },
                  { id: 'legume', label: 'Legume Inoc.', rate: '+1.25 t', recommended: true }
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setCoverCrop(item.id as any)}
                    style={{
                      padding: '0.55rem 0.4rem',
                      borderRadius: '0.65rem',
                      fontSize: '0.75rem',
                      textAlign: 'center',
                      background: coverCrop === item.id ? 'rgba(154, 205, 50, 0.15)' : 'var(--muted)',
                      border: coverCrop === item.id ? '1.5px solid var(--brand-green)' : '1px solid var(--border)',
                      color: coverCrop === item.id ? 'var(--brand-green)' : 'var(--foreground)',
                      fontWeight: coverCrop === item.id ? 700 : 500,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div>{item.label}</div>
                    <div style={{ fontSize: '0.68rem', opacity: 0.85, marginTop: '2px', color: coverCrop === item.id ? 'var(--brand-green)' : 'var(--text-muted)' }}>{item.rate}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Soil Organic Amendments */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>
                {t.organicAmendment || 'Organic Amendments'}
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                {[
                  { id: 'none', label: 'Synthetic Only', rate: '+0.00 t' },
                  { id: 'manure', label: 'Farmyard Manure', rate: '+1.10 t' },
                  { id: 'biochar', label: 'Biochar Carbon', rate: '+2.35 t', rec: true },
                  { id: 'manure_biochar', label: 'Biochar + Compost', rate: '+2.85 t' }
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setOrganicAmendment(item.id as any)}
                    style={{
                      padding: '0.55rem 0.5rem',
                      borderRadius: '0.65rem',
                      fontSize: '0.75rem',
                      textAlign: 'left',
                      background: organicAmendment === item.id ? 'rgba(154, 205, 50, 0.15)' : 'var(--muted)',
                      border: organicAmendment === item.id ? '1.5px solid var(--brand-green)' : '1px solid var(--border)',
                      color: organicAmendment === item.id ? 'var(--brand-green)' : 'var(--foreground)',
                      fontWeight: organicAmendment === item.id ? 700 : 500,
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <span>{item.label}</span>
                    <span style={{ fontSize: '0.68rem', opacity: 0.85, color: organicAmendment === item.id ? 'var(--brand-green)' : 'var(--text-muted)' }}>{item.rate}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Agroforestry Border Switch */}
            <div
              onClick={() => setAgroforestryBorder(!agroforestryBorder)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.75rem 0.95rem',
                borderRadius: '0.75rem',
                background: agroforestryBorder ? 'rgba(154, 205, 50, 0.15)' : 'var(--muted)',
                border: agroforestryBorder ? '1.5px solid rgba(154, 205, 50, 0.4)' : '1px solid var(--border)',
                cursor: 'pointer',
                marginBottom: '1rem'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <TreeDeciduous size={18} style={{ color: agroforestryBorder ? 'var(--brand-green)' : 'var(--text-muted)' }} />
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--foreground)' }}>
                    {t.agroforestryBorder || 'Agroforestry Windbreak Trees'}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                    Windbreaks & perimeter tree line (+1.60 t CO₂e/ha/yr)
                  </div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={agroforestryBorder}
                onChange={() => {}}
                style={{ width: '18px', height: '18px', accentColor: 'var(--brand-green)', cursor: 'pointer' }}
              />
            </div>
          </div>

          {/* Market & Horizon Controls */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '0.25rem' }}>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Credit Price</span>
                  <span style={{ color: 'var(--brand-amber)', fontWeight: 700 }}>${carbonPrice}/t</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="60"
                  step="5"
                  value={carbonPrice}
                  onChange={(e) => setCarbonPrice(parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--brand-amber)' }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '0.25rem' }}>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Horizon</span>
                  <span style={{ color: 'var(--brand-purple)', fontWeight: 700 }}>{yearsProjection} Years</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="1"
                  value={yearsProjection}
                  onChange={(e) => setYearsProjection(parseInt(e.target.value, 10))}
                  style={{ width: '100%', accentColor: 'var(--brand-purple)' }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: KPIs, Saturation Curve, Biomass & Certificate */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Live KPI Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: '0.85rem'
            }}
          >
            {/* KPI 1: Annual Rate */}
            <div
              className="glass-card"
              style={{
                padding: '1.1rem',
                borderRadius: '1rem',
                borderLeft: '4px solid var(--brand-green)',
                background: 'var(--card)',
                border: '1px solid var(--border)',
                boxShadow: 'var(--glass-shadow)'
              }}
            >
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>
                {t.carbonAnnualRateBox || 'Annual Rate'}
              </div>
              <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--brand-green)', marginTop: '0.25rem' }}>
                +{result ? result.annual_sequestration_rate_t_co2e_per_ha.toFixed(2) : '--'}
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                t CO₂e / ha / year
              </div>
            </div>

            {/* KPI 2: Total Annual Sequestration */}
            <div
              className="glass-card"
              style={{
                padding: '1.1rem',
                borderRadius: '1rem',
                borderLeft: '4px solid var(--brand-cyan)',
                background: 'var(--card)',
                border: '1px solid var(--border)',
                boxShadow: 'var(--glass-shadow)'
              }}
            >
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>
                {t.carbonTotalAnnualBox || 'Total Annual CO₂e'}
              </div>
              <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--brand-cyan)', marginTop: '0.25rem' }}>
                {result ? result.total_annual_co2e_sequestered_t.toFixed(2) : '--'} t
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                across {areaHa.toFixed(1)} ha parcel
              </div>
            </div>

            {/* KPI 3: Cumulative Sequestration */}
            <div
              className="glass-card"
              style={{
                padding: '1.1rem',
                borderRadius: '1rem',
                borderLeft: '4px solid var(--brand-purple)',
                background: 'var(--card)',
                border: '1px solid var(--border)',
                boxShadow: 'var(--glass-shadow)'
              }}
            >
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>
                {yearsProjection}-Year Cumulative
              </div>
              <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--brand-purple)', marginTop: '0.25rem' }}>
                {result ? result.cumulative_co2e_sequestered_t.toFixed(1) : '--'} t
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                stabilized carbon stock
              </div>
            </div>

            {/* KPI 4: Carbon Dividend */}
            <div
              className="glass-card"
              style={{
                padding: '1.1rem',
                borderRadius: '1rem',
                borderLeft: '4px solid var(--brand-amber)',
                background: 'var(--card)',
                border: '1px solid var(--border)',
                boxShadow: 'var(--glass-shadow)'
              }}
            >
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>
                {t.carbonDividendBox || 'Carbon Dividend'}
              </div>
              <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--brand-amber)', marginTop: '0.25rem' }}>
                {result ? `${result.local_currency_symbol}${Math.round(result.annual_carbon_dividend_local).toLocaleString()}` : '--'}
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                (${result ? result.annual_carbon_dividend_usd.toFixed(0) : '--'} USD / yr)
              </div>
            </div>
          </div>

          {/* Illustrative exponential projection curve */}
          <div
            className="glass-card"
            style={{
              padding: '1.35rem',
              borderRadius: '1.15rem',
              background: 'var(--card)',
              border: '1px solid var(--border)',
              boxShadow: 'var(--glass-shadow)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
              <div>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <TrendingUp size={16} style={{ color: 'var(--brand-green)' }} />
                  <span>{t.carbonProjTitle || 'Illustrative Multi-Year Projection'}</span>
                </h3>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {t.carbonProjSubtitle || 'Microbial aggregate stabilization trajectory up to Year'} {yearsProjection}
                </div>
              </div>

              {result && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    background: 'rgba(154, 205, 50, 0.12)',
                    color: 'var(--brand-green)',
                    padding: '0.25rem 0.65rem',
                    borderRadius: '0.65rem',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    border: '1px solid rgba(154, 205, 50, 0.3)'
                  }}
                >
                  <Award size={14} />
                  <span>{result.stewardship_tier}</span>
                </div>
              )}
            </div>

            {/* SVG Visualizer */}
            {trajectoryChartData && (
              <div style={{ width: '100%', overflowX: 'auto' }}>
                <svg
                  viewBox={`0 0 ${trajectoryChartData.width} ${trajectoryChartData.height}`}
                  style={{ width: '100%', height: 'auto', display: 'block' }}
                >
                  <defs>
                    <linearGradient id="carbonGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#9acd32" stopOpacity="0.35" />
                      <stop offset="100%" stopColor="#9acd32" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal Gridlines */}
                  {[0, 0.33, 0.66, 1].map((ratio, i) => {
                    const y = trajectoryChartData.padding.top + (1 - ratio) * (trajectoryChartData.height - trajectoryChartData.padding.top - trajectoryChartData.padding.bottom);
                    const val = (ratio * trajectoryChartData.maxCo2e).toFixed(0);
                    return (
                      <g key={i}>
                        <line
                          x1={trajectoryChartData.padding.left}
                          y1={y}
                          x2={trajectoryChartData.width - trajectoryChartData.padding.right}
                          y2={y}
                          stroke="var(--border)"
                          strokeDasharray="4 4"
                        />
                        <text
                          x={trajectoryChartData.padding.left - 8}
                          y={y + 4}
                          fill="var(--text-muted)"
                          fontSize="9"
                          textAnchor="end"
                          fontFamily="monospace"
                        >
                          {val}t
                        </text>
                      </g>
                    );
                  })}

                  {/* Area fill */}
                  <path d={trajectoryChartData.areaD} fill="url(#carbonGradient)" />

                  {/* Curve Line */}
                  <path
                    d={trajectoryChartData.pathD}
                    fill="none"
                    stroke="#9acd32"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {/* Points and Year Labels */}
                  {trajectoryChartData.coords.map(({ x, y, point }, i) => (
                    <g key={i}>
                      <circle
                        cx={x}
                        cy={y}
                        r={point.year === yearsProjection ? 5.5 : 3.5}
                        fill={point.year === yearsProjection ? 'var(--brand-green)' : 'var(--card)'}
                        stroke="var(--brand-green)"
                        strokeWidth="2"
                      />
                      <text
                        x={x}
                        y={trajectoryChartData.height - 12}
                        fill={point.year === yearsProjection ? 'var(--brand-green)' : 'var(--text-muted)'}
                        fontSize="9"
                        textAnchor="middle"
                        fontWeight={point.year === yearsProjection ? 'bold' : 'normal'}
                      >
                        Y{point.year}
                      </text>
                    </g>
                  ))}
                </svg>
              </div>
            )}
          </div>

          {/* Biomass & Soil Microbiome Breakdown Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '0.85rem'
            }}
          >
            {/* Annual Sequestration */}
            <div
              className="glass-card"
              style={{
                padding: '1rem',
                borderRadius: '0.95rem',
                background: 'var(--card)',
                border: '1px solid var(--border)',
                boxShadow: 'var(--glass-shadow)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.35rem' }}>
                <TrendingUp size={16} style={{ color: 'var(--brand-green)' }} />
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--foreground)' }}>
                  {t.carbonAnnualSeqTitle || 'Annual Sequestration'}
                </span>
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--brand-green)' }}>
                {result ? result.total_annual_co2e_sequestered_t.toLocaleString() : '--'} t CO₂e
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                {t.carbonAnnualSeqDesc || 'Total estimated yearly sequestration'}
              </div>
            </div>

            {/* Projected Dividend */}
            <div
              className="glass-card"
              style={{
                padding: '1rem',
                borderRadius: '0.95rem',
                background: 'var(--card)',
                border: '1px solid var(--border)',
                boxShadow: 'var(--glass-shadow)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.35rem' }}>
                <DollarSign size={16} style={{ color: 'var(--brand-amber)' }} />
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--foreground)' }}>
                  {t.carbonDividendTitle || 'Projected Dividend'}
                </span>
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--brand-amber)' }}>
                {result ? `${result.local_currency_symbol}${result.annual_carbon_dividend_local.toLocaleString()}` : '--'}
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                {t.carbonDividendDesc || 'Estimated annual payout'}
              </div>
            </div>
            {/* Above-ground Canopy */}
            <div
              className="glass-card"
              style={{
                padding: '1rem',
                borderRadius: '0.95rem',
                background: 'var(--card)',
                border: '1px solid var(--border)',
                boxShadow: 'var(--glass-shadow)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.35rem' }}>
                <Sprout size={16} style={{ color: 'var(--brand-green)' }} />
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--foreground)' }}>
                  {t.carbonCanopyTitle || 'Canopy Biomass (NDVI)'}
                </span>
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--brand-green)' }}>
                {result ? result.aboveground_canopy_biomass_kg_per_ha.toLocaleString() : '--'} kg/ha
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                {t.carbonCanopyDesc || 'Formula-based canopy estimate; no satellite pixels are used'}
              </div>
            </div>

            {/* Below-ground Roots */}
            <div
              className="glass-card"
              style={{
                padding: '1rem',
                borderRadius: '0.95rem',
                background: 'var(--card)',
                border: '1px solid var(--border)',
                boxShadow: 'var(--glass-shadow)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.35rem' }}>
                <Layers size={16} style={{ color: 'var(--brand-cyan)' }} />
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--foreground)' }}>
                  {t.carbonRootTitle || 'Root System Biomass'}
                </span>
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--brand-cyan)' }}>
                {result ? result.belowground_root_biomass_kg_per_ha.toLocaleString() : '--'} kg/ha
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                {t.carbonRootDesc || '28% root-to-shoot allocation factor'}
              </div>
            </div>

            {/* Microbial Biomass (SMBC) */}
            <div
              className="glass-card"
              style={{
                padding: '1rem',
                borderRadius: '0.95rem',
                background: 'var(--card)',
                border: '1px solid var(--border)',
                boxShadow: 'var(--glass-shadow)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.35rem' }}>
                <Sparkles size={16} style={{ color: 'var(--brand-purple)' }} />
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--foreground)' }}>
                  {t.carbonMicrobialTitle || 'Soil Microbial Carbon'}
                </span>
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--brand-purple)' }}>
                {result ? result.soil_microbial_biomass_kg_per_ha.toLocaleString() : '--'} kg/ha
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                {t.carbonMicrobialDesc || 'Active biological rhizosphere pool'}
              </div>
            </div>

            {/* Avoided N2O */}
            <div
              className="glass-card"
              style={{
                padding: '1rem',
                borderRadius: '0.95rem',
                background: 'var(--card)',
                border: '1px solid var(--border)',
                boxShadow: 'var(--glass-shadow)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.35rem' }}>
                <Shield size={16} style={{ color: 'var(--brand-amber)' }} />
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--foreground)' }}>
                  {t.carbonAvoidedTitle || 'Avoided N₂O Emissions'}
                </span>
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--brand-amber)' }}>
                {result ? result.avoided_n2o_emissions_kg.toLocaleString() : '0'} kg
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                {t.carbonAvoidedDesc || 'CO₂e saved by legume nitrogen fixation'}
              </div>
            </div>
          </div>

          {/* Agronomic Recommendations */}
          {result?.recommendations && result.recommendations.length > 0 && (
            <div
              className="glass-card"
              style={{
                padding: '1.25rem',
                borderRadius: '1rem',
                background: 'var(--card)',
                border: '1px solid var(--border)',
                boxShadow: 'var(--glass-shadow)'
              }}
            >
              <h3 style={{ fontSize: '0.92rem', fontWeight: 700, margin: '0 0 0.65rem 0', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <Leaf size={16} style={{ color: 'var(--brand-green)' }} />
                <span>Localized Regenerative Recommendations</span>
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                {result.recommendations.map((rec, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.5rem',
                      fontSize: '0.8rem',
                      lineHeight: 1.5,
                      color: 'var(--foreground)',
                      background: 'var(--muted)',
                      padding: '0.55rem 0.75rem',
                      borderRadius: '0.6rem',
                      border: '1px solid var(--border)',
                      borderLeft: '3px solid var(--brand-green)'
                    }}
                  >
                    <span>{rec}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Calculation fingerprint card */}
          {result && (
            <div
              className="glass-card"
              style={{
                padding: '1.35rem',
                borderRadius: '1.15rem',
                background: 'linear-gradient(135deg, var(--card) 0%, var(--muted) 100%)',
                border: '1px solid var(--border)',
                boxShadow: 'var(--glass-shadow)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      background: 'rgba(154, 205, 50, 0.15)',
                      border: '1.5px solid var(--brand-green)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--brand-green)'
                    }}
                  >
                    <Award size={22} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.98rem', fontWeight: 800, color: 'var(--foreground)' }}>
                      {t.indiaCertificate || 'Soil Carbon Stewardship Assessment'}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      Demo estimate; not certified or audited
                    </div>
                  </div>
                </div>

                <button
                  onClick={copyCertHash}
                  className="modern-btn-secondary"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    fontSize: '0.75rem',
                    padding: '0.45rem 0.8rem',
                    borderRadius: '0.65rem',
                    background: copiedHash ? 'rgba(154, 205, 50, 0.25)' : 'var(--muted)',
                    border: '1px solid var(--border)',
                    color: copiedHash ? 'var(--brand-green)' : 'var(--foreground)',
                    cursor: 'pointer'
                  }}
                >
                  {copiedHash ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copiedHash ? 'Fingerprint Copied' : 'Copy Calculation Fingerprint'}</span>
                </button>
              </div>

              <div
                style={{
                  marginTop: '1rem',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '0.65rem',
                  background: 'var(--muted)',
                  border: '1px solid var(--border)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.75rem',
                  color: 'var(--brand-green)',
                  wordBreak: 'break-all',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <span>{result.certificate_hash || result.india_certificate_hash}</span>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'sans-serif', marginLeft: '0.5rem' }}>
                  SHA-256 fingerprint; not verification
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
