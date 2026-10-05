import React, { useState, useEffect } from 'react';
import {
  Camera,
  CloudSun,
  MapPin,
  Sparkles,
  AlertTriangle,
  RefreshCw,
  Download,
  ChevronRight,
  TrendingUp,
  Droplets,
  Wind,
  ShieldCheck,
  Activity,
  Layers,
  Sprout,
  Filter,
  Siren,
  FileCheck,
  CheckCircle2
} from 'lucide-react';
import { TRANSLATIONS, Locale } from '../services/i18n';
import { Plot, WeatherData, ScanResult } from '../types';
import { apiClient } from '../services/api';

interface HomeTabProps {
  locale: Locale;
  isOnline: boolean;
  onNavigate: (tab: 'fields' | 'scan' | 'ask' | 'more') => void;
  onSelectPlot: (plot: Plot) => void;
  plots: Plot[];
  offlineQueueCount: number;
  onSyncOfflineQueue: () => void;
}

const REGIONS = [
  "All Plots",
  "Varanasi District",
  "Northern Gangetic Plain",
  "Nashik & Western Ghats",
  "Malwa & Deccan Plateau"
] as const;

export const HomeTab: React.FC<HomeTabProps> = ({
  locale,
  isOnline,
  onNavigate,
  onSelectPlot,
  plots,
  offlineQueueCount,
  onSyncOfflineQueue
}) => {
  const t = TRANSLATIONS[locale] || TRANSLATIONS.en;
  const [selectedRegion, setSelectedRegion] = useState<string>("All Plots");
  const [defaultWeather, setDefaultWeather] = useState<WeatherData | null>(null);
  const [recentScans, setRecentScans] = useState<ScanResult[]>([]);
  const [outbreakAlert, setOutbreakAlert] = useState<any>(null);

  useEffect(() => {
    setRecentScans(apiClient.getScanHistory().slice(0, 3));

    if (plots.length > 0) {
      apiClient.getPlotWeather(plots[0].id)
        .then(w => setDefaultWeather(w))
        .catch(() => {});
    }

    apiClient.getOutbreaks()
      .then(res => {
        if (res && res.length > 0) setOutbreakAlert(res[0]);
      })
      .catch(() => {});
  }, [plots]);

  // CrimeRakshak 4 Primary KPIs
  const kpis = [
    {
      title: t.kpiRegisteredPlots || "Registered Farmland",
      value: `${plots.length} ${locale === 'hi' ? 'खेत' : locale === 'bn' ? 'জমি' : false ? 'Mashamba' : 'Plots'}`,
      sub: t.kpiActiveBoundaries || "Active GPS Boundaries",
      icon: MapPin,
      trend: "+1 plot",
      trendPositive: true,
      color: "var(--brand-green)"
    },
    {
      title: t.kpiCanopyHealth || "Canopy Health (NDVI)",
      value: "0.68 DEMO",
      sub: "Synthetic NDVI demonstration value",
      icon: Activity,
      trend: "DEMO",
      trendPositive: false,
      color: "var(--brand-cyan)"
    },
    {
      title: t.kpiPrecipitation || "30-Day Precipitation",
      value: defaultWeather ? `${defaultWeather.is_demo_data ? 'DEMO ' : ''}${defaultWeather.precipitation_30d_mm} mm` : "DEMO 68.5 mm",
      sub: defaultWeather?.is_demo_data ? "Synthetic fallback; not an observation" : defaultWeather ? "Open-Meteo" : "Synthetic placeholder",
      icon: Droplets,
      trend: defaultWeather?.is_demo_data || !defaultWeather ? "DEMO" : (locale === 'hi' ? 'पर्याप्त' : locale === 'bn' ? 'পর্যাপ্ত' : "Adequate"),
      trendPositive: Boolean(defaultWeather && !defaultWeather.is_demo_data),
      color: "var(--brand-purple)"
    },
    {
      title: t.kpiDiagnosticTriage || "Diagnostic Triage",
      value: recentScans.length > 0 ? (recentScans[0].is_demo_data ? 'DEMO' : recentScans[0].status === 'confident' ? (locale === 'hi' ? 'सफल पहचान' : 'CONFIDENT') : (locale === 'hi' ? 'जांच आवश्यक' : 'UNCERTAIN')) : 'NO SCAN',
      sub: recentScans.length > 0 ? recentScans[0].top_disease : 'No diagnosis recorded',
      icon: ShieldCheck,
      trend: recentScans.length > 0 ? (recentScans[0].is_demo_data ? 'DEMO' : recentScans[0].status === 'uncertain' ? 'Review Needed' : 'Review locally') : 'No scan',
      trendPositive: false,
      color: "var(--brand-amber)"
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Offline Sync Banner */}
      {offlineQueueCount > 0 && (
        <div className="glass-card" style={{
          borderLeft: '4px solid var(--brand-amber)',
          padding: '12px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <RefreshCw size={20} color="var(--brand-amber)" className={isOnline ? 'animate-pulse-slow' : ''} />
            <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>
              {offlineQueueCount} {t.offlineQueue}
            </span>
          </div>
          {isOnline && (
            <button
              onClick={onSyncOfflineQueue}
              className="btn-secondary"
              style={{ padding: '6px 14px', fontSize: '0.8rem' }}
            >
              {t.syncToCloud || "Sync to Cloud"}
            </button>
          )}
        </div>
      )}

      {/* Top Header Section with Greeting & Region Filters */}
      <div style={{
        display: 'flex',
        flexDirection: window.innerWidth < 1100 ? 'column' : 'row',
        justifyContent: 'space-between',
        alignItems: window.innerWidth < 1100 ? 'flex-start' : 'center',
        gap: 16
      }}>
        <div>
          <h1 style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '1.45rem',
            fontWeight: 800,
            color: 'var(--foreground)',
            letterSpacing: '-0.02em',
            margin: 0
          }}>
            {t.greeting || "Good day, Farmer"} 👋
          </h1>
          <p style={{ fontSize: '0.84rem', color: 'var(--muted-foreground)', marginTop: 4 }}>
            {t.homeSubtitle || "Real-time crop health & micro-climate monitoring"}
          </p>
        </div>

        {/* Region Filter Selector Bar */}
        <div
          className="scrollbar-hide"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'var(--card)',
            padding: 4,
            borderRadius: 14,
            border: '1px solid var(--border)',
            overflowX: 'auto',
            maxWidth: '100%'
          }}
        >
          <Filter size={14} color="var(--muted-foreground)" style={{ margin: '0 4px', flexShrink: 0 }} />
          {REGIONS.map((region) => (
            <button
              key={region}
              onClick={() => setSelectedRegion(region)}
              style={{
                padding: '6px 12px',
                borderRadius: 10,
                fontSize: '0.78rem',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s ease',
                background: selectedRegion === region ? 'var(--brand-green)' : 'transparent',
                color: selectedRegion === region ? '#ffffff' : 'var(--muted-foreground)',
                boxShadow: selectedRegion === region ? '0 2px 8px rgba(16, 185, 129, 0.35)' : 'none'
              }}
            >
              {region === "All Plots" ? (t.allPlots || "All Plots") : region}
            </button>
          ))}
        </div>
      </div>

      {/* CrimeRakshak Early Warning Banner & Governance SLA Row */}
      <div className="home-banners-grid">
        {/* Left: Predictive Outbreak Banner */}
        <div
          className="glass-card home-banner-card"
          style={{
            borderLeft: '4px solid var(--brand-red)',
            background: 'linear-gradient(90deg, rgba(239, 68, 68, 0.1) 0%, var(--card) 60%)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{
              padding: 8,
              background: 'rgba(239, 68, 68, 0.15)',
              borderRadius: 12,
              color: 'var(--brand-red)',
              flexShrink: 0
            }}>
              <Siren size={18} className="animate-pulse-slow" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '0.74rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--brand-red)' }}>
                  Outbreak Surveillance
                </span>
                <span style={{
                  fontSize: '0.65rem',
                  fontWeight: 800,
                  fontFamily: 'var(--font-mono)',
                  padding: '1px 6px',
                  borderRadius: 9999,
                  background: 'rgba(239, 68, 68, 0.2)',
                  color: 'var(--brand-red)'
                }}>
                  {outbreakAlert?.is_demo_data ? 'DEMO' : outbreakAlert ? 'REPORTED' : 'NO REPORTS'}
                </span>
              </div>
              <p style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--foreground)', marginTop: 2 }}>
                {outbreakAlert ? `${outbreakAlert.is_demo_data ? 'DEMO DATA — ' : ''}${outbreakAlert.crop.toUpperCase()}: ${outbreakAlert.advisory}` : "No recent outbreak reports."}
              </p>
              <p style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: 2 }}>
                {outbreakAlert?.is_demo_data ? 'Demonstration example only; no outbreak reports are available.' : outbreakAlert ? 'Review the report and confirm symptoms locally before acting.' : 'Reports appear after farmers submit them.'}
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('scan')}
            className="home-banner-btn"
            style={{
              background: 'rgba(239, 68, 68, 0.15)',
              color: 'var(--brand-red)',
              border: '1px solid rgba(239, 68, 68, 0.3)'
            }}
          >
            Launch Scan →
          </button>
        </div>

        {/* Right: Digital Public Good SLA Card */}
        <div
          className="glass-card home-banner-card"
          style={{
            borderLeft: '4px solid var(--brand-teal)',
            background: 'linear-gradient(90deg, rgba(45, 212, 191, 0.1) 0%, var(--card) 60%)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{
              padding: 8,
              background: 'rgba(45, 212, 191, 0.15)',
              borderRadius: 12,
              color: 'var(--brand-teal)',
              flexShrink: 0
            }}>
              <FileCheck size={18} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '0.74rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--brand-teal)' }}>
                  DPG STANDARD ARCHITECTURE
                </span>
                <span style={{
                  fontSize: '0.65rem',
                  fontWeight: 800,
                  fontFamily: 'var(--font-mono)',
                  padding: '1px 6px',
                  borderRadius: 9999,
                  background: 'rgba(45, 212, 191, 0.2)',
                  color: 'var(--brand-teal)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3
                }}>
                  <CheckCircle2 size={10} /> ONNX RUNTIME
                </span>
              </div>
              <p style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--foreground)', marginTop: 2 }}>
                Local disease screening • 387 crops supported
              </p>
              <p style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: 2 }}>
                All coordinates protected by anonymized centroid grid privacy.
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('more')}
            className="home-banner-btn"
            style={{
              background: 'rgba(45, 212, 191, 0.15)',
              color: 'var(--brand-teal)',
              border: '1px solid rgba(45, 212, 191, 0.3)'
            }}
          >
            Model Cards →
          </button>
        </div>
      </div>

      {/* CrimeRakshak 4 KPI Stat Cards 2x2 Grid */}
      <div className="kpi-grid">
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <div
              key={idx}
              className="glass-card kpi-card"
            >
              {/* Card Specular Sheen */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: 6
              }}>
                <span className="kpi-title">
                  {kpi.title}
                </span>
                <div style={{
                  height: 30,
                  width: 30,
                  borderRadius: 8,
                  background: 'rgba(16, 185, 129, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: kpi.color,
                  flexShrink: 0
                }}>
                  <Icon size={16} />
                </div>
              </div>

              <div>
                <div className="kpi-value">
                  {kpi.value}
                </div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: 6
                }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)' }}>
                    {kpi.sub}
                  </span>
                  <span style={{
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    padding: '1px 6px',
                    borderRadius: 9999,
                    background: kpi.trendPositive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                    color: kpi.trendPositive ? 'var(--brand-green)' : 'var(--brand-amber)'
                  }}>
                    {kpi.trend}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Hero Diagnostic Scanner CTA (Apple Liquid Glass Banner Style) */}
      <div
        className="glass-card scan-hero-card"
        style={{
          background: 'radial-gradient(ellipse at top right, rgba(16, 185, 129, 0.18) 0%, var(--card) 75%)',
          border: '1px solid rgba(16, 185, 129, 0.35)'
        }}
      >
        <div style={{ maxWidth: 680 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{
              fontSize: '0.68rem',
              fontWeight: 800,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              background: 'rgba(16, 185, 129, 0.2)',
              color: 'var(--brand-green)',
              padding: '3px 10px',
              borderRadius: 6
            }}>
              FIELD PATHOLOGY VIEW FINDER
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>
              LOCAL MODEL • 3 CROP TYPES
            </span>
          </div>

          <h2 style={{
            fontFamily: 'var(--font-heading)',
            fontSize: 'clamp(1.2rem, 3vw, 1.65rem)',
            fontWeight: 800,
            color: 'var(--foreground)',
            marginBottom: 6,
            letterSpacing: '-0.02em'
          }}>
            {t.scanLeafShortcut}
          </h2>
          <p style={{ fontSize: '0.84rem', color: 'var(--muted-foreground)', lineHeight: 1.5 }}>
            {t.scanSubtitle}. Local screening supports 387 crops; management guidance is illustrative demo content.
          </p>
        </div>

        <button
          className="btn-primary scan-hero-btn"
          onClick={() => onNavigate('scan')}
          style={{ borderRadius: 14 }}
        >
          <Camera size={18} />
          <span>{t.liveCamera || "Launch Camera Viewfinder"}</span>
        </button>
      </div>

      {/* Weather Snapshot Card (CrimeRakshak Card Style) */}
      {defaultWeather && (
        <div
          className="glass-card weather-card"
          style={{ cursor: 'pointer' }}
          onClick={() => onNavigate('fields')}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                padding: 10,
                borderRadius: 12,
                background: 'rgba(245, 158, 11, 0.15)',
                color: 'var(--brand-amber)'
              }}>
                <CloudSun size={22} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--foreground)', fontFamily: 'var(--font-heading)' }}>
                  {t.weatherSnapshot}
                </h3>
                <span style={{ fontSize: '0.74rem', color: 'var(--muted-foreground)' }}>
                  Plot Centroid: {plots[0]?.name || "Varanasi Centroid"} • Open-Meteo Reanalysis
                </span>
              </div>
            </div>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--brand-green)' }}>
              Explore GIS Forecast →
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div style={{ fontSize: '2.6rem', fontWeight: 900, color: 'var(--foreground)', fontFamily: 'var(--font-heading)', lineHeight: 1 }}>
                {defaultWeather.current_temp_c}°C
              </div>
              <div style={{ fontSize: '0.92rem', color: 'var(--brand-green)', fontWeight: 700, marginTop: 4 }}>
                {defaultWeather.current_condition}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 24, fontSize: '0.85rem' }}>
              <div>
                <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--muted-foreground)', textTransform: 'uppercase' }}>Precipitation</span>
                <strong style={{ color: 'var(--brand-cyan)', fontSize: '1.1rem' }}>{defaultWeather.precipitation_30d_mm} mm</strong>
              </div>
              <div>
                <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--muted-foreground)', textTransform: 'uppercase' }}>Humidity</span>
                <strong style={{ color: 'var(--foreground)', fontSize: '1.1rem' }}>{defaultWeather.current_humidity_pct}%</strong>
              </div>
            </div>
          </div>

          {/* 7-Day Forecast Strips */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: 10,
            paddingTop: 14,
            borderTop: '1px solid var(--border)'
          }}>
            {defaultWeather.forecast_7d.slice(0, 5).map((d, i) => (
              <div
                key={i}
                style={{
                  textAlign: 'center',
                  padding: '10px 6px',
                  borderRadius: 12,
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid var(--border)'
                }}
              >
                <div style={{ color: 'var(--muted-foreground)', fontSize: '0.74rem', marginBottom: 2 }}>{d.date.slice(5)}</div>
                <div style={{ color: 'var(--foreground)', fontWeight: 800, fontSize: '0.92rem' }}>{Math.round(d.max_temp_c)}°</div>
                <div style={{ color: 'var(--brand-cyan)', fontSize: '0.72rem', fontWeight: 600 }}>
                  {d.precipitation_sum_mm > 0 ? `${d.precipitation_sum_mm}mm` : 'Dry'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2-Column Side-by-Side: Registered Plots & Recent Scans */}
      <div style={{ display: 'grid', gridTemplateColumns: window.innerWidth < 800 ? '1fr' : '1fr 1fr', gap: 16 }}>
        {/* Fields Card */}
        <div className="glass-card" style={{ padding: 22 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--foreground)', fontFamily: 'var(--font-heading)' }}>
              {t.myPlots} ({plots.length})
            </h3>
            <button
              onClick={() => onNavigate('fields')}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--brand-green)',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4
              }}
            >
              <span>{t.viewOnMap}</span>
              <ChevronRight size={15} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {plots.slice(0, 3).map((plot) => (
              <div
                key={plot.id}
                onClick={() => { onSelectPlot(plot); onNavigate('fields'); }}
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border)',
                  borderRadius: 14,
                  padding: '12px 16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                  transition: 'border-color 0.2s ease'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 700, color: 'var(--foreground)', fontSize: '0.92rem' }}>{plot.name}</span>
                    {plot.is_demo_data && <span style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--brand-amber)' }}>DEMO DATA</span>}
                    <span style={{
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      background: 'rgba(16, 185, 129, 0.15)',
                      color: 'var(--brand-green)',
                      padding: '2px 8px',
                      borderRadius: 6,
                      textTransform: 'capitalize'
                    }}>
                      {plot.crop}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.76rem', color: 'var(--muted-foreground)', marginTop: 2 }}>
                    📍 {plot.lat.toFixed(3)}, {plot.lon.toFixed(3)} • {plot.area_ha} ha
                  </div>
                </div>
                <ChevronRight size={16} color="var(--muted-foreground)" />
              </div>
            ))}
          </div>
        </div>

        {/* Recent Scans Card */}
        <div className="glass-card" style={{ padding: 22 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--foreground)', fontFamily: 'var(--font-heading)' }}>
              {t.recentScans}
            </h3>
            <button
              onClick={() => onNavigate('scan')}
              style={{ background: 'none', border: 'none', color: 'var(--brand-green)', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' }}
            >
              + New Scan
            </button>
          </div>

          {recentScans.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--muted-foreground)', fontSize: '0.88rem' }}>
              {t.noScansYet}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {recentScans.map((s) => (
                <div
                  key={s.scan_id}
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid var(--border)',
                    borderRadius: 14,
                    padding: '12px 16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--foreground)', fontSize: '0.9rem' }}>
                      {s.top_disease}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--muted-foreground)', marginTop: 2 }}>
                      {s.crop} • {new Date(s.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <span style={{
                    fontSize: '0.74rem',
                    fontWeight: 800,
                    padding: '3px 10px',
                    borderRadius: 8,
                    background: s.status === 'confident' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                    color: s.status === 'confident' ? 'var(--brand-green)' : 'var(--brand-amber)'
                  }}>
                    {s.status === 'confident' ? `${Math.round(s.confidence * 100)}% Match` : 'Uncertain'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
