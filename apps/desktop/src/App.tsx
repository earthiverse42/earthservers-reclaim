import { BrowserRouter as Router } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { invoke } from './lib/tauri';
import { ProfileManager } from './components/ProfileManager';
import { IncognitoToggle, IncognitoBanner } from './components/IncognitoToggle';
import { HistoryViewer } from './components/HistoryViewer';
import { ThemeCustomizer } from './components/ThemeCustomizer';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { AnimationLayer } from './components/AnimationLayer';
import { DomainManager } from './components/DomainManager';
import { MemoryManager } from './components/MemoryManager';
import { EarthMultiMedia } from './components/EarthMultiMedia';
import { TabBar, Tab, TabBehavior } from './components/TabBar';
import { BookmarkBar, BookmarkManager } from './components/BookmarkComponents';
import { WebView } from './components/WebView';
import { WebScraper } from './components/WebScraper';
import { NotesPlugin } from './components/NotesPlugin';
import { PasswordManager } from './components/PasswordManager';
import { OTPAuthenticator } from './components/OTPAuthenticator';

// Inner component that uses theme context for animations
function ThemedAnimationLayer({ enabled }: { enabled: boolean }) {
  const { theme } = useTheme();
  const themeKey = theme?.base_preset as 'ocean-turtle' | 'mountain-eagle' | 'sun-fire' | 'lightning-bolt' | 'air-clouds' | 'earthservers-default' | undefined;

  return (
    <AnimationLayer
      enabled={enabled && !!theme}
      theme={themeKey || 'earthservers-default'}
      primaryColor={theme?.primary_color}
      secondaryColor={theme?.secondary_color}
    />
  );
}

// Types
interface Profile {
  id: number | null;
  name: string;
  icon: string | null;
  created_at: string;
  is_active: boolean;
}

// Service navigation items
const serviceItems = [
  { id: 'search' as const, label: 'EarthSearch', icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' },
  { id: 'memory' as const, label: 'EarthMemory', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
  { id: 'media' as const, label: 'MultiMediaPlayer', icon: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z' },
  { id: 'scraper' as const, label: 'WebScraper', icon: 'M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9' },
  { id: 'write' as const, label: 'EarthWrite', icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z', disabled: true },
  { id: 'voice' as const, label: 'EarthVoice', icon: 'M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z', disabled: true },
];

function App() {
  const [activeService, setActiveService] = useState<'search' | 'memory' | 'media' | 'scraper' | 'write' | 'voice'>('search');
  const [activeProfile, setActiveProfile] = useState<Profile | null>(null);
  const [isIncognito, setIsIncognito] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showThemeCustomizer, setShowThemeCustomizer] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [navbarCollapsed, setNavbarCollapsed] = useState(false);
  const [showBookmarkManager, setShowBookmarkManager] = useState(false);
  const [showBookmarkBar, setShowBookmarkBar] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab | null>(null);
  const [showNotes, setShowNotes] = useState(false);
  const [showPasswordManager, setShowPasswordManager] = useState(false);
  const [showOTPAuthenticator, setShowOTPAuthenticator] = useState(false);
  const [tabBehavior, setTabBehavior] = useState<TabBehavior>('new-tab');
  const [tabRefreshTrigger, setTabRefreshTrigger] = useState(0);
  const [mediaFullscreen, setMediaFullscreen] = useState(false);

  // Handle opening a URL - creates a new tab with that URL
  const handleOpenUrl = async (url: string) => {
    // Handle internal earth:// URLs - just create EarthSearch tab
    if (url.startsWith('earth://')) {
      try {
        const newTab = await invoke<Tab>('create_tab', {
          profile_id: activeProfile?.id ?? 1,
          url: 'earth://search',
          title: 'EarthSearch',
        });
        await invoke('set_active_tab', { tab_id: newTab.id });
        setActiveTab(newTab);
        setTabRefreshTrigger(prev => prev + 1);
        setActiveService('search');
      } catch (err) {
        console.error('Failed to create EarthSearch tab:', err);
      }
      return;
    }

    // Ensure URL has protocol for real URLs
    const fullUrl = url.startsWith('http') ? url : `https://${url}`;

    try {
      // Create a new tab with this URL
      const newTab = await invoke<Tab>('create_tab', {
        profile_id: activeProfile?.id ?? 1,
        url: fullUrl,
        title: new URL(fullUrl).hostname,
      });
      // Set it as active
      await invoke('set_active_tab', { tab_id: newTab.id });
      setActiveTab(newTab);
      // Trigger TabBar to refresh
      setTabRefreshTrigger(prev => prev + 1);
      // Switch to search service
      setActiveService('search');
    } catch (err) {
      console.error('Failed to open URL in new tab:', err);
    }
  };

  // Load active profile on mount
  useEffect(() => {
    loadActiveProfile();
    loadIncognitoStatus();
  }, []);

  const loadActiveProfile = async () => {
    try {
      const profile = await invoke<Profile | null>('get_active_profile');
      setActiveProfile(profile);
    } catch (err) {
      console.error('Failed to load active profile:', err);
    }
  };

  const loadIncognitoStatus = async () => {
    try {
      const status = await invoke<boolean>('get_incognito_status');
      setIsIncognito(status);
    } catch (err) {
      console.error('Failed to load incognito status:', err);
    }
  };

  const handleProfileChange = (profile: Profile) => {
    setActiveProfile(profile);
  };

  const handleIncognitoChange = (status: boolean) => {
    setIsIncognito(status);
  };

  return (
    <ThemeProvider profileId={activeProfile?.id ?? null}>
      <Router>
        <div className={`h-screen flex flex-col overflow-hidden ${
          isIncognito
            ? 'bg-gradient-to-br from-purple-950 via-gray-900 to-purple-900'
            : 'bg-theme-gradient'
        }`}>
          {/* Animated Background Layer - Hide when media fullscreen */}
          {!mediaFullscreen && <ThemedAnimationLayer enabled={!isIncognito} />}

          {/* Incognito Banner - Hide when media fullscreen */}
          {!mediaFullscreen && <IncognitoBanner isVisible={isIncognito} />}

          {/* Main Navbar - EarthSocial Style (Collapsible + Draggable) - Hide when media fullscreen */}
          {!mediaFullscreen && (
          <nav
            className={`sticky top-0 z-50 w-full border-b backdrop-blur-xl transition-all duration-300 overflow-hidden`}
            style={{
              backgroundColor: isIncognito ? 'rgba(88, 28, 135, 0.9)' : 'var(--color-navbar, #0a0a0f)',
              borderColor: 'rgba(255, 255, 255, 0.15)',
              height: navbarCollapsed ? '28px' : 'auto',
            }}
            data-tauri-drag-region
          >
            <div className="w-full px-6 lg:px-10" data-tauri-drag-region>
              <div className={`flex items-center justify-between transition-all duration-300 ${navbarCollapsed ? 'h-7' : 'h-20'}`} data-tauri-drag-region>
                {/* Left Side - Logo/Title */}
                <button
                  onClick={() => !navbarCollapsed && setShowAbout(true)}
                  className={`flex-shrink-0 group transition-all duration-300 ${navbarCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'}`}
                  disabled={navbarCollapsed}
                >
                  <h1 className="text-3xl lg:text-4xl font-bold tracking-tight transition-transform group-hover:scale-105">
                    <span style={{ color: isIncognito ? '#a855f7' : 'var(--color-text, #f0f0f0)' }}>
                      Re
                    </span>
                    <span style={{ color: isIncognito ? '#c084fc' : 'var(--color-secondary, #e91e63)' }}>
                      claim
                    </span>
                  </h1>
                </button>

                {/* Spacer for collapsed state - fills center */}
                {navbarCollapsed && <div className="flex-1" data-tauri-drag-region />}

                {/* Center - Service Navigation (hidden when collapsed) */}
                {!navbarCollapsed && (
                <div className="flex items-center gap-2 lg:gap-3">
                  {serviceItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => !item.disabled && setActiveService(item.id)}
                      disabled={item.disabled}
                      className={`
                        flex items-center gap-2 px-4 lg:px-5 py-2.5 rounded-xl font-semibold text-sm lg:text-base
                        border-2 transition-all duration-200 whitespace-nowrap
                        ${item.disabled
                          ? 'opacity-40 cursor-not-allowed border-white/10 bg-white/5'
                          : activeService === item.id
                            ? isIncognito
                              ? 'bg-purple-500 border-purple-400 text-white shadow-lg shadow-purple-500/30'
                              : 'bg-white/20 border-white/30 text-white shadow-lg'
                            : 'bg-white/10 border-white/20 text-white/80 hover:bg-white/15 hover:border-white/25'
                        }
                      `}
                      style={!item.disabled && activeService === item.id && !isIncognito ? {
                        backgroundColor: 'var(--color-accent, rgba(1, 120, 198, 0.9))',
                        borderColor: 'var(--color-accent, rgba(1, 120, 198, 1))',
                      } : undefined}
                    >
                      <svg className="w-4 h-4 lg:w-5 lg:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                      </svg>
                      <span className="hidden sm:inline">{item.label}</span>
                    </button>
                  ))}
                </div>
                )}

                {/* Right Side - Controls */}
                <div className={`flex items-center transition-all duration-300 ${navbarCollapsed ? 'gap-1' : 'gap-2 lg:gap-3'}`}>
                  {/* Password Manager Button */}
                  <button
                    onClick={() => setShowPasswordManager(!showPasswordManager)}
                    className={`rounded-xl border transition-all ${navbarCollapsed ? 'p-0.5 opacity-0 w-0 overflow-hidden' : 'p-2.5 opacity-100'} ${
                      showPasswordManager
                        ? 'bg-white/20 border-white/30 text-white'
                        : 'bg-white/10 border-white/20 text-white/80 hover:bg-white/15 hover:text-white'
                    }`}
                    title="Password Manager"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                      />
                    </svg>
                  </button>

                  {/* OTP Authenticator Button */}
                  <button
                    onClick={() => setShowOTPAuthenticator(!showOTPAuthenticator)}
                    className={`rounded-xl border transition-all ${navbarCollapsed ? 'p-0.5 opacity-0 w-0 overflow-hidden' : 'p-2.5 opacity-100'} ${
                      showOTPAuthenticator
                        ? 'bg-white/20 border-white/30 text-white'
                        : 'bg-white/10 border-white/20 text-white/80 hover:bg-white/15 hover:text-white'
                    }`}
                    title="Authenticator"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                      />
                    </svg>
                  </button>

                  {/* Notes Button */}
                  <button
                    onClick={() => setShowNotes(!showNotes)}
                    className={`rounded-xl border transition-all ${navbarCollapsed ? 'p-0.5 opacity-0 w-0 overflow-hidden' : 'p-2.5 opacity-100'} ${
                      showNotes
                        ? 'bg-white/20 border-white/30 text-white'
                        : 'bg-white/10 border-white/20 text-white/80 hover:bg-white/15 hover:text-white'
                    }`}
                    title="Notes"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                  </button>

                  {/* Theme Customizer Button */}
                  <button
                    onClick={() => setShowThemeCustomizer(!showThemeCustomizer)}
                    className={`rounded-xl border transition-all ${navbarCollapsed ? 'p-0.5 opacity-0 w-0 overflow-hidden' : 'p-2.5 opacity-100'} ${
                      showThemeCustomizer
                        ? 'bg-white/20 border-white/30 text-white'
                        : 'bg-white/10 border-white/20 text-white/80 hover:bg-white/15 hover:text-white'
                    }`}
                    title="Customize Theme"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
                      />
                    </svg>
                  </button>

                  {/* History Button */}
                  <button
                    onClick={() => setShowHistory(true)}
                    className={`rounded-xl bg-white/10 border border-white/20 text-white/80 hover:bg-white/15 hover:text-white transition-all ${navbarCollapsed ? 'p-0.5 opacity-0 w-0 overflow-hidden' : 'p-2.5 opacity-100'}`}
                    title="View History"
                    style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </button>

                  {/* Navbar Collapse Toggle - Between History and Incognito, always visible with same size */}
                  <button
                    onClick={() => setNavbarCollapsed(!navbarCollapsed)}
                    className="p-2.5 rounded-xl bg-white/10 border border-white/20 text-white/80 hover:bg-white/15 hover:text-white transition-all"
                    title={navbarCollapsed ? 'Expand navbar' : 'Collapse navbar'}
                    style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                  >
                    <svg
                      className={`w-5 h-5 transition-transform duration-300 ${navbarCollapsed ? 'rotate-180' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  </button>

                  {/* Incognito Toggle */}
                  <div
                    className={`transition-all duration-300 ${navbarCollapsed ? 'opacity-0 w-0 overflow-hidden pointer-events-none' : 'opacity-100'}`}
                    style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                  >
                    <IncognitoToggle onStatusChange={handleIncognitoChange} />
                  </div>

                  {/* Profile Manager */}
                  <div className={`transition-all duration-300 ${navbarCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'}`}>
                    <ProfileManager onProfileChange={handleProfileChange} />
                  </div>
                </div>
              </div>
            </div>
          </nav>
          )}

          {/* Bookmark Bar - Only show for EarthSearch and not in media fullscreen */}
          {activeService === 'search' && showBookmarkBar && !mediaFullscreen && (
            <div className="flex items-center bg-black/20 backdrop-blur-sm border-b border-white/10">
              <BookmarkBar
                profileId={activeProfile?.id ?? 1}
                onNavigate={handleOpenUrl}
                onToggleManager={() => setShowBookmarkManager(true)}
              />
              {/* Toggle Bookmark Bar visibility */}
              <button
                onClick={() => setShowBookmarkBar(false)}
                className="px-2 py-1 mr-2 text-gray-400 hover:text-white transition-colors"
                title="Hide bookmark bar"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          {/* Tab Bar - Only show for EarthSearch and not in media fullscreen */}
          {activeService === 'search' && !mediaFullscreen && (
            <div className="flex items-center bg-black/30 backdrop-blur-sm border-b border-white/10">
              <TabBar
                profileId={activeProfile?.id ?? 1}
                onTabChange={(tab) => {
                  setActiveTab(tab);
                }}
                tabBehavior={tabBehavior}
                onTabBehaviorChange={setTabBehavior}
                refreshTrigger={tabRefreshTrigger}
              />
              {/* Show bookmark bar toggle when hidden */}
              {!showBookmarkBar && (
                <button
                  onClick={() => setShowBookmarkBar(true)}
                  className="px-2 py-1 mr-2 text-gray-400 hover:text-white transition-colors"
                  title="Show bookmark bar"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                </button>
              )}
            </div>
          )}

          {/* Main Content */}
          <main className="flex-1 min-h-0 flex flex-col">
            {/* When browsing a real URL (not earth://), use full screen without padding */}
            {activeTab?.url && !activeTab.url.startsWith('earth://') ? (
              <div className="flex-1 min-h-0 flex flex-col">
                <Home
                  activeService={activeService}
                  profileId={activeProfile?.id ?? null}
                  onOpenUrl={handleOpenUrl}
                  activeTab={activeTab}
                  onMediaFullscreenChange={setMediaFullscreen}
                />
              </div>
            ) : activeService === 'media' ? (
              <div className="flex-1 min-h-0">
                <Home
                  activeService={activeService}
                  profileId={activeProfile?.id ?? null}
                  onOpenUrl={handleOpenUrl}
                  activeTab={activeTab}
                  onMediaFullscreenChange={setMediaFullscreen}
                />
              </div>
            ) : activeService === 'search' ? (
              <div className="flex-1 overflow-auto">
                <Home
                  activeService={activeService}
                  profileId={activeProfile?.id ?? null}
                  onOpenUrl={handleOpenUrl}
                  activeTab={activeTab}
                  onMediaFullscreenChange={setMediaFullscreen}
                />
              </div>
            ) : (
              <div className="container mx-auto px-4 py-8 flex-1 overflow-auto">
                <Home
                  activeService={activeService}
                  profileId={activeProfile?.id ?? null}
                  onOpenUrl={handleOpenUrl}
                  activeTab={activeTab}
                  onMediaFullscreenChange={setMediaFullscreen}
                />
              </div>
            )}
          </main>

          {/* Footer - Hidden when browsing a real URL or when media player is active */}
          {!(activeTab?.url && !activeTab.url.startsWith('earth://')) && activeService !== 'media' && (
          <footer className={`border-t ${isIncognito ? 'border-purple-500/20' : 'border-white/10'} bg-black/20 backdrop-blur-md`}>
            <div className="container mx-auto px-4 py-6">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <span className="text-2xl font-bold">
                    <span style={{ color: isIncognito ? '#a855f7' : 'var(--color-primary, #0fab89)' }}>Re</span>
                    <span style={{ color: isIncognito ? '#c084fc' : 'var(--color-secondary, #e91e63)' }}>claim</span>
                  </span>
                  <span className="text-gray-500">|</span>
                  <span className="text-sm text-gray-400">Digital Sovereignty</span>
                </div>
                <p className={`text-sm italic ${isIncognito ? 'text-purple-400' : 'text-theme-accent'}`}>
                  "We don't desire to rule the Earth. Only to serve it."
                </p>
              </div>
            </div>
          </footer>
          )}

          {/* History Viewer Modal */}
          <HistoryViewer
            profileId={activeProfile?.id ?? null}
            isOpen={showHistory}
            onClose={() => setShowHistory(false)}
          />

          {/* Theme Customizer Modal (Draggable, non-dimming) */}
          <ThemeCustomizer
            profileId={activeProfile?.id ?? null}
            isOpen={showThemeCustomizer}
            onClose={() => setShowThemeCustomizer(false)}
          />

          {/* Notes Plugin (Draggable, non-dimming) */}
          <NotesPlugin
            isOpen={showNotes}
            onClose={() => setShowNotes(false)}
          />

          {/* Bookmark Manager Modal */}
          <BookmarkManager
            profileId={activeProfile?.id ?? 1}
            isOpen={showBookmarkManager}
            onClose={() => setShowBookmarkManager(false)}
            onNavigate={(url) => console.log('Navigate to:', url)}
          />

          {/* Password Manager Modal */}
          <PasswordManager
            profileId={activeProfile?.id ?? 1}
            isOpen={showPasswordManager}
            onClose={() => setShowPasswordManager(false)}
          />

          {/* OTP Authenticator Modal */}
          <OTPAuthenticator
            profileId={activeProfile?.id ?? 1}
            isOpen={showOTPAuthenticator}
            onClose={() => setShowOTPAuthenticator(false)}
          />

          {/* About Modal */}
          {showAbout && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-gray-900 border border-white/10 rounded-2xl shadow-2xl w-full max-w-lg p-8">
                <div className="flex justify-between items-start mb-6">
                  <h2 className="text-3xl font-bold">
                    <span className="text-theme-primary">Re</span>
                    <span className="text-theme-secondary">claim</span>
                  </h2>
                  <button
                    onClick={() => setShowAbout(false)}
                    className="p-2 text-gray-400 hover:text-white transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-4 text-gray-300">
                  <p className="text-lg font-medium text-white">
                    Reclaim your digital sovereignty. Reclaim your privacy. Reclaim the Earth from extractive technology.
                  </p>

                  <p className="text-sm">
                    Reclaim is a local-first AI platform that puts you back in control. Your data never leaves your device.
                    Your AI serves you, not shareholders. Your compute stays local, efficient, and environmentally conscious.
                  </p>

                  <div className="pt-4 border-t border-white/10">
                    <h3 className="text-sm font-semibold text-gray-400 mb-3">FEATURES</h3>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-center gap-2">
                        <span className="text-theme-primary">&#9679;</span>
                        <span><strong>EarthSearch</strong> - Curated, privacy-first search</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-theme-secondary">&#9679;</span>
                        <span><strong>EarthMemory</strong> - Personal knowledge graph</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-theme-accent">&#9679;</span>
                        <span><strong>EarthMultiMedia</strong> - Privacy-focused media player</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-gray-500">&#9679;</span>
                        <span className="text-gray-500"><strong>EarthWrite</strong> - Local writing assistant (coming soon)</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-gray-500">&#9679;</span>
                        <span className="text-gray-500"><strong>EarthVoice</strong> - Private voice interface (coming soon)</span>
                      </li>
                    </ul>
                  </div>

                  <div className="pt-4 border-t border-white/10">
                    <p className="text-xs text-gray-500">
                      Built on principles of digital sovereignty, environmental responsibility, and human agency.
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setShowAbout(false)}
                  className="mt-6 w-full py-3 bg-theme-primary text-white rounded-lg hover:bg-theme-primary/80 transition-colors font-medium"
                >
                  Got it
                </button>
              </div>
            </div>
          )}
        </div>
      </Router>
    </ThemeProvider>
  );
}

function Home({ activeService, profileId, onOpenUrl, activeTab, onMediaFullscreenChange }: {
  activeService: 'search' | 'memory' | 'media' | 'scraper' | 'write' | 'voice';
  profileId: number | null;
  onOpenUrl?: (url: string) => void;
  activeTab?: Tab | null;
  onMediaFullscreenChange?: (isFullscreen: boolean) => void;
}) {
  if (activeService === 'write' || activeService === 'voice') {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-theme-card/80 border border-white/10 rounded-2xl p-12 backdrop-blur-sm text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-white/10 flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">
            {activeService === 'write' ? 'EarthWrite' : 'EarthVoice'}
          </h2>
          <p className="text-gray-400 mb-4">
            {activeService === 'write'
              ? 'Local AI writing assistant - coming soon'
              : 'Private voice interface - coming soon'
            }
          </p>
          <p className="text-sm text-gray-500">
            This feature is under development. Stay tuned!
          </p>
        </div>
      </div>
    );
  }

  // EarthMultiMedia uses full height - no container padding
  if (activeService === 'media') {
    return (
      <div className="h-full w-full">
        <EarthMultiMedia profileId={profileId || 1} onFullscreenChange={onMediaFullscreenChange} />
      </div>
    );
  }

  // Web Scraper view
  if (activeService === 'scraper') {
    return (
      <div className="max-w-5xl mx-auto">
        <WebScraper profileId={profileId} />
      </div>
    );
  }

  // EarthSearch with integrated browser
  if (activeService === 'search') {
    // If active tab has a real URL (not earth://), show WebView
    if (activeTab?.url && !activeTab.url.startsWith('earth://')) {
      return (
        <WebView
          url={activeTab.url}
          tabId={activeTab.id}
          profileId={profileId || 1}
          onNavigate={(newUrl) => onOpenUrl?.(newUrl)}
          onTitleChange={(title) => console.log('Title:', title)}
        />
      );
    }
    // Otherwise show normal DomainManager
    return (
      <div className="w-full py-8 px-4 flex justify-center">
        <div className="w-full max-w-5xl">
          <DomainManager profileId={profileId} onOpenUrl={onOpenUrl} />
        </div>
      </div>
    );
  }

  // EarthMemory
  return (
    <div className="max-w-5xl mx-auto">
      <MemoryManager profileId={profileId} />
    </div>
  );
}

export default App;
