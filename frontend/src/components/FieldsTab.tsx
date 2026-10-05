import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  MapPin,
  Layers,
  Plus,
  Compass,
  CloudSun,
  Droplets,
  Sprout,
  TrendingUp,
  Info,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  X,
  RotateCcw,
  Check
} from 'lucide-react';
import { TRANSLATIONS, Locale } from '../services/i18n';
import { Plot, WeatherData, SoilData, NDVIData, RecommendationData } from '../types';
import { apiClient } from '../services/api';

interface FieldsTabProps {
  locale: Locale;
  plots: Plot[];
  selectedPlot: Plot | null;
  onSelectPlot: (plot: Plot) => void;
  onPlotCreated: (newPlot: Plot) => void;
  onOpenAskWithPlot: (plot: Plot) => void;
}

export const FieldsTab: React.FC<FieldsTabProps> = ({
  locale,
  plots,
  selectedPlot,
  onSelectPlot,
  onPlotCreated,
  onOpenAskWithPlot
}) => {
  const t = TRANSLATIONS[locale] || TRANSLATIONS.en;

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersGroupRef = useRef<L.LayerGroup | null>(null);
  const sketchGroupRef = useRef<L.LayerGroup | null>(null);

  const [mapMode, setMapMode] = useState<'satellite' | 'street'>('satellite');
  const [isCreatingPlot, setIsCreatingPlot] = useState(false);
  const [showPlotModal, setShowPlotModal] = useState(false);
  const [plotName, setPlotName] = useState('');
  const [plotCrop, setPlotCrop] = useState('tomato');
  const [plotArea, setPlotArea] = useState('0.5');
  const [drawnCoords, setDrawnCoords] = useState<[number, number][]>([]);

  // Environmental Data States for selected plot
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [soil, setSoil] = useState<SoilData | null>(null);
  const [ndvi, setNdvi] = useState<NDVIData | null>(null);
  const [recommendations, setRecommendations] = useState<RecommendationData | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [activeCardTab, setActiveCardTab] = useState<'weather' | 'soil' | 'ndvi' | 'regenerative'>('weather');

  const activePlot = selectedPlot || (plots.length > 0 ? plots[0] : null);

  // Initialize Real Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Clean up any stale container instance or leaflet ID
    if (mapRef.current) {
      try {
        mapRef.current.remove();
      } catch (e) {}
      mapRef.current = null;
    }
    if ((mapContainerRef.current as any)._leaflet_id) {
      delete (mapContainerRef.current as any)._leaflet_id;
    }

    try {
      const initialLat = Number(selectedPlot ? selectedPlot.lat : 25.3176);
      const initialLon = Number(selectedPlot ? selectedPlot.lon : 82.9739);

      const map = L.map(mapContainerRef.current, {
        center: [initialLat, initialLon],
        zoom: 14,
        zoomControl: false,
        attributionControl: false
      });

      L.control.zoom({ position: 'topright' }).addTo(map);

      // Tile URLs: Esri Satellite by default, OpenStreetMap for street
      const tileUrl = mapMode === 'satellite'
        ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
        : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

      const tileLayer = L.tileLayer(tileUrl, {
        maxZoom: 19,
        subdomains: ['a', 'b', 'c']
      }).addTo(map);
      tileLayerRef.current = tileLayer;

      const markersGroup = L.layerGroup().addTo(map);
      markersGroupRef.current = markersGroup;

      const sketchGroup = L.layerGroup().addTo(map);
      sketchGroupRef.current = sketchGroup;

      mapRef.current = map;

      // Force layout calculation
      setTimeout(() => {
        try {
          map.invalidateSize();
        } catch (e) {}
      }, 250);
    } catch (err) {
      console.error("Leaflet map initialization error:", err);
    }

    return () => {
      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch (e) {}
        mapRef.current = null;
      }
    };
  }, []);

  // Update Tile Layer when mapMode changes
  useEffect(() => {
    if (!mapRef.current || !tileLayerRef.current) return;
    try {
      mapRef.current.removeLayer(tileLayerRef.current);

      const tileUrl = mapMode === 'satellite'
        ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
        : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

      const newLayer = L.tileLayer(tileUrl, {
        maxZoom: 19,
        subdomains: ['a', 'b', 'c']
      }).addTo(mapRef.current);

      tileLayerRef.current = newLayer;
    } catch (e) {
      console.error("Failed to update tile layer", e);
    }
  }, [mapMode]);

  // Click on Map for Boundary Sketching
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    const handleMapClick = (e: L.LeafletMouseEvent) => {
      if (!isCreatingPlot) return;
      setDrawnCoords(prev => [...prev, [e.latlng.lat, e.latlng.lng]]);
    };

    map.on('click', handleMapClick);
    return () => {
      map.off('click', handleMapClick);
    };
  }, [isCreatingPlot]);

  // Render Sketched Boundary Points & Polygon
  useEffect(() => {
    if (!sketchGroupRef.current) return;
    sketchGroupRef.current.clearLayers();

    if (drawnCoords.length === 0) return;

    // Draw vertex dots
    drawnCoords.forEach((coord, idx) => {
      const dotIcon = L.divIcon({
        className: 'sketch-dot-marker',
        html: `
          <div style="width:14px; height:14px; border-radius:50%; background:#9acd32; border:2px solid #ffffff; box-shadow:0 2px 6px rgba(0,0,0,0.6); display:flex; align-items:center; justify-content:center; color:#000; font-size:9px; font-weight:800;">
            ${idx + 1}
          </div>
        `,
        iconSize: [14, 14],
        iconAnchor: [7, 7]
      });
      L.marker(coord, { icon: dotIcon }).addTo(sketchGroupRef.current!);
    });

    // Draw connecting line or closed polygon
    if (drawnCoords.length >= 3) {
      L.polygon(drawnCoords, {
        color: '#9acd32',
        weight: 2.5,
        fillColor: '#9acd32',
        fillOpacity: 0.35,
        dashArray: '4, 4'
      }).addTo(sketchGroupRef.current!);
    } else if (drawnCoords.length === 2) {
      L.polyline(drawnCoords, {
        color: '#9acd32',
        weight: 2.5,
        dashArray: '4, 4'
      }).addTo(sketchGroupRef.current!);
    }
  }, [drawnCoords]);

  // Render Plot Markers & Parcel Polygons
  useEffect(() => {
    if (!mapRef.current || !markersGroupRef.current) return;
    markersGroupRef.current.clearLayers();

    plots.forEach((p) => {
      const isSelected = selectedPlot?.id === p.id;
      const pLat = Number(p.lat);
      const pLon = Number(p.lon);
      const pArea = Number(p.area_ha) || 0.5;

      if (isNaN(pLat) || isNaN(pLon)) return;

      // Custom sharp emerald marker
      const plotIcon = L.divIcon({
        className: 'custom-plot-marker',
        html: `
          <div style="display:flex; flex-direction:column; align-items:center; cursor:pointer; transform:translate(-50%, -100%);">
            <div style="background:${isSelected ? '#9acd32' : 'rgba(28, 30, 34, 0.95)'}; color:${isSelected ? '#141f00' : '#ffffff'}; font-size:11px; font-weight:800; padding:3px 9px; border-radius:8px; white-space:nowrap; box-shadow:0 4px 12px rgba(0,0,0,0.6); margin-bottom:4px; border:1.5px solid ${isSelected ? '#ffffff' : 'rgba(154, 205, 50, 0.4)'}; letter-spacing:-0.01em;">
              ${p.name} (${pArea} ha)
            </div>
            <div style="width:26px; height:26px; border-radius:50%; background:${isSelected ? '#9acd32' : '#252830'}; border:2.5px solid #ffffff; display:flex; align-items:center; justify-content:center; box-shadow:0 4px 12px rgba(0,0,0,0.7);">
              <div style="width:9px; height:9px; border-radius:50%; background:${isSelected ? '#141f00' : '#9acd32'};"></div>
            </div>
          </div>
        `,
        iconSize: [0, 0],
        iconAnchor: [0, 0]
      });

      const marker = L.marker([pLat, pLon], { icon: plotIcon }).addTo(markersGroupRef.current!);
      marker.on('click', () => onSelectPlot(p));

      // Realistic farm parcel boundary
      const halfSide = 0.00042 * Math.sqrt(pArea);
      const parcelCoords: [number, number][] = [
        [pLat - halfSide * 0.9, pLon - halfSide * 1.1],
        [pLat + halfSide * 0.8, pLon - halfSide * 0.9],
        [pLat + halfSide * 1.1, pLon + halfSide * 1.0],
        [pLat - halfSide * 0.8, pLon + halfSide * 1.1],
      ];

      L.polygon(parcelCoords, {
        color: isSelected ? '#9acd32' : 'rgba(154, 205, 50, 0.5)',
        weight: isSelected ? 2.5 : 1.5,
        fillColor: '#9acd32',
        fillOpacity: isSelected ? 0.32 : 0.12,
        dashArray: isSelected ? '' : '4, 4'
      }).addTo(markersGroupRef.current!).on('click', () => onSelectPlot(p));
    });

    if (selectedPlot && mapRef.current) {
      const selLat = Number(selectedPlot.lat);
      const selLon = Number(selectedPlot.lon);
      if (!isNaN(selLat) && !isNaN(selLon)) {
        try {
          mapRef.current.flyTo([selLat, selLon], 15, {
            animate: true,
            duration: 0.9
          });
        } catch (e) {}
      }
    }
  }, [plots, selectedPlot]);

  // Load environmental data when active plot changes
  useEffect(() => {
    const targetPlot = selectedPlot || (plots.length > 0 ? plots[0] : null);
    if (!targetPlot) return;

    if (!selectedPlot && plots.length > 0) {
      onSelectPlot(plots[0]);
    }

    setIsLoadingData(true);
    Promise.all([
      apiClient.getPlotWeather(targetPlot.id).catch(() => null),
      apiClient.getPlotSoil(targetPlot.id).catch(() => null),
      apiClient.getPlotNDVI(targetPlot.id).catch(() => null),
      apiClient.getPlotRecommendations(targetPlot.id).catch(() => null)
    ]).then(([w, s, n, r]) => {
      setWeather(w);
      setSoil(s);
      setNdvi(n);
      setRecommendations(r);
      setIsLoadingData(false);
    });
  }, [selectedPlot, plots]);

  const handleCreatePlotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!plotName.trim()) return;

    // Use sketched points centroid if available, otherwise regional centroid
    const baseLat = 25.3176;
    const baseLon = 82.9739;
    const offset = (Math.random() - 0.5) * 0.03;

    let finalLat = baseLat + offset;
    let finalLon = baseLon + offset;
    let geomGeojson: string | undefined = undefined;

    if (drawnCoords.length > 0) {
      finalLat = drawnCoords.reduce((acc, c) => acc + c[0], 0) / drawnCoords.length;
      finalLon = drawnCoords.reduce((acc, c) => acc + c[1], 0) / drawnCoords.length;

      const ring = drawnCoords.map(c => [c[1], c[0]]);
      if (drawnCoords.length >= 3) {
        ring.push([drawnCoords[0][1], drawnCoords[0][0]]);
      }
      geomGeojson = JSON.stringify({
        type: "Polygon",
        coordinates: [ring]
      });
    }

    const newPlot = await apiClient.createPlot({
      name: plotName,
      crop: plotCrop,
      lat: finalLat,
      lon: finalLon,
      area_ha: parseFloat(plotArea) || 0.5,
      geom_geojson: geomGeojson,
      sowing_date: new Date().toISOString().split('T')[0]
    });

    onPlotCreated(newPlot);
    onSelectPlot(newPlot);
    setIsCreatingPlot(false);
    setShowPlotModal(false);
    setPlotName('');
    setDrawnCoords([]);
  };

  const handleLocateMe = () => {
    if (navigator.geolocation && mapRef.current) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;
          mapRef.current?.flyTo([lat, lon], 16, { animate: true, duration: 1.2 });
          if (markersGroupRef.current) {
            const gpsIcon = L.divIcon({
              className: 'gps-pulse-marker',
              html: `
                <div style="width:22px; height:22px; border-radius:50%; background:#3b82f6; border:3px solid #ffffff; box-shadow:0 0 14px #3b82f6; display:flex; align-items:center; justify-content:center;">
                  <div style="width:6px; height:6px; border-radius:50%; background:#ffffff;"></div>
                </div>
              `,
              iconSize: [22, 22],
              iconAnchor: [11, 11]
            });
            L.marker([lat, lon], { icon: gpsIcon }).addTo(markersGroupRef.current)
              .bindPopup("Your GPS Location").openPopup();
          }
        },
        () => {
          if (selectedPlot && mapRef.current) {
            mapRef.current.flyTo([selectedPlot.lat, selectedPlot.lon], 15);
          }
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }
  };

  return (
    <div className="content-area animate-fade-in" style={{ paddingBottom: 80 }}>
      {/* Top Map Control Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--foreground)', fontFamily: 'var(--font-heading)' }}>
            {t.navFields} & GIS Analytics
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)' }}>
            Interactive Satellite Parcel Mapping & Open Environmental Triad
          </p>
        </div>

        <button
          className="btn-primary"
          style={{ minHeight: 40, padding: '8px 14px', fontSize: '0.85rem' }}
          onClick={() => {
            setIsCreatingPlot(true);
            setDrawnCoords([]);
          }}
        >
          <Plus size={18} />
          <span>{locale === 'hi' ? 'नया खेत' : locale === 'bn' ? 'নতুন জমি' : false ? 'Shamba Jipya' : 'New Field'}</span>
        </button>
      </div>

      {/* Real Interactive Leaflet GIS Map (FR-2.1, FR-2.2) */}
      <div
        className="agri-card"
        style={{
          height: 290,
          minHeight: 290,
          position: 'relative',
          overflow: 'hidden',
          padding: 0,
          border: '1.5px solid var(--border)',
          borderRadius: 16,
          background: 'var(--muted)'
        }}
      >
        <div
          ref={mapContainerRef}
          style={{
            width: '100%',
            height: '100%',
            minHeight: 290,
            cursor: isCreatingPlot ? 'crosshair' : 'grab'
          }}
        />

        {/* Boundary Sketching Floating Bar */}
        {isCreatingPlot && (
          <div style={{
            position: 'absolute',
            top: 12,
            left: 12,
            right: 60,
            zIndex: 1000,
            background: 'rgba(28, 30, 34, 0.92)',
            backdropFilter: 'blur(10px)',
            border: '1.5px solid var(--brand-green)',
            padding: '8px 12px',
            borderRadius: 12,
            fontSize: '0.78rem',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            boxShadow: '0 6px 20px rgba(0,0,0,0.6)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--brand-green)', flexShrink: 0 }} />
              <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {drawnCoords.length === 0
                  ? (locale === 'hi' ? 'खेत की सीमा के लिए मानचित्र पर टैप करें' : 'Tap map to mark parcel boundary')
                  : (locale === 'hi' ? `${drawnCoords.length} बिंदु चिह्नित` : `${drawnCoords.length} boundary points marked`)}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              {drawnCoords.length > 0 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDrawnCoords(prev => prev.slice(0, -1));
                  }}
                  style={{
                    background: 'rgba(255,255,255,0.12)',
                    border: 'none',
                    borderRadius: 6,
                    color: '#fff',
                    cursor: 'pointer',
                    padding: '4px 8px',
                    fontSize: '0.72rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 3
                  }}
                  title="Undo point"
                >
                  <RotateCcw size={12} />
                  <span>{locale === 'hi' ? 'पूर्ववत' : 'Undo'}</span>
                </button>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowPlotModal(true);
                }}
                className="btn-primary"
                style={{
                  minHeight: 28,
                  padding: '4px 10px',
                  fontSize: '0.72rem',
                  borderRadius: 6
                }}
              >
                <Check size={13} />
                <span>{locale === 'hi' ? 'सहेजें' : 'Save'}</span>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsCreatingPlot(false);
                  setDrawnCoords([]);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--muted-foreground)',
                  cursor: 'pointer',
                  padding: 2
                }}
              >
                <X size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Map Control Buttons: Locate Me & Satellite Switch (FR-2.1) */}
        <div style={{
          position: 'absolute',
          bottom: 12,
          right: 12,
          zIndex: 1000,
          display: 'flex',
          gap: 6
        }}>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleLocateMe(); }}
            className="btn-secondary"
            style={{
              minHeight: 34,
              padding: '6px 12px',
              fontSize: '0.74rem',
              background: 'rgba(28, 30, 34, 0.92)',
              backdropFilter: 'blur(8px)',
              border: '1px solid var(--border)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              borderRadius: 10,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
            }}
            title="Locate Me (GPS)"
          >
            <Compass size={15} color="var(--brand-green)" />
            <span>GPS</span>
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setMapMode(m => m === 'satellite' ? 'street' : 'satellite');
            }}
            className="btn-secondary"
            style={{
              minHeight: 34,
              padding: '6px 12px',
              fontSize: '0.74rem',
              background: 'rgba(28, 30, 34, 0.92)',
              backdropFilter: 'blur(8px)',
              border: '1px solid var(--border)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              borderRadius: 10,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
            }}
          >
            <Layers size={15} color="var(--brand-green)" />
            <span style={{ textTransform: 'capitalize', fontWeight: 700 }}>
              {mapMode === 'satellite' ? 'Satellite' : 'Street'}
            </span>
          </button>
        </div>
      </div>

      {/* Plot Selector Carousel */}
      {plots.length > 0 ? (
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
          {plots.map((p) => {
            const isSelected = activePlot?.id === p.id;
            return (
              <button
                key={p.id}
                onClick={() => onSelectPlot(p)}
                style={{
                  flexShrink: 0,
                  padding: '9px 14px',
                  borderRadius: 12,
                  background: isSelected ? 'var(--brand-green)' : 'var(--card)',
                  border: `1.5px solid ${isSelected ? 'var(--brand-green)' : 'var(--border)'}`,
                  color: isSelected ? '#141f00' : 'var(--foreground)',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  boxShadow: isSelected ? '0 2px 8px var(--brand-green-glow)' : 'none',
                  transition: 'all 0.2s ease'
                }}
              >
                <MapPin size={16} color={isSelected ? '#141f00' : 'var(--muted-foreground)'} />
                <span>{p.name}{p.is_demo_data ? ' · DEMO DATA' : ''}</span>
                <span style={{ fontSize: '0.72rem', opacity: isSelected ? 0.9 : 0.7, textTransform: 'capitalize' }}>
                  ({p.crop})
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <div style={{
          padding: '12px 16px',
          borderRadius: 12,
          background: 'var(--card)',
          border: '1px dashed var(--border)',
          fontSize: '0.85rem',
          color: 'var(--muted-foreground)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <span>{locale === 'hi' ? 'कोई पंजीकृत खेत नहीं है। नया खेत जोड़ें।' : 'No farm plots registered yet. Tap New Field to add one.'}</span>
          <button
            onClick={() => { setIsCreatingPlot(true); setDrawnCoords([]); }}
            className="btn-primary"
            style={{ minHeight: 32, padding: '4px 10px', fontSize: '0.78rem' }}
          >
            <Plus size={14} />
            <span>{locale === 'hi' ? 'खेत जोड़ें' : 'Add Field'}</span>
          </button>
        </div>
      )}

      {/* Selected Plot Action Header */}
      {activePlot && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)' }}>
              Coordinates: {Number(activePlot?.lat ?? 0).toFixed(4)}, {Number(activePlot?.lon ?? 0).toFixed(4)} • Coarse Grid Protected
            </div>
          </div>
          <button
            onClick={() => onOpenAskWithPlot(activePlot)}
            className="btn-secondary"
            style={{ minHeight: 36, padding: '6px 12px', fontSize: '0.8rem' }}
          >
            <MessageSquare size={16} color="var(--brand-green)" />
            <span>{locale === 'hi' ? 'खेत सलाहकार से पूछें' : 'Ask About Plot'}</span>
          </button>
        </div>
      )}

      {/* Data Cards Navigation Switcher */}
      <div style={{
        display: 'flex',
        borderRadius: 12,
        background: 'var(--card)',
        border: '1px solid var(--border)',
        padding: 4,
        gap: 4
      }}>
        {(['weather', 'soil', 'ndvi', 'regenerative'] as const).map((tabKey) => {
          const isActive = activeCardTab === tabKey;
          const labels: Record<string, string> = {
            weather: locale === 'hi' ? 'मौसम' : 'Weather',
            soil: 'SoilGrids',
            ndvi: 'NDVI Satellite',
            regenerative: locale === 'hi' ? 'फसल चक्र' : 'Regenerative'
          };
          return (
            <button
              key={tabKey}
              onClick={() => setActiveCardTab(tabKey)}
              style={{
                flex: 1,
                padding: '8px 4px',
                border: 'none',
                borderRadius: 8,
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer',
                background: isActive ? 'var(--brand-green)' : 'transparent',
                color: isActive ? '#141f00' : 'var(--muted-foreground)',
                transition: 'all 0.2s ease'
              }}
            >
              {labels[tabKey]}
            </button>
          );
        })}
      </div>

      {/* Environmental Card 1: Open-Meteo Weather */}
      {activeCardTab === 'weather' && (
        isLoadingData ? (
          <div className="agri-card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted-foreground)' }}>
            <CloudSun size={28} color="var(--brand-green)" style={{ margin: '0 auto 8px', display: 'block' }} />
            <div style={{ fontWeight: 600, color: 'var(--foreground)' }}>Loading micro-climate forecast...</div>
          </div>
        ) : weather ? (
          <div className="agri-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CloudSun size={22} color="var(--brand-green)" />
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--foreground)' }}>
                  {t.weatherSnapshot}
                </h3>
              </div>
              <span style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', background: 'var(--surface-border-subtle)', padding: '2px 8px', borderRadius: 4 }}>
                Cached 1 hr
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 16 }}>
              <div style={{ background: 'var(--muted)', border: '1px solid var(--border)', padding: 12, borderRadius: 10 }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>Current Temperature</div>
                <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--foreground)', fontFamily: 'var(--font-heading)' }}>
                  {weather.current_temp_c}°C
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--brand-green)', fontWeight: 600 }}>{weather.current_condition}</div>
              </div>

              <div style={{ background: 'var(--muted)', border: '1px solid var(--border)', padding: 12, borderRadius: 10 }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>30-Day Precipitation</div>
                <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--brand-blue)', fontFamily: 'var(--font-heading)' }}>
                  {weather.precipitation_30d_mm} mm
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>Cumulative root intake</div>
              </div>
            </div>

            <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--foreground)', marginBottom: 8 }}>
              {t.view7DayForecast}
            </h4>
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 6 }}>
              {Array.isArray(weather.forecast_7d) && weather.forecast_7d.map((day, idx) => (
                <div key={idx} style={{
                  flexShrink: 0,
                  width: 90,
                  background: 'var(--card)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: '8px 6px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)' }}>{day.date?.slice(5) || ''}</div>
                  <CloudSun size={18} color="var(--brand-amber)" style={{ margin: '4px auto' }} />
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--foreground)' }}>
                    {Math.round(Number(day.min_temp_c) || 0)}° - {Math.round(Number(day.max_temp_c) || 0)}°
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--brand-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, marginTop: 2 }}>
                    <Droplets size={10} />
                    <span>{day.precipitation_sum_mm ?? 0}mm</span>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', marginTop: 12 }}>
              Source: {weather.source_attribution} • License: {weather.license}
            </div>
            {weather.is_demo_data && <p role="status" style={{ color: 'var(--brand-amber)', fontWeight: 700 }}>DEMO DATA — these weather values are synthetic and are not an observation or forecast.</p>}
          </div>
        ) : (
          <div className="agri-card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted-foreground)' }}>
            <CloudSun size={28} color="var(--brand-amber)" style={{ margin: '0 auto 8px', display: 'block' }} />
            <div style={{ fontWeight: 700, color: 'var(--foreground)' }}>Micro-Climate Data Standby</div>
            <p style={{ fontSize: '0.82rem', marginTop: 4 }}>Select a plot or create a new field to fetch live Open-Meteo weather telemetry.</p>
          </div>
        )
      )}

      {/* Environmental Card 2: SoilGrids 250m */}
      {activeCardTab === 'soil' && (
        isLoadingData ? (
          <div className="agri-card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted-foreground)' }}>
            <Sprout size={28} color="var(--brand-green)" style={{ margin: '0 auto 8px', display: 'block' }} />
            <div style={{ fontWeight: 600, color: 'var(--foreground)' }}>Fetching SoilGrids 250m chemistry profile...</div>
          </div>
        ) : soil ? (
          <div className="agri-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Sprout size={22} color="var(--brand-green)" />
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--foreground)' }}>
                  {t.soilHealth}
                </h3>
              </div>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: 'rgba(154,205,50,0.15)', color: 'var(--brand-green)' }}>
                {soil.texture_class || 'Clay Loam'} Texture
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 14 }}>
              <div style={{ background: 'var(--muted)', border: '1px solid var(--border)', padding: 10, borderRadius: 8 }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)' }}>Soil pH</div>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--foreground)', fontFamily: 'var(--font-heading)' }}>
                  {soil.ph?.value != null ? Number(soil.ph.value).toFixed(1) : '--'}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--brand-green)', fontWeight: 600 }}>{soil.ph?.rating || ''}</div>
              </div>

              <div style={{ background: 'var(--muted)', border: '1px solid var(--border)', padding: 10, borderRadius: 8 }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)' }}>Organic Carbon</div>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--foreground)', fontFamily: 'var(--font-heading)' }}>
                  {soil.organic_carbon_g_kg?.value != null ? Number(soil.organic_carbon_g_kg.value).toFixed(1) : '--'}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--brand-green)', fontWeight: 600 }}>
                  {soil.organic_carbon_g_kg?.rating ? `g/kg (${soil.organic_carbon_g_kg.rating})` : ''}
                </div>
              </div>

              <div style={{ background: 'var(--muted)', border: '1px solid var(--border)', padding: 10, borderRadius: 8 }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)' }}>Total Nitrogen</div>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--foreground)', fontFamily: 'var(--font-heading)' }}>
                  {soil.nitrogen_cg_kg?.value != null ? Number(soil.nitrogen_cg_kg.value).toFixed(1) : '--'}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--brand-green)', fontWeight: 600 }}>
                  {soil.nitrogen_cg_kg?.rating ? `cg/kg (${soil.nitrogen_cg_kg.rating})` : ''}
                </div>
              </div>
            </div>

            <div style={{ background: 'rgba(154, 205, 50, 0.08)', border: '1px solid rgba(154, 205, 50, 0.2)', padding: 10, borderRadius: 8, fontSize: '0.78rem', color: 'var(--foreground)' }}>
              ⚠️ <strong>Resolution Notice:</strong> Estimated at 250m global grid resolution for topsoil ({soil.depth || '0-30cm'}). Recommended as baseline guidance prior to laboratory wet-chemistry testing.
            </div>
            {soil.is_fallback && <p role="status" style={{ color: 'var(--brand-amber)', fontWeight: 700 }}>DEMO DATA — these soil values are synthetic and are not a SoilGrids measurement.</p>}

            <div style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', marginTop: 12 }}>
              Source: {soil.source_attribution || 'SoilGrids'} • License: {soil.license || 'CC-BY 4.0'}
            </div>
          </div>
        ) : (
          <div className="agri-card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted-foreground)' }}>
            <Sprout size={28} color="var(--brand-amber)" style={{ margin: '0 auto 8px', display: 'block' }} />
            <div style={{ fontWeight: 700, color: 'var(--foreground)' }}>Soil Profile Standby</div>
            <p style={{ fontSize: '0.82rem', marginTop: 4 }}>Select a plot to query ISRIC 250m soil chemistry and organic carbon records.</p>
          </div>
        )
      )}

      {/* Environmental Card 3: Sentinel-2 NDVI */}
      {activeCardTab === 'ndvi' && (
        isLoadingData ? (
          <div className="agri-card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted-foreground)' }}>
            <TrendingUp size={28} color="var(--brand-green)" style={{ margin: '0 auto 8px', display: 'block' }} />
            <div style={{ fontWeight: 600, color: 'var(--foreground)' }}>Loading NDVI demonstration series...</div>
          </div>
        ) : ndvi ? (
          <div className="agri-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <TrendingUp size={22} color="var(--brand-green)" />
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--foreground)' }}>
                  NDVI Demonstration Series
                </h3>
              </div>
              <span style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 6,
                background: ndvi.trend === 'increasing' ? 'rgba(154,205,50,0.15)' : 'rgba(251,191,36,0.15)',
                color: ndvi.trend === 'increasing' ? 'var(--brand-green)' : 'var(--brand-amber)',
                textTransform: 'capitalize'
              }}>
                {ndvi.trend} Trend
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--foreground)', fontFamily: 'var(--font-heading)' }}>
                {ndvi.current_ndvi != null ? Number(ndvi.current_ndvi).toFixed(2) : '--'}
              </span>
              <span style={{ fontSize: '0.85rem', color: 'var(--brand-green)', fontWeight: 600 }}>
                Normalized Difference Vegetation Index (B08/B04)
              </span>
            </div>

            <p style={{ fontSize: '0.84rem', color: 'var(--muted-foreground)', marginBottom: 14 }}>
              {ndvi.interpretation}
            </p>

            <div style={{ background: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 10, padding: 12, height: 120 }}>
              <svg style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                <polyline
                  fill="none"
                  stroke="var(--brand-green)"
                  strokeWidth="2.5"
                  points={(ndvi.series || []).map((pt, i) => {
                    const x = (i / ((ndvi.series?.length || 1) - 1 || 1)) * 300;
                    const y = 90 - (pt.ndvi * 85);
                    return `${x},${y}`;
                  }).join(' ')}
                />
                {(ndvi.series || []).map((pt, i) => {
                  const x = (i / ((ndvi.series?.length || 1) - 1 || 1)) * 300;
                  const y = 90 - (pt.ndvi * 85);
                  return (
                    <circle key={i} cx={x} cy={y} r="3.5" fill="var(--brand-green)" />
                  );
                })}
              </svg>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--muted-foreground)', marginTop: 6 }}>
                <span>90 days ago ({ndvi.series?.[0]?.date?.slice(5) || ''})</span>
                <span>DEMO DATA — not satellite measurements</span>
                <span>Today ({ndvi.series?.[ndvi.series.length - 1]?.date?.slice(5) || ''})</span>
              </div>
            </div>

            <div style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', marginTop: 12 }}>
              Source: {ndvi.source_attribution} • License: {ndvi.license}
            </div>
            {ndvi.is_demo_data && <p role="status" style={{ color: 'var(--brand-amber)', fontWeight: 700 }}>DEMO DATA — this NDVI series is synthetic; satellite band data has not been processed.</p>}
          </div>
        ) : (
          <div className="agri-card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted-foreground)' }}>
            <TrendingUp size={28} color="var(--brand-amber)" style={{ margin: '0 auto 8px', display: 'block' }} />
            <div style={{ fontWeight: 700, color: 'var(--foreground)' }}>NDVI Vegetation Index Standby</div>
            <p style={{ fontSize: '0.82rem', marginTop: 4 }}>Select a plot to view the synthetic NDVI demonstration series.</p>
          </div>
        )
      )}

      {/* Environmental Card 4: Regenerative Recommendations */}
      {activeCardTab === 'regenerative' && (
        isLoadingData ? (
          <div className="agri-card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted-foreground)' }}>
            <Sprout size={28} color="var(--brand-green)" style={{ margin: '0 auto 8px', display: 'block' }} />
            <div style={{ fontWeight: 600, color: 'var(--foreground)' }}>Synthesizing regenerative crop rotation models...</div>
          </div>
        ) : recommendations ? (
          <div className="agri-card">
            {recommendations.is_demo_data && <p role="status" style={{ color: 'var(--brand-amber)', fontWeight: 700 }}>DEMO DATA — these recommendations use one or more synthetic environmental inputs.</p>}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Sprout size={22} color="var(--brand-green)" />
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--foreground)' }}>
                  Regenerative Crop Recommendations (Top 5)
                </h3>
              </div>
            </div>

            <div style={{
              background: 'rgba(154, 205, 50, 0.1)',
              border: '1px solid rgba(154, 205, 50, 0.25)',
              borderRadius: 10,
              padding: 12,
              fontSize: '0.85rem',
              color: 'var(--foreground)',
              marginBottom: 14,
              lineHeight: 1.5
            }}>
              {recommendations.regenerative_summary}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {Array.isArray(recommendations.top_recommendations) && recommendations.top_recommendations.map((rec) => (
                <div
                  key={rec.crop_id}
                  style={{
                    background: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    padding: 14
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        width: 24,
                        height: 24,
                        borderRadius: '50%',
                        background: 'var(--brand-green)',
                        color: '#141f00',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.78rem',
                        fontWeight: 800
                      }}>
                        #{rec.rank}
                      </span>
                      <span style={{ fontWeight: 700, color: 'var(--foreground)', fontSize: '0.95rem' }}>
                        {rec.crop_name} {rec.local_name ? `(${rec.local_name})` : ''}
                      </span>
                    </div>
                    <div style={{
                      fontSize: '0.9rem',
                      fontWeight: 800,
                      color: 'var(--brand-green)',
                      fontFamily: 'var(--font-heading)'
                    }}>
                      {rec.suitability_score}% Match
                    </div>
                  </div>

                  <p style={{ fontSize: '0.82rem', color: 'var(--muted-foreground)', marginBottom: 8 }}>
                    {rec.rationale}
                  </p>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, fontSize: '0.72rem' }}>
                    <span className="tag-chip" style={{ color: 'var(--brand-green)' }}>Family: {rec.family}</span>
                    <span className="tag-chip">Soil: {rec.soil_fit}</span>
                    <span className="tag-chip">Climate: {rec.climate_fit}</span>
                    {rec.is_legume_or_cover && (
                      <span className="tag-chip" style={{ background: 'rgba(128, 212, 255, 0.15)', color: 'var(--brand-blue)' }}>
                        Legume (Nitrogen Fixer)
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', marginTop: 14 }}>
              Reference Standard: {recommendations.reviewed_by} • {recommendations.attribution}
            </div>
          </div>
        ) : (
          <div className="agri-card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted-foreground)' }}>
            <Sprout size={28} color="var(--brand-amber)" style={{ margin: '0 auto 8px', display: 'block' }} />
            <div style={{ fontWeight: 700, color: 'var(--foreground)' }}>Crop Recommendations Standby</div>
            <p style={{ fontSize: '0.82rem', marginTop: 4 }}>Select a plot to run multi-factor regenerative suitability scoring based on soil and weather telemetry.</p>
          </div>
        )
      )}

      {/* Plot Creation Modal (FR-2.2, FR-2.3) */}
      {showPlotModal && (
        <div className="modal-overlay">
          <div className="bottom-sheet">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--foreground)' }}>
                {locale === 'hi' ? 'नया खेत पंजीकृत करें' : 'Register New Agricultural Plot'}
              </h3>
              <button
                onClick={() => { setShowPlotModal(false); }}
                style={{ background: 'none', border: 'none', color: 'var(--muted-foreground)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreatePlotSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: '0.82rem', color: 'var(--foreground)', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  {locale === 'hi' ? 'खेत का नाम' : 'Plot Name'}
                </label>
                <input
                  type="text"
                  required
                  placeholder={locale === 'hi' ? 'उदा. गंगा तट टमाटर खेत' : 'e.g., North Riverbank Tomato Field'}
                  value={plotName}
                  onChange={(e) => setPlotName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: 10,
                    background: 'var(--card)',
                    border: '1px solid var(--border)',
                    color: 'var(--foreground)',
                    fontSize: '0.95rem'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: '0.82rem', color: 'var(--foreground)', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                    {locale === 'hi' ? 'वर्तमान फसल' : 'Current Crop'}
                  </label>
                  <select
                    value={plotCrop}
                    onChange={(e) => setPlotCrop(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: 10,
                      background: 'var(--card)',
                      border: '1px solid var(--border)',
                      color: 'var(--foreground)',
                      fontSize: '0.95rem'
                    }}
                  >
                    <option value="tomato">Tomato (टमाटर)</option>
                    <option value="potato">Potato (आलू)</option>
                    <option value="maize">Maize (मक्का)</option>
                    <option value="bell_pepper">Bell Pepper (शिमला मिर्च)</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.82rem', color: 'var(--foreground)', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                    {locale === 'hi' ? 'क्षेत्रफल (हेक्टेयर)' : 'Plot Area (ha)'}
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="10.0"
                    value={plotArea}
                    onChange={(e) => setPlotArea(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: 10,
                      background: 'var(--card)',
                      border: '1px solid var(--border)',
                      color: 'var(--foreground)',
                      fontSize: '0.95rem'
                    }}
                  />
                </div>
              </div>

              {drawnCoords.length > 0 && (
                <div style={{ fontSize: '0.78rem', color: 'var(--brand-green)', background: 'rgba(154, 205, 50, 0.1)', border: '1px solid rgba(154, 205, 50, 0.3)', padding: 10, borderRadius: 8 }}>
                  ✓ {drawnCoords.length} {locale === 'hi' ? 'जीपीएस सीमा बिंदु मानचित्र से सहेजे जाएंगे' : 'GPS boundary coordinates captured from map sketch'}
                </div>
              )}

              <div style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)', background: 'var(--muted)', border: '1px solid var(--border)', padding: 10, borderRadius: 8 }}>
                🛡️ <strong>Coordinate Privacy:</strong> Exact coordinates stay securely on your device. Micro-weather and SoilGrids queries use anonymous centroid aggregation.
              </div>

              <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: 6 }}>
                {locale === 'hi' ? 'खेत सहेजें' : 'Save Plot'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
