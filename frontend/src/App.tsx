import React, { useState, useEffect } from 'react';
import { Show, SignInButton } from '@clerk/react';
import { Locale, TRANSLATIONS } from './services/i18n';
import { Plot, ScanResult } from './types';
import { apiClient } from './services/api';
import { getAllOfflineScans, deleteOfflineScan, getOfflineScansCount } from './services/offlineStorage';

import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { MobileBottomNav } from './components/MobileBottomNav';
import { HomeTab } from './components/HomeTab';
import { FieldsTab } from './components/FieldsTab';
import { ScanTab } from './components/ScanTab';
import { AskTab } from './components/AskTab';
import { MoreTab } from './components/MoreTab';
import { CarbonTab } from './components/CarbonTab';
import { OnboardingModal } from './components/OnboardingModal';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class TabErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Tab Error Boundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2.5rem', textAlign: 'center', background: 'var(--card)', borderRadius: '1.25rem', border: '1px solid var(--border)', margin: '1rem 0' }}>
          <h3 style={{ color: 'var(--brand-amber)', marginBottom: '0.5rem', fontSize: '1.15rem' }}>Unable to load view</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', maxWidth: 450, margin: '0 auto' }}>
            {this.state.error?.message || 'A rendering error occurred in this tab.'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false })}
            style={{
              marginTop: '1.2rem',
              padding: '0.55rem 1.4rem',
              borderRadius: '0.75rem',
              background: 'var(--brand-green)',
              color: '#141f00',
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer'
            }}
          >
            Retry Loading View
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'home' | 'fields' | 'scan' | 'ask' | 'more' | 'carbon'>('home');
  const [locale, setLocale] = useState<Locale>('hi');
  const [theme, setTheme] = useState<'dark' | 'light'>('light'); // CrimeRakshak defaults to light
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [plots, setPlots] = useState<Plot[]>([]);
  const [selectedPlot, setSelectedPlot] = useState<Plot | null>(null);
  const [latestScan, setLatestScan] = useState<ScanResult | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [offlineQueueCount, setOfflineQueueCount] = useState(0);

  // Initialize theme from storage
  useEffect(() => {
    const savedTheme = (localStorage.getItem('agribridge_theme') as 'dark' | 'light') || 'light';
    setTheme(savedTheme);
    if (savedTheme === 'light') {
      document.documentElement.classList.add('light');
      document.body.classList.add('light');
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.classList.remove('light');
      document.body.classList.remove('light');
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('agribridge_theme', nextTheme);
    if (nextTheme === 'light') {
      document.documentElement.classList.add('light');
      document.body.classList.add('light');
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.classList.remove('light');
      document.body.classList.remove('light');
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  };

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncOfflineScans();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const onboarded = localStorage.getItem('agribridge_onboarded');
    if (!onboarded) {
      setShowOnboarding(true);
    } else {
      const savedLang = localStorage.getItem('agribridge_lang') as Locale;
      if (savedLang) setLocale(savedLang);
    }

    apiClient.getPlots().then((pts) => {
      if (pts.length > 0) {
        setPlots(pts);
        setSelectedPlot(pts[0]);
      } else {
        if ('geolocation' in navigator) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              apiClient.createPlot({
                name: 'My Field (GPS)',
                crop: 'wheat',
                sowing_date: new Date().toISOString().split('T')[0],
                lat: pos.coords.latitude,
                lon: pos.coords.longitude,
                area_ha: 1.0
              }).then(newPlot => {
                setPlots([newPlot]);
                setSelectedPlot(newPlot);
              }).catch(console.error);
            },
            (err) => console.warn('GPS denied or failed', err),
            { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
          );
        }
      }
    });

    const recent = apiClient.getScanHistory();
    if (recent.length > 0) setLatestScan(recent[0]);

    // Load queue count from IndexedDB (async)
    getOfflineScansCount().then(setOfflineQueueCount).catch(() => setOfflineQueueCount(0));

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const syncOfflineScans = async () => {
    const queued = await getAllOfflineScans();
    if (queued.length === 0) return;

    let successCount = 0;
    for (const item of queued) {
      try {
        const result = await apiClient.diagnoseLeaf(
          item.blob,
          item.cropHint,
          item.plotId,
          false,          // isOffline = false — we are now online
          item.language
        );
        apiClient.saveScanToHistory(result);
        await deleteOfflineScan(item.id);
        successCount++;
      } catch (e) {
        console.error('Offline sync failed for item', item.id, e);
        // Leave failed items in IndexedDB for next retry
      }
    }

    if (successCount > 0) {
      const remaining = await getOfflineScansCount();
      setOfflineQueueCount(remaining);
      // Refresh latest scan from history
      const recent = apiClient.getScanHistory();
      if (recent.length > 0) setLatestScan(recent[0]);
    }
  };

  const handleLocaleChange = (newLocale: Locale) => {
    setLocale(newLocale);
    localStorage.setItem('agribridge_lang', newLocale);
  };

  const handleScanCompleted = (result: ScanResult) => {
    setLatestScan(result);
  };

  const handleOpenAskWithScan = (scan: ScanResult) => {
    setLatestScan(scan);
    setActiveTab('ask');
  };

  const handleOpenAskWithPlot = (plot: Plot) => {
    setSelectedPlot(plot);
    setActiveTab('ask');
  };

  const handlePlotCreated = (newPlot: Plot) => {
    setPlots((prev) => [...prev, newPlot]);
    setSelectedPlot(newPlot);
  };

  const handlePlotDeleted = (plotId: string) => {
    setPlots((prev) => prev.filter(p => p.id !== plotId));
    if (selectedPlot?.id === plotId) {
      setSelectedPlot(null);
    }
  };

  const handleCompleteOnboarding = (chosenLocale: Locale) => {
    handleLocaleChange(chosenLocale);
    localStorage.setItem('agribridge_onboarded', 'true');
    setShowOnboarding(false);
  };

  const t = TRANSLATIONS[locale] || TRANSLATIONS.en;

  const tabTitles: Record<string, string> = {
    home: t.appName,
    fields: t.navFields,
    scan: t.navScan,
    ask: t.navAsk,
    more: t.navMore,
    carbon: t.navCarbon || 'Carbon & Biomass'
  };

  return (
    <>
      <Show when="signed-out">
        <div style={{
          display: 'flex', 
          flexDirection: 'column', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '100vh', 
          background: 'var(--background)',
          color: 'var(--foreground)'
        }}>
          <h1 style={{ marginBottom: '2rem' }}>Welcome to AgriBridge</h1>
          <SignInButton mode="modal">
            <button style={{
              padding: '0.8rem 2rem',
              borderRadius: '0.5rem',
              background: 'var(--brand-green)',
              color: '#141f00',
              fontWeight: 'bold',
              border: 'none',
              cursor: 'pointer',
              fontSize: '1.1rem'
            }}>Sign In to Continue</button>
          </SignInButton>
        </div>
      </Show>

      <Show when="signed-in">
        <div
          className="sidebar-mesh"
          style={{
            display: 'flex',
            width: '100vw',
            overflow: 'hidden',
            color: 'var(--foreground)',
            position: 'relative'
          }}
        >
          {/* CrimeRakshak Floating Sidebar */}
          <Sidebar
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            locale={locale}
            mobileOpen={mobileSidebarOpen}
            setMobileOpen={setMobileSidebarOpen}
            collapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed(prev => !prev)}
          />

          {/* CrimeRakshak Indented Canvas Area */}
          <div
            className={`app-canvas-container ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}
          >
            {/* CrimeRakshak Rounded Floating Canvas with Shadow */}
            <div className="main-mesh app-canvas-panel">
              {/* Subtle SVG Grid Matrix Overlay */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  pointerEvents: 'none',
                  zIndex: 0,
                  backgroundImage: "url('/grid.svg')",
                  backgroundSize: '40px 40px',
                  opacity: theme === 'dark' ? 0.08 : 0.04
                }}
              />

              <Header
                activeTabTitle={tabTitles[activeTab]}
                locale={locale}
                onLocaleChange={handleLocaleChange}
                isOnline={isOnline}
                onToggleSidebar={() => setMobileSidebarOpen(prev => !prev)}
                theme={theme}
                onToggleTheme={toggleTheme}
              />

              {/* Main Scrollable View */}
              <main className="main-scroll-view scrollbar-hide">
                {/* Content Container */}
                <div className="app-content-container">
                  <TabErrorBoundary>
                    <div style={{ display: activeTab === 'home' ? 'block' : 'none', height: '100%' }}>
                      <HomeTab
                        locale={locale}
                        isOnline={isOnline}
                        onNavigate={(tab) => setActiveTab(tab)}
                        onSelectPlot={(p) => setSelectedPlot(p)}
                        plots={plots}
                        selectedPlot={selectedPlot}
                        offlineQueueCount={offlineQueueCount}
                        onSyncOfflineQueue={syncOfflineScans}
                      />
                    </div>

                    <div style={{ display: activeTab === 'fields' ? 'block' : 'none', height: '100%' }}>
                      <FieldsTab
                        locale={locale}
                        plots={plots}
                        selectedPlot={selectedPlot}
                        onSelectPlot={(p) => setSelectedPlot(p)}
                        onPlotCreated={handlePlotCreated}
                        onPlotDeleted={handlePlotDeleted}
                        onOpenAskWithPlot={handleOpenAskWithPlot}
                        isActive={activeTab === 'fields'}
                      />
                    </div>

                    <div style={{ display: activeTab === 'scan' ? 'block' : 'none', height: '100%' }}>
                      <ScanTab
                        locale={locale}
                        isOnline={isOnline}
                        plots={plots}
                        onScanCompleted={handleScanCompleted}
                        onOpenAskWithScan={handleOpenAskWithScan}
                      />
                    </div>

                    <div style={{ display: activeTab === 'ask' ? 'block' : 'none', height: '100%' }}>
                      <AskTab
                        locale={locale}
                        activePlot={selectedPlot}
                        latestScan={latestScan}
                      />
                    </div>

                    <div style={{ display: activeTab === 'carbon' ? 'block' : 'none', height: '100%' }}>
                      <CarbonTab
                        locale={locale}
                        plots={plots}
                        selectedPlot={selectedPlot}
                        onSelectPlot={(p) => setSelectedPlot(p)}
                      />
                    </div>

                    <div style={{ display: activeTab === 'more' ? 'block' : 'none', height: '100%' }}>
                      <MoreTab
                        locale={locale}
                        onLocaleChange={handleLocaleChange}
                        theme={theme}
                        onToggleTheme={toggleTheme}
                      />
                    </div>
                  </TabErrorBoundary>
                </div>
              </main>
            </div>
          </div>

          {/* Mobile Fixed Bottom Navigation */}
          <MobileBottomNav
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            locale={locale}
            onOpenSidebar={() => setMobileSidebarOpen(true)}
          />

          {/* Onboarding Wizard */}
          <OnboardingModal
            isOpen={showOnboarding}
            onComplete={handleCompleteOnboarding}
          />
        </div>
      </Show>
    </>
  );
};
