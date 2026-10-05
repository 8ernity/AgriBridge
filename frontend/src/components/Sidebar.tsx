import React, { useState } from 'react';
import {
  LayoutDashboard,
  MapPin,
  Camera,
  MessageSquare,
  Sprout,
  ShieldCheck,
  Cpu,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  X,
  Shield,
  Layers,
  Activity,
  Award,
  Leaf
} from 'lucide-react';
import { Locale, TRANSLATIONS } from '../services/i18n';

interface NavSection {
  title: string;
  items: {
    id: 'home' | 'fields' | 'scan' | 'ask' | 'more' | 'carbon';
    label: string;
    icon: React.ElementType;
    badge?: string;
  }[];
}

interface SidebarProps {
  activeTab: 'home' | 'fields' | 'scan' | 'ask' | 'more' | 'carbon';
  setActiveTab: (tab: 'home' | 'fields' | 'scan' | 'ask' | 'more' | 'carbon') => void;
  locale: Locale;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  locale,
  mobileOpen,
  setMobileOpen,
  collapsed = false,
  onToggleCollapse
}) => {
  const t = TRANSLATIONS[locale] || TRANSLATIONS.en;

  const navSections: NavSection[] = [
    {
      title: locale === 'hi' ? "विश्लेषण व जीआईएस" : locale === 'bn' ? "অ্যানালিটিক্স ও জিআইএস" : false ? "Uchambuzi na GIS" : "ANALYTICS & GIS",
      items: [
        { id: 'home', label: t.navHome, icon: LayoutDashboard },
        { id: 'fields', label: t.navFields, icon: MapPin },
      ]
    },
    {
      title: locale === 'hi' ? "जलवायु व मृदा कार्बन" : locale === 'bn' ? "জলবায়ু ও মৃত্তিকা কার্বন" : false ? "Hali ya Hewa na Kaboni" : "CLIMATE & REGENERATION",
      items: [
        { id: 'carbon', label: t.navCarbon || 'Carbon & Biomass', icon: Leaf, badge: "Demo" },
      ]
    },
    {
      title: locale === 'hi' ? "एआई फसल रोग निदान" : locale === 'bn' ? "এআই শস্য রোগ নির্ণয়" : false ? "Utambuzi wa Magonjwa" : "AI FIELD DIAGNOSTICS",
      items: [
        { id: 'scan', label: t.navScan, icon: Camera, badge: "Edge AI" },
      ]
    },
    {
      title: locale === 'hi' ? "कृषि सलाह व सहायता" : locale === 'bn' ? "কৃষি পরামর্শ" : false ? "Ushauri wa Kilimo" : "AGRONOMY INTELLIGENCE",
      items: [
        { id: 'ask', label: t.navAsk, icon: MessageSquare, badge: "RAG" },
      ]
    },
    {
      title: locale === 'hi' ? "सेटिंग्स व सार्वजनिक जानकारी" : locale === 'bn' ? "সেটিংস ও তথ্য" : false ? "Mipangilio na Taarifa" : "GOVERNANCE & SYSTEM",
      items: [
        { id: 'more', label: t.navMore, icon: Cpu },
      ]
    }
  ];

  return (
    <>
      {/* Mobile overlay backdrop */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            zIndex: 49
          }}
        />
      )}

      {/* CrimeRakshak Floating Sidebar */}
      <aside
        className={`app-sidebar ${mobileOpen ? 'mobile-open' : ''} ${collapsed ? 'collapsed' : ''}`}
        style={{ overflow: 'hidden' }}
      >
        {/* Brand Header */}
        <div style={{
          height: 80,
          display: 'flex',
          alignItems: 'center',
          padding: '0 20px',
          justifyContent: 'space-between',
          gap: 12
        }}>
          <button
            onClick={onToggleCollapse}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              flex: 1,
              minWidth: 0,
              textAlign: 'left'
            }}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <div style={{
                height: 40,
                width: 40,
                borderRadius: 12,
                background: 'linear-gradient(135deg, var(--brand-lime) 0%, var(--brand-green) 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary-foreground)',
                boxShadow: '0 4px 15px var(--brand-green-glow)',
                flexShrink: 0
              }}>
                <Sprout size={22} />
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <div style={{
                  height: 38,
                  width: 38,
                  borderRadius: 12,
                  background: 'linear-gradient(135deg, var(--brand-lime) 0%, var(--brand-green) 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--primary-foreground)',
                  boxShadow: '0 4px 14px var(--brand-green-glow)',
                  flexShrink: 0
                }}>
                  <Sprout size={20} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div className="brand-logo" style={{
                    fontSize: '1.28rem',
                    letterSpacing: '-0.02em',
                    background: 'linear-gradient(135deg, var(--foreground) 0%, var(--brand-green) 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    whiteSpace: 'nowrap',
                    lineHeight: 1.1
                  }}>
                    AgriBridge
                  </div>
                </div>
              </div>
            )}
          </button>

          {/* Desktop collapse chevron */}
          {!collapsed && onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className="hide-mobile"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--muted-foreground)',
                padding: 6,
                borderRadius: 8,
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title="Collapse"
            >
              <PanelLeftClose size={18} />
            </button>
          )}

          {/* Mobile close */}
          <button
            onClick={() => setMobileOpen(false)}
            className="show-mobile-only"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--muted-foreground)',
              padding: 6,
              borderRadius: 8,
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation Sections */}
        <nav
          className="scrollbar-hide"
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '4px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: 6
          }}
        >
          {navSections.map((section, sIdx) => (
            <div key={sIdx} style={{ marginBottom: 6 }}>
              {!collapsed && (
                <div style={{
                  fontSize: 10,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.14em',
                  color: 'var(--muted-foreground)',
                  padding: '12px 14px 6px',
                  opacity: 0.8
                }}>
                  {section.title}
                </div>
              )}
              {collapsed && <div style={{ height: 1, background: 'var(--border)', margin: '8px 4px' }} />}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveTab(item.id);
                        setMobileOpen(false);
                      }}
                      title={collapsed ? item.label : undefined}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: collapsed ? '11px 0' : '10px 14px',
                        justifyContent: collapsed ? 'center' : 'flex-start',
                        borderRadius: 16,
                        border: 'none',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        width: '100%',
                        background: isActive ? 'var(--card)' : 'transparent',
                        color: isActive ? 'var(--brand-green)' : 'var(--foreground)',
                        boxShadow: isActive ? '0 2px 10px rgba(0, 0, 0, 0.08)' : 'none',
                        fontWeight: isActive ? 700 : 500
                      }}
                    >
                      <Icon
                        size={18}
                        color={isActive ? 'var(--brand-green)' : 'currentColor'}
                        style={{ flexShrink: 0 }}
                      />
                      {!collapsed && (
                        <>
                          <span style={{ flex: 1, fontSize: '0.84rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {item.label}
                          </span>
                          {item.badge && (
                            <span style={{
                              fontSize: '0.62rem',
                              fontWeight: 800,
                              letterSpacing: '0.04em',
                              padding: '2px 6px',
                              borderRadius: 6,
                              background: isActive ? 'var(--brand-green-glow)' : 'rgba(255, 255, 255, 0.06)',
                              color: isActive ? 'var(--brand-green)' : 'var(--muted-foreground)'
                            }}>
                              {item.badge}
                            </span>
                          )}
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom User Identity Card (CrimeRakshak exact style) */}
        <div style={{
          padding: '16px',
          marginTop: 'auto'
        }}>
          <div style={{
            paddingTop: 12,
            borderTop: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <div style={{
                height: 38,
                width: 38,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--brand-purple) 0%, #7b2484 100%)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '0.85rem',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
                border: '2px solid var(--background)',
                flexShrink: 0
              }}>
                KM
              </div>
              {!collapsed && (
                <div style={{ minWidth: 0 }}>
                  <div style={{
                    fontSize: '0.86rem',
                    fontWeight: 800,
                    color: 'var(--foreground)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    Kisan Mitra
                  </div>
                  <div style={{
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: 'var(--brand-green)'
                  }}>
                    Smallholder Lead
                  </div>
                </div>
              )}
            </div>

            {!collapsed && (
              <button
                onClick={() => setActiveTab('more')}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--muted-foreground)',
                  padding: 6,
                  borderRadius: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                title={t.settingsTitle}
              >
                <Settings size={18} />
              </button>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};
