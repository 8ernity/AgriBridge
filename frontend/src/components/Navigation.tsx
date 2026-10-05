import React from 'react';
import { Home, MapPin, Camera, MessageSquare, MoreHorizontal } from 'lucide-react';
import { TRANSLATIONS, Locale } from '../services/i18n';

interface NavigationProps {
  activeTab: 'home' | 'fields' | 'scan' | 'ask' | 'more';
  setActiveTab: (tab: 'home' | 'fields' | 'scan' | 'ask' | 'more') => void;
  locale: Locale;
  offlineQueueCount: number;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  setActiveTab,
  locale,
  offlineQueueCount
}) => {
  const t = TRANSLATIONS[locale] || TRANSLATIONS.en;

  return (
    <nav className="bottom-nav">
      <button
        id="nav-tab-home"
        className={`nav-tab-item ${activeTab === 'home' ? 'active' : ''}`}
        onClick={() => setActiveTab('home')}
        aria-label={t.navHome}
      >
        <Home size={22} />
        <span>{t.navHome}</span>
      </button>

      <button
        id="nav-tab-fields"
        className={`nav-tab-item ${activeTab === 'fields' ? 'active' : ''}`}
        onClick={() => setActiveTab('fields')}
        aria-label={t.navFields}
      >
        <MapPin size={22} />
        <span>{t.navFields}</span>
      </button>

      {/* Center Raised Scan Button (PRD Section 14.2) */}
      <button
        id="nav-tab-scan"
        className="scan-raised-btn"
        onClick={() => setActiveTab('scan')}
        aria-label={t.navScan}
      >
        <Camera size={26} />
        <span style={{ fontSize: '0.7rem', fontWeight: 700, marginTop: '2px' }}>{t.navScan}</span>
      </button>

      <button
        id="nav-tab-ask"
        className={`nav-tab-item ${activeTab === 'ask' ? 'active' : ''}`}
        onClick={() => setActiveTab('ask')}
        aria-label={t.navAsk}
      >
        <MessageSquare size={22} />
        <span>{t.navAsk}</span>
      </button>

      <button
        id="nav-tab-more"
        className={`nav-tab-item ${activeTab === 'more' ? 'active' : ''}`}
        onClick={() => setActiveTab('more')}
        aria-label={t.navMore}
        style={{ position: 'relative' }}
      >
        <MoreHorizontal size={22} />
        <span>{t.navMore}</span>
        {offlineQueueCount > 0 && (
          <span style={{
            position: 'absolute',
            top: 4,
            right: 14,
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: 'var(--accent-amber)'
          }} />
        )}
      </button>
    </nav>
  );
};
