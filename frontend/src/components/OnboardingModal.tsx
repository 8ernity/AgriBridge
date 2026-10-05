import React, { useState } from 'react';
import { ShieldCheck, Globe, Check } from 'lucide-react';
import { TRANSLATIONS, Locale } from '../services/i18n';

interface OnboardingModalProps {
  isOpen: boolean;
  onComplete: (selectedLocale: Locale) => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ isOpen, onComplete }) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedLocale, setSelectedLocale] = useState<Locale>('hi');

  if (!isOpen) return null;

  const t = TRANSLATIONS[selectedLocale] || TRANSLATIONS.en;

  const languages: { code: Locale; name: string; local: string }[] = [
    { code: 'hi', name: 'Hindi', local: 'हिन्दी' },
    { code: 'en', name: 'English', local: 'English' },
    { code: 'bn', name: 'Bengali', local: 'বাংলা' },
  ];

  return (
    <div className="modal-overlay">
      <div className="bottom-sheet" style={{ maxWidth: 480 }}>
        {step === 1 ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{
                background: 'rgba(16, 185, 129, 0.15)',
                color: 'var(--primary-400)',
                padding: 10,
                borderRadius: 12
              }}>
                <Globe size={24} />
              </div>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontFamily: 'var(--font-heading)', color: 'var(--foreground)' }}>
                  Choose Language / भाषा चुनें
                </h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--muted-foreground)' }}>
                  You can change this anytime in Settings.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, margin: '20px 0' }}>
              {languages.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => setSelectedLocale(lang.code)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 18px',
                    borderRadius: 12,
                    background: selectedLocale === lang.code ? 'rgba(16, 185, 129, 0.15)' : 'var(--card)',
                    border: `1.5px solid ${selectedLocale === lang.code ? 'var(--brand-green)' : 'var(--border)'}`,
                    color: 'var(--foreground)',
                    cursor: 'pointer',
                    fontSize: '1rem',
                    fontFamily: 'var(--font-heading)'
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                    <span style={{ fontWeight: 600 }}>{lang.local}</span>
                    <span style={{ fontSize: '0.78rem', color: 'var(--muted-foreground)' }}>{lang.name}</span>
                  </div>
                  {selectedLocale === lang.code && <Check size={20} color="var(--brand-green)" />}
                </button>
              ))}
            </div>

            <button
              className="btn-primary"
              style={{ width: '100%' }}
              onClick={() => setStep(2)}
            >
              Continue / आगे बढ़ें
            </button>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{
                background: 'rgba(16, 185, 129, 0.15)',
                color: 'var(--brand-green)',
                padding: 10,
                borderRadius: 12
              }}>
                <ShieldCheck size={24} />
              </div>
              <div>
                <h2 style={{ fontSize: '1.2rem', fontFamily: 'var(--font-heading)', color: 'var(--foreground)' }}>
                  {t.firstLaunchTitle}
                </h2>
                <span className="dpg-pill">Digital Public Good Standard</span>
              </div>
            </div>

            <div style={{
              background: 'var(--muted)',
              border: '1px solid var(--border)',
              borderRadius: 14,
              padding: 16,
              marginBottom: 20,
              fontSize: '0.9rem',
              color: 'var(--foreground)',
              lineHeight: 1.6
            }}>
              <p style={{ marginBottom: 12 }}>
                {t.firstLaunchConsent}
              </p>
              <ul style={{ paddingLeft: 20, fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <li>📸 Camera access is only used when you take leaf photos.</li>
                <li>📍 GPS location remains strictly on your device.</li>
                <li>🛡️ Open source (Apache-2.0) with zero vendor lock-in.</li>
              </ul>
            </div>

            <button
              className="btn-primary"
              style={{ width: '100%' }}
              onClick={() => onComplete(selectedLocale)}
            >
              {t.consentAccept}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
