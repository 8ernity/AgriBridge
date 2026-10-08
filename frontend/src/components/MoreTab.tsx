import React, { useState, useEffect } from 'react';
import {
  Globe,
  Flag,
  Database,
  Trash2,
  FileCode,
  Layers,
  HelpCircle,
  ExternalLink,
  ShieldCheck,
  ChevronRight,
  Info,
  CheckCircle2,
  Sun,
  Moon
} from 'lucide-react';
import { TRANSLATIONS, Locale } from '../services/i18n';
import { apiClient } from '../services/api';

interface MoreTabProps {
  locale: Locale;
  onLocaleChange: (newLocale: Locale) => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

export const MoreTab: React.FC<MoreTabProps> = ({
  locale,
  onLocaleChange,
  theme,
  onToggleTheme
}) => {
  const t = TRANSLATIONS[locale] || TRANSLATIONS.en;

  const [models, setModels] = useState<any[]>([]);
  const [selectedModelCard, setSelectedModelCard] = useState<any | null>(null);
  const [cacheClearedNotice, setCacheClearedNotice] = useState(false);

  useEffect(() => {
    apiClient.getModels()
      .then(m => setModels(m))
      .catch(() => {});
  }, []);

  const handleClearData = () => {
    if (confirm("Are you sure you want to delete local caches and reset stored plots?")) {
      localStorage.clear();
      setCacheClearedNotice(true);
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    }
  };

  const handleViewModelCard = async (modelId: string) => {
    try {
      const card = await apiClient.getModelCard(modelId);
      setSelectedModelCard(card);
    } catch (e) {
      alert("Failed to load model card.");
    }
  };

  return (
    <div className="more-tab-container animate-fade-in">
      {/* Title Header */}
      <div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--foreground)', fontFamily: 'var(--font-heading)' }}>
          {t.settingsTitle}
        </h2>
        <p style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)' }}>
          Preferences • Digital Public Good Governance • Model Registry
        </p>
      </div>

      {cacheClearedNotice && (
        <div style={{
          background: 'rgba(16, 185, 129, 0.15)',
          border: '1px solid rgba(16, 185, 129, 0.4)',
          borderRadius: 12,
          padding: 12,
          color: '#34d399',
          fontSize: '0.85rem'
        }}>
          {t.dataWiped} Reloading app...
        </div>
      )}

      {/* Sovereign Jurisdiction & Agro-Ecological Region */}
      <div className="glass-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <Flag size={18} color="var(--brand-green)" />
          <h3 style={{ fontSize: '0.98rem', fontWeight: 800, color: 'var(--foreground)' }}>
            Sovereign Region: Republic of India (भारत)
          </h3>
        </div>
        <p style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)', marginBottom: 12 }}>
          Configured for Indian smallholder agro-climatic zones, ICAR agronomic guidance, and local crop varieties.
        </p>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderRadius: 14,
          background: 'rgba(16, 185, 129, 0.12)',
          border: '1.5px solid var(--brand-green)',
          color: 'var(--brand-green)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '1.4rem' }}>🇮🇳</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--foreground)' }}>
                India (भारत) • National Jurisdiction
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)' }}>
                ICAR / Indo-Gangetic & Peninsular Agro-Ecological Zones
              </div>
            </div>
          </div>
          <CheckCircle2 size={18} color="var(--brand-green)" />
        </div>
      </div>

      {/* Theme Mode Switcher (Dark & Light) */}
      <div className="glass-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          {theme === 'dark' ? <Moon size={18} color="var(--brand-purple)" /> : <Sun size={18} color="var(--brand-amber)" />}
          <h3 style={{ fontSize: '0.98rem', fontWeight: 800, color: 'var(--foreground)', fontFamily: 'var(--font-heading)' }}>
            Appearance & Theme / थीम मोड
          </h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <button
            onClick={() => { if (theme !== 'dark') onToggleTheme(); }}
            style={{
              padding: '12px 14px',
              borderRadius: 12,
              background: theme === 'dark' ? 'rgba(139, 92, 246, 0.18)' : 'var(--card)',
              border: `1.5px solid ${theme === 'dark' ? 'var(--brand-purple)' : 'var(--border)'}`,
              color: theme === 'dark' ? 'var(--brand-purple)' : 'var(--foreground)',
              fontWeight: 700,
              fontSize: '0.88rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Moon size={16} color="var(--brand-purple)" />
              <span>Dark Theme</span>
            </div>
            {theme === 'dark' && <CheckCircle2 size={16} color="var(--brand-purple)" />}
          </button>

          <button
            onClick={() => { if (theme !== 'light') onToggleTheme(); }}
            style={{
              padding: '12px 14px',
              borderRadius: 12,
              background: theme === 'light' ? 'rgba(245, 158, 11, 0.18)' : 'var(--card)',
              border: `1.5px solid ${theme === 'light' ? 'var(--brand-amber)' : 'var(--border)'}`,
              color: theme === 'light' ? 'var(--brand-amber)' : 'var(--foreground)',
              fontWeight: 700,
              fontSize: '0.88rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Sun size={16} color="var(--brand-amber)" />
              <span>Light Theme</span>
            </div>
            {theme === 'light' && <CheckCircle2 size={16} color="var(--brand-amber)" />}
          </button>
        </div>
      </div>

      {/* Language Selector (FR-1.1) */}
      <div className="glass-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <Globe size={18} color="var(--brand-green)" />
          <h3 style={{ fontSize: '0.98rem', fontWeight: 800, color: 'var(--foreground)' }}>
            {t.languageSelect}
          </h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8 }}>
          {[
            { code: 'hi', label: 'हिन्दी (Hindi)' },
            { code: 'en', label: 'English' },
            { code: 'bn', label: 'বাংলা (Bengali)' }
          ].map(lang => (
            <button
              key={lang.code}
              onClick={() => onLocaleChange(lang.code as Locale)}
              style={{
                padding: '10px 12px',
                borderRadius: 10,
                background: locale === lang.code ? 'rgba(16, 185, 129, 0.15)' : 'var(--card)',
                border: `1.5px solid ${locale === lang.code ? 'var(--brand-green)' : 'var(--border)'}`,
                color: locale === lang.code ? 'var(--brand-green)' : 'var(--foreground)',
                fontSize: '0.84rem',
                fontWeight: 700,
                cursor: 'pointer',
                textAlign: 'center'
              }}
            >
              {lang.label}
            </button>
          ))}
        </div>
      </div>

      {/* Open Model Registry Cards (FR-10.3) */}
      <div className="agri-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <Layers size={20} color="var(--primary-400)" />
          <h3 style={{ fontSize: '0.98rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {t.modelRegistry}
          </h3>
        </div>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 12 }}>
          Model cards describe configured software and known limitations; no independent compliance review is claimed.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {models.map(m => (
            <div
              key={m.id}
              onClick={() => handleViewModelCard(m.id)}
              style={{
                background: 'var(--surface-border-subtle)',
                padding: '10px 14px',
                borderRadius: 10,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer'
              }}
            >
              <div>
                <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>{m.name}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                  {m.availability_status || 'Status not listed'} • {m.license}
                </div>
              </div>
              <ChevronRight size={16} color="var(--text-dim)" />
            </div>
          ))}
        </div>
      </div>

      {/* Open API & Swagger Documentation Link (FR-10.1) */}
      <div className="agri-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <FileCode size={20} color="var(--primary-400)" />
          <h3 style={{ fontSize: '0.98rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {t.apiDocumentation}
          </h3>
        </div>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 12 }}>
          Standardized OpenAPI v3 REST API contract for national and cooperative data integrators.
        </p>
        <a
          href="/docs"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-secondary"
          style={{ width: '100%', textDecoration: 'none' }}
        >
          <ExternalLink size={16} />
          <span>Launch Interactive Swagger UI (/docs)</span>
        </a>
      </div>

      {/* Privacy by Design & Local Storage Wipe (FR-1.4, Section 18) */}
      <div className="agri-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <ShieldCheck size={20} color="var(--primary-400)" />
          <h3 style={{ fontSize: '0.98rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {t.privacyNotice}
          </h3>
        </div>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 14 }}>
          Plot coordinates are sent to the backend to request weather, soil, and satellite catalog data. Avoid entering sensitive personal details.
        </p>
        <button
          onClick={handleClearData}
          style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#f87171',
            borderRadius: 10,
            padding: '10px 14px',
            fontSize: '0.85rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            cursor: 'pointer',
            width: '100%'
          }}
        >
          <Trash2 size={16} />
          <span>{t.deleteData}</span>
        </button>
      </div>

      {/* Model Card Modal */}
      {selectedModelCard && (
        <div className="modal-overlay">
          <div className="bottom-sheet" style={{ maxWidth: 540 }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
              {selectedModelCard.name}
            </h3>
            <span className="dpg-pill" style={{ marginBottom: 12, display: 'inline-block' }}>
              License: {selectedModelCard.license}
            </span>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              <div><strong>Task:</strong> {selectedModelCard.task}</div>
              <div><strong>Architecture:</strong> {selectedModelCard.architecture}</div>
              {selectedModelCard.availability_status && <div><strong>Availability:</strong> {selectedModelCard.availability_status}</div>}
              {selectedModelCard.model_source && <div><strong>Source:</strong> {selectedModelCard.model_source}</div>}
              {selectedModelCard.inference_mode && <div><strong>Inference:</strong> {selectedModelCard.inference_mode}</div>}
              {selectedModelCard.provenance_note && <div><strong>Provenance:</strong> {selectedModelCard.provenance_note}</div>}
              {selectedModelCard.license_url && <div><strong>License/source details:</strong> <a href={selectedModelCard.license_url} target="_blank" rel="noreferrer">Open source record</a></div>}
              <div>
                <strong>Intended Use:</strong> {selectedModelCard.intended_use}
              </div>
            </div>

            <button
              className="btn-secondary"
              style={{ width: '100%', marginTop: 16 }}
              onClick={() => setSelectedModelCard(null)}
            >
              Close Model Card
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
