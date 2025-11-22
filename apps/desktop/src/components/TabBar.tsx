import { useState, useEffect, useCallback } from 'react';
import { invoke } from '../lib/tauri';

// Types
export interface Tab {
  id: number;
  profile_id: number;
  title: string | null;
  url: string;
  favicon: string | null;
  position: number;
  is_pinned: boolean;
  is_active: boolean;
  scroll_position: number;
  created_at: string;
  last_accessed: string;
}

// Tab behavior modes for link navigation
export type TabBehavior = 'new-tab' | 'overwrite-search' | 'all-new-tabs';

export const TAB_BEHAVIOR_OPTIONS: { value: TabBehavior; label: string; color: string; description: string }[] = [
  { value: 'new-tab', label: 'New Tab', color: '#EAB308', description: 'Open links in new tabs (default navigation)' },
  { value: 'overwrite-search', label: 'Overwrite', color: '#EF4444', description: 'Overwrite EarthSearch tab with new content' },
  { value: 'all-new-tabs', label: 'All New', color: '#22C55E', description: 'Open all links in new tabs' },
];

interface TabBarProps {
  profileId: number;
  onTabChange?: (tab: Tab) => void;
  tabBehavior?: TabBehavior;
  onTabBehaviorChange?: (behavior: TabBehavior) => void;
  refreshTrigger?: number;
}

export function TabBar({ profileId, onTabChange, tabBehavior = 'new-tab', onTabBehaviorChange, refreshTrigger }: TabBarProps) {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; tabId: number } | null>(null);
  const [showBehaviorMenu, setShowBehaviorMenu] = useState(false);

  // Load tabs
  const loadTabs = useCallback(async () => {
    try {
      const loadedTabs = await invoke<Tab[]>('get_all_tabs', { profile_id: profileId });
      setTabs(loadedTabs);
    } catch (err) {
      console.error('Failed to load tabs:', err);
    }
  }, [profileId]);

  useEffect(() => {
    loadTabs();
  }, [loadTabs, refreshTrigger]);

  // Create new tab - defaults to EarthSearch home
  const createTab = async (url: string = 'earth://search', title: string = 'EarthSearch') => {
    try {
      const newTab = await invoke<Tab>('create_tab', {
        profile_id: profileId,
        url,
        title,
      });
      await invoke('set_active_tab', { tab_id: newTab.id });
      loadTabs();
      if (onTabChange) onTabChange(newTab);
    } catch (err) {
      console.error('Failed to create tab:', err);
    }
  };

  // Close tab
  const closeTab = async (tabId: number, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    try {
      const tab = tabs.find(t => t.id === tabId);
      await invoke('close_tab', { tab_id: tabId });

      // If closing active tab, activate another
      if (tab?.is_active && tabs.length > 1) {
        const remaining = tabs.filter(t => t.id !== tabId);
        const nextTab = remaining[Math.min(tab.position, remaining.length - 1)];
        if (nextTab) {
          await invoke('set_active_tab', { tab_id: nextTab.id });
          if (onTabChange) onTabChange(nextTab);
        }
      }

      loadTabs();
    } catch (err) {
      console.error('Failed to close tab:', err);
    }
  };

  // Switch to tab - just switches, doesn't create new tabs
  const switchTab = async (tabId: number) => {
    try {
      const tab = await invoke<Tab>('set_active_tab', { tab_id: tabId });
      loadTabs();
      if (onTabChange && tab) onTabChange(tab);
      // Note: We don't call onUrlNavigate here - that's for creating new tabs
      // The parent component will handle display based on activeTab state
    } catch (err) {
      console.error('Failed to switch tab:', err);
    }
  };

  // Pin/unpin tab
  const togglePin = async (tabId: number) => {
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return;
    try {
      await invoke('pin_tab', { tab_id: tabId, pinned: !tab.is_pinned });
      loadTabs();
    } catch (err) {
      console.error('Failed to toggle pin:', err);
    }
  };

  // Duplicate tab
  const duplicateTab = async (tabId: number) => {
    try {
      await invoke('duplicate_tab', { tab_id: tabId });
      loadTabs();
    } catch (err) {
      console.error('Failed to duplicate tab:', err);
    }
  };

  // Close tabs to right
  const closeTabsToRight = async (tabId: number) => {
    try {
      await invoke('close_tabs_to_right', { tab_id: tabId });
      loadTabs();
    } catch (err) {
      console.error('Failed to close tabs to right:', err);
    }
  };

  // Context menu handler
  const handleContextMenu = (e: React.MouseEvent, tabId: number) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, tabId });
  };

  // Close context menu and behavior menu on outside click
  useEffect(() => {
    const handleClick = () => {
      setContextMenu(null);
      setShowBehaviorMenu(false);
    };
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+T - New tab
      if (e.ctrlKey && e.key === 't') {
        e.preventDefault();
        createTab();
      }
      // Ctrl+W - Close current tab
      if (e.ctrlKey && e.key === 'w') {
        e.preventDefault();
        const activeTab = tabs.find(t => t.is_active);
        if (activeTab && tabs.length > 1) {
          closeTab(activeTab.id);
        }
      }
      // Ctrl+1-9 - Switch to tab by index
      if (e.ctrlKey && e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        const index = parseInt(e.key) - 1;
        if (index < tabs.length) {
          switchTab(tabs[index].id);
        }
      }
      // Ctrl+Tab - Next tab
      if (e.ctrlKey && e.key === 'Tab' && !e.shiftKey) {
        e.preventDefault();
        const activeIndex = tabs.findIndex(t => t.is_active);
        const nextIndex = (activeIndex + 1) % tabs.length;
        switchTab(tabs[nextIndex].id);
      }
      // Ctrl+Shift+Tab - Previous tab
      if (e.ctrlKey && e.shiftKey && e.key === 'Tab') {
        e.preventDefault();
        const activeIndex = tabs.findIndex(t => t.is_active);
        const prevIndex = (activeIndex - 1 + tabs.length) % tabs.length;
        switchTab(tabs[prevIndex].id);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [tabs]);

  const pinnedTabs = tabs.filter(t => t.is_pinned);
  const regularTabs = tabs.filter(t => !t.is_pinned);

  return (
    <div className="flex items-center bg-[var(--navbar-color)] border-b border-gray-700/50 h-9 select-none">
      {/* Pinned tabs */}
      {pinnedTabs.map(tab => (
        <div
          key={tab.id}
          className={`
            flex items-center justify-center w-10 h-full cursor-pointer
            border-r border-gray-700/30 transition-all relative
            ${tab.is_active
              ? 'bg-[var(--primary-color)]/20 border-b-2 border-b-[var(--primary-color)]'
              : 'hover:bg-gray-700/30'}
          `}
          onClick={() => switchTab(tab.id)}
          onContextMenu={(e) => handleContextMenu(e, tab.id)}
          title={tab.title || tab.url}
        >
          {tab.favicon ? (
            <img src={tab.favicon} className="w-4 h-4" alt="" />
          ) : (
            <span className={`text-xs ${tab.is_active ? 'text-[var(--primary-color)] font-bold' : 'text-[var(--primary-color)]'}`}>
              {(tab.title || tab.url).charAt(0).toUpperCase()}
            </span>
          )}
        </div>
      ))}

      {/* Regular tabs */}
      <div className="flex flex-1 overflow-x-auto scrollbar-none">
        {regularTabs.map(tab => (
          <div
            key={tab.id}
            className={`
              flex items-center gap-2 min-w-[120px] max-w-[200px] h-full px-3 cursor-pointer
              border-r border-gray-700/30 transition-all group relative
              ${tab.is_active
                ? 'bg-[var(--primary-color)]/20 border-b-2 border-b-[var(--primary-color)]'
                : 'hover:bg-gray-700/30'}
            `}
            onClick={() => switchTab(tab.id)}
            onContextMenu={(e) => handleContextMenu(e, tab.id)}
          >
            {tab.favicon ? (
              <img src={tab.favicon} className="w-4 h-4 flex-shrink-0" alt="" />
            ) : (
              <span className={`w-4 h-4 flex items-center justify-center text-xs flex-shrink-0 ${
                tab.is_active ? 'text-[var(--primary-color)] font-bold' : 'text-[var(--primary-color)]'
              }`}>
                {(tab.title || tab.url).charAt(0).toUpperCase()}
              </span>
            )}
            <span className={`text-xs truncate flex-1 ${
              tab.is_active ? 'text-white font-medium' : 'text-[var(--text-color)]'
            }`}>
              {tab.title || tab.url}
            </span>
            <button
              onClick={(e) => closeTab(tab.id, e)}
              className="p-0.5 rounded hover:bg-gray-600/50 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      {/* New tab button */}
      <button
        onClick={() => createTab()}
        className="flex items-center justify-center w-8 h-full hover:bg-gray-700/30 transition-colors"
        title="New Tab (Ctrl+T)"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>

      {/* Tab behavior selector */}
      <div className="relative ml-1 mr-2 border-l border-gray-700/50 pl-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowBehaviorMenu(!showBehaviorMenu);
          }}
          className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-gray-700/30 transition-colors text-xs"
          title={TAB_BEHAVIOR_OPTIONS.find(o => o.value === tabBehavior)?.description}
        >
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: TAB_BEHAVIOR_OPTIONS.find(o => o.value === tabBehavior)?.color }}
          />
          <span className="text-[var(--text-muted-color)] hidden sm:inline">
            {TAB_BEHAVIOR_OPTIONS.find(o => o.value === tabBehavior)?.label}
          </span>
          <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Behavior dropdown menu */}
        {showBehaviorMenu && (
          <div
            className="absolute right-0 top-full mt-1 z-50 bg-[var(--card-bg-color)] border border-gray-700 rounded-lg shadow-xl py-1 min-w-[180px]"
            onClick={(e) => e.stopPropagation()}
          >
            {TAB_BEHAVIOR_OPTIONS.map(option => (
              <button
                key={option.value}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-700/50 transition-colors flex items-center gap-2 ${
                  tabBehavior === option.value ? 'bg-gray-700/30' : ''
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  onTabBehaviorChange?.(option.value);
                  setShowBehaviorMenu(false);
                }}
              >
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: option.color }}
                />
                <div className="flex-1">
                  <div className="text-[var(--text-color)]">{option.label}</div>
                  <div className="text-xs text-gray-500">{option.description}</div>
                </div>
                {tabBehavior === option.value && (
                  <svg className="w-4 h-4 text-[var(--primary-color)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-[var(--card-bg-color)] border border-gray-700 rounded-lg shadow-xl py-1 min-w-[160px]"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <button
            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-700/50 transition-colors"
            onClick={() => {
              togglePin(contextMenu.tabId);
              setContextMenu(null);
            }}
          >
            {tabs.find(t => t.id === contextMenu.tabId)?.is_pinned ? 'Unpin Tab' : 'Pin Tab'}
          </button>
          <button
            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-700/50 transition-colors"
            onClick={() => {
              duplicateTab(contextMenu.tabId);
              setContextMenu(null);
            }}
          >
            Duplicate Tab
          </button>
          <div className="border-t border-gray-700 my-1" />
          <button
            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-700/50 transition-colors"
            onClick={() => {
              closeTab(contextMenu.tabId);
              setContextMenu(null);
            }}
          >
            Close Tab
          </button>
          <button
            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-700/50 transition-colors"
            onClick={() => {
              closeTabsToRight(contextMenu.tabId);
              setContextMenu(null);
            }}
          >
            Close Tabs to Right
          </button>
        </div>
      )}
    </div>
  );
}

// Hook for using tabs
export function useTabs(profileId: number) {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTab, setActiveTab] = useState<Tab | null>(null);

  const loadTabs = useCallback(async () => {
    try {
      const loadedTabs = await invoke<Tab[]>('get_all_tabs', { profile_id: profileId });
      setTabs(loadedTabs);
      setActiveTab(loadedTabs.find(t => t.is_active) || null);
    } catch (err) {
      console.error('Failed to load tabs:', err);
    }
  }, [profileId]);

  useEffect(() => {
    loadTabs();
  }, [loadTabs]);

  const createTab = async (url: string = 'earth://newtab', title?: string) => {
    try {
      const newTab = await invoke<Tab>('create_tab', {
        profile_id: profileId,
        url,
        title,
      });
      await invoke('set_active_tab', { tab_id: newTab.id });
      loadTabs();
      return newTab;
    } catch (err) {
      console.error('Failed to create tab:', err);
      return null;
    }
  };

  const updateTab = async (tabId: number, updates: { title?: string; url?: string; favicon?: string }) => {
    try {
      await invoke('update_tab', { tab_id: tabId, ...updates });
      loadTabs();
    } catch (err) {
      console.error('Failed to update tab:', err);
    }
  };

  return {
    tabs,
    activeTab,
    loadTabs,
    createTab,
    updateTab,
  };
}

export default TabBar;
