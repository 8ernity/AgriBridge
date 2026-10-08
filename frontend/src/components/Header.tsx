import React, { useState } from 'react';
import { Menu, Smartphone, Shield, Wifi, WifiOff, X, QrCode, Globe, Check, Sun, Moon, Activity, Zap } from 'lucide-react';
import { UserButton } from '@clerk/react';
import { Locale, TRANSLATIONS } from '../services/i18n';

interface HeaderProps {
  activeTabTitle: string;
  locale: Locale;
  onLocaleChange: (loc: Locale) => void;
  isOnline: boolean;
  onToggleSidebar: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  isGuestMode?: boolean;
  onExitGuestMode?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTabTitle,
  locale,
  onLocaleChange,
  isOnline,
  onToggleSidebar,
  theme,
  onToggleTheme,
  isGuestMode,
  onExitGuestMode
}) => {
  const [isAppModalOpen, setIsAppModalOpen] = useState(false);
  const t = TRANSLATIONS[locale] || TRANSLATIONS.en;

  return (
    <>
      <header className="app-header">
        {/* Left Side: Mobile Menu Button & Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <button
            onClick={onToggleSidebar}
            className="mobile-menu-btn"
            style={{
              background: 'var(--card)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: '8px 10px',
              cursor: 'pointer',
              color: 'var(--foreground)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
            aria-label="Toggle Menu"
          >
            <Menu size={18} />
          </button>

          {/* Mobile Clean Brand Title (Never truncates!) */}
          <div className="header-brand-mobile">
            <span style={{ color: 'var(--brand-green)' }}>AgriBridge</span>
            <span style={{
              fontSize: '0.62rem',
              fontWeight: 800,
              letterSpacing: '0.04em',
              padding: '2px 6px',
              borderRadius: 9999,
              background: 'rgba(16, 185, 129, 0.12)',
              color: 'var(--brand-green)',
              border: '1px solid rgba(16, 185, 129, 0.25)'
            }}>
              DPG
            </span>
          </div>

          {/* Desktop Clean Title */}
          <div className="header-title-desktop">
            <h1
              className="header-title"
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '1.25rem',
                fontWeight: 800,
                color: 'var(--foreground)',
                letterSpacing: '-0.02em',
                lineHeight: 1.2,
                whiteSpace: 'nowrap'
              }}
            >
              {activeTabTitle}
            </h1>
          </div>
        </div>

        {/* Right Side: Exact CrimeRakshak controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {/* CrimeRakshak Crown Button Upgrade */}
          <button
            className="buttonupgrade hide-sm"
            onClick={() => setIsAppModalOpen(true)}
          >
            <svg viewBox="0 0 36 24" xmlns="http://www.w3.org/2000/svg">
              <path d="m18 0 8 12 10-8-4 20H4L0 4l10 8 8-12z"></path>
            </svg>
            <span>Get Android App</span>
          </button>

          {/* Pill Control Bar (CrimeRakshak layout) */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            background: 'var(--card)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            borderRadius: 9999,
            padding: '3px 5px',
            border: '1px solid var(--border)',
            boxShadow: '0 2px 10px rgba(0,0,0,0.06)'
          }}>
            {/* Sovereign India Badge */}
            <div
              className="hide-sm"
              style={{
                padding: '4px 8px',
                color: 'var(--brand-green)',
                fontSize: '0.74rem',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                gap: 4
              }}
            >
              <span>🇮🇳 India</span>
            </div>

            {/* Theme Toggle (Sun / Moon) */}
            <button
              onClick={onToggleTheme}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border)',
                borderRadius: '50%',
                width: 32,
                height: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'var(--foreground)',
                flexShrink: 0
              }}
              title={theme === 'dark' ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {theme === 'dark' ? (
                <Sun size={15} color="var(--brand-amber)" />
              ) : (
                <Moon size={15} color="#475569" />
              )}
            </button>

            {/* Sliding Language Switcher (CrimeRakshak exact match) */}
            <div
              className="lang-sliding-toggle"
              onClick={() => onLocaleChange(locale === 'en' ? 'hi' : 'en')}
              title="Toggle Language (EN / HI)"
            >
              <div className={`lang-sliding-pill ${locale !== 'en' ? 'pos-right' : ''}`} />
              <div
                className="lang-sliding-label"
                style={{ color: locale === 'en' ? '#fff' : 'var(--muted-foreground)' }}
              >
                <span>A</span> EN
              </div>
              <div
                className="lang-sliding-label"
                style={{ color: locale === 'hi' ? '#fff' : 'var(--muted-foreground)' }}
              >
                <span>अ</span> HI
              </div>
            </div>

            <div style={{ marginLeft: 8, display: 'flex', alignItems: 'center' }}>
              {isGuestMode ? (
                <button
                  onClick={onExitGuestMode}
                  style={{
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.35)',
                    color: '#f87171',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '4px 10px',
                    borderRadius: '9999px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4
                  }}
                  title="Exit Guest Mode"
                >
                  <span>Guest Demo</span> ✕
                </button>
              ) : (
                <UserButton />
              )}
            </div>
          </div>
        </div>
      </header>

      {/* CrimeRakshak 2-Column App Download Modal */}
      {isAppModalOpen && (
        <div className="modal-overlay">
          <div
            className="glass-card"
            style={{
              width: '100%',
              maxWidth: 820,
              padding: 0,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: window.innerWidth < 768 ? 'column' : 'row',
              position: 'relative'
            }}
          >
            <button
              onClick={() => setIsAppModalOpen(false)}
              style={{
                position: 'absolute',
                top: 16,
                right: 16,
                zIndex: 20,
                background: 'none',
                border: 'none',
                color: 'var(--muted-foreground)',
                cursor: 'pointer'
              }}
            >
              <X size={20} />
            </button>

            {/* Left Column: QR Code & Download Link */}
            <div style={{
              width: window.innerWidth < 768 ? '100%' : '40%',
              background: 'rgba(0, 0, 0, 0.08)',
              padding: '36px 28px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              borderRight: '1px solid var(--border)'
            }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, fontFamily: 'var(--font-heading)', color: 'var(--foreground)', marginBottom: 4 }}>
                Scan to Install
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)', textAlign: 'center', marginBottom: 20 }}>
                Install the AgriBridge field PWA on Android Chrome
              </p>

              <div style={{
                background: '#ffffff',
                padding: 14,
                borderRadius: 16,
                boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16
              }}>
                <QrCode size={180} color="#000" />
              </div>

              <a
                href="/"
                onClick={(e) => { e.preventDefault(); alert("AgriBridge is already installed and running locally on http://127.0.0.1:5173"); }}
                style={{
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  color: 'var(--brand-green)',
                  textDecoration: 'none'
                }}
              >
                Instant Offline PWA Package
              </a>
            </div>

            {/* Right Column: Features */}
            <div style={{
              flex: 1,
              padding: '36px 32px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center'
            }}>
              <h2 style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '1.5rem',
                fontWeight: 800,
                color: 'var(--foreground)',
                marginBottom: 20
              }}>
                AgriBridge Mobile PWA
              </h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginBottom: 24 }}>
                <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                  <div style={{
                    padding: 10,
                    borderRadius: 12,
                    background: 'rgba(16, 185, 129, 0.15)',
                    color: 'var(--brand-green)',
                    flexShrink: 0
                  }}>
                    <Activity size={20} />
                  </div>
                  <div>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--foreground)' }}>
                      Edge AI Leaf Pathology
                    </h4>
                    <p style={{ fontSize: '0.82rem', color: 'var(--muted-foreground)', marginTop: 2 }}>
                      Local AgriSmart DINOv2 screening supports 387 crops. Other crops use clearly marked demo output.
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                  <div style={{
                    padding: 10,
                    borderRadius: 12,
                    background: 'rgba(59, 130, 246, 0.15)',
                    color: 'var(--brand-blue)',
                    flexShrink: 0
                  }}>
                    <Shield size={20} />
                  </div>
                  <div>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--foreground)' }}>
                      Zero Data Leaks & Offline IndexedDB
                    </h4>
                    <p style={{ fontSize: '0.82rem', color: 'var(--muted-foreground)', marginTop: 2 }}>
                      Plot GPS polygon coordinates and foliar photos remain on your handset, syncing only when you choose.
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                  <div style={{
                    padding: 10,
                    borderRadius: 12,
                    background: 'rgba(139, 92, 246, 0.15)',
                    color: 'var(--brand-purple)',
                    flexShrink: 0
                  }}>
                    <Zap size={20} />
                  </div>
                  <div>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--foreground)' }}>
                      Experimental Agricultural Advisory
                    </h4>
                    <p style={{ fontSize: '0.82rem', color: 'var(--muted-foreground)', marginTop: 2 }}>
                      Advisory excerpts are demonstrations with unverified source attribution. Confirm decisions with a local agricultural professional.
                    </p>
                  </div>
                </div>
              </div>

              <button
                className="btn-primary"
                style={{ width: '100%', padding: '12px 24px' }}
                onClick={() => setIsAppModalOpen(false)}
              >
                Close & Continue / बंद करें
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
