import React from 'react';
import { LayoutDashboard, MapPin, Camera, MessageSquare, MoreHorizontal } from 'lucide-react';
import { Locale, TRANSLATIONS } from '../services/i18n';

interface MobileBottomNavProps {
  activeTab: 'home' | 'fields' | 'scan' | 'ask' | 'more' | 'carbon';
  setActiveTab: (tab: 'home' | 'fields' | 'scan' | 'ask' | 'more' | 'carbon') => void;
  locale: Locale;
  onOpenSidebar: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  setActiveTab,
  locale,
  onOpenSidebar
}) => {
  const t = TRANSLATIONS[locale] || TRANSLATIONS.en;

  return (
    <nav className="mobile-bottom-nav">
      <button
        onClick={() => setActiveTab('home')}
        className={`mobile-nav-item ${activeTab === 'home' ? 'active' : ''}`}
        aria-label={t.navHome}
      >
        <LayoutDashboard size={20} />
        <span>{t.navHome}</span>
      </button>

      <button
        onClick={() => setActiveTab('fields')}
        className={`mobile-nav-item ${activeTab === 'fields' ? 'active' : ''}`}
        aria-label={t.navFields}
      >
        <MapPin size={20} />
        <span>{t.navFields}</span>
      </button>

      {/* Center Raised Action Button */}
      <button
        onClick={() => setActiveTab('scan')}
        className={`mobile-scan-raised ${activeTab === 'scan' ? 'active' : ''}`}
        aria-label="Diagnostic Scan"
      >
        <Camera size={26} />
      </button>

      <button
        onClick={() => setActiveTab('ask')}
        className={`mobile-nav-item ${activeTab === 'ask' ? 'active' : ''}`}
        aria-label={t.navAsk}
      >
        <MessageSquare size={20} />
        <span>{t.navAsk}</span>
      </button>

      <button
        onClick={() => setActiveTab('more')}
        className={`mobile-nav-item ${activeTab === 'more' ? 'active' : ''}`}
        aria-label={t.navMore}
      >
        <MoreHorizontal size={20} />
        <span>{t.navMore}</span>
      </button>
    </nav>
  );
};
