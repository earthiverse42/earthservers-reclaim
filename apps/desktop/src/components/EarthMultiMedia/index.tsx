// EarthMultiMedia - Privacy-focused media player
// Video, Image, Audio player with split view support and optional history

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { invoke, listen } from '../../lib/tauri';
import VideoPlayer from './VideoPlayer';
import ImageViewer from './ImageViewer';

// Floating Controls Component
interface FloatingControlsProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isShuffled: boolean;
  repeatMode: 'none' | 'one' | 'all';
  onPlayPause: () => void;
  onStop: () => void;
  onSkipBack: () => void;
  onSkipForward: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (volume: number) => void;
  onMuteToggle: () => void;
  onShuffleToggle: () => void;
  onRepeatToggle: () => void;
  onPlaylistToggle: () => void;
  onExitFullscreen: () => void;
  showPlaylist: boolean;
}

function FloatingControls({
  isPlaying,
  currentTime,
  duration,
  volume,
  isMuted,
  isShuffled,
  repeatMode,
  onPlayPause,
  onStop,
  onSkipBack,
  onSkipForward,
  onSeek,
  onVolumeChange,
  onMuteToggle,
  onShuffleToggle,
  onRepeatToggle,
  onPlaylistToggle,
  onExitFullscreen,
  showPlaylist,
}: FloatingControlsProps) {
  const [position, setPosition] = useState({ x: window.innerWidth / 2 - 250, y: window.innerHeight - 100 });
  const [size, setSize] = useState({ width: 500, height: 70 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isCollapsed, setIsCollapsed] = useState(false);
  const controlsRef = useRef<HTMLDivElement>(null);

  // Keyboard shortcuts for media controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          onPlayPause();
          break;
        case 'ArrowUp':
          e.preventDefault();
          onVolumeChange(Math.min(1, volume + 0.1));
          break;
        case 'ArrowDown':
          e.preventDefault();
          onVolumeChange(Math.max(0, volume - 0.1));
          break;
        case 'ArrowLeft':
          e.preventDefault();
          onSeek(Math.max(0, currentTime - 10));
          break;
        case 'ArrowRight':
          e.preventDefault();
          onSeek(Math.min(duration, currentTime + 10));
          break;
        case 'Enter':
          e.preventDefault();
          onSkipForward();
          break;
        case 'Escape':
          e.preventDefault();
          onExitFullscreen();
          break;
        case 'm':
          e.preventDefault();
          onMuteToggle();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [volume, currentTime, duration, onPlayPause, onVolumeChange, onSeek, onSkipForward, onExitFullscreen, onMuteToggle]);

  // Format time as MM:SS or HH:MM:SS
  const formatTime = (seconds: number): string => {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle drag start
  const handleDragStart = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.resize-handle')) return;
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };

  // Handle resize start
  const handleResizeStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsResizing(true);
  };

  // Handle mouse move
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setPosition({
          x: Math.max(0, Math.min(window.innerWidth - size.width, e.clientX - dragOffset.x)),
          y: Math.max(0, Math.min(window.innerHeight - size.height, e.clientY - dragOffset.y)),
        });
      } else if (isResizing && controlsRef.current) {
        const newWidth = Math.max(400, Math.min(800, e.clientX - position.x));
        setSize(s => ({ ...s, width: newWidth }));
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    if (isDragging || isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, dragOffset, position.x, size.width]);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return createPortal(
    <div
      ref={controlsRef}
      className="fixed z-[10000] select-none"
      style={{
        left: position.x,
        top: position.y,
        width: isCollapsed ? 180 : size.width,
      }}
    >
      {/* Drag Handle / Header */}
      <div
        className={`flex items-center justify-between px-2 py-1 bg-gray-900/95 backdrop-blur-xl border border-white/20 cursor-move ${
          isCollapsed ? 'rounded-lg' : 'rounded-t-lg border-b-0'
        }`}
        onMouseDown={handleDragStart}
      >
        <div className="flex items-center gap-2">
          {/* Collapse/Expand toggle */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-0.5 text-gray-400 hover:text-white transition-colors"
            title={isCollapsed ? "Expand (show controls)" : "Collapse (hide controls)"}
          >
            <svg className={`w-3.5 h-3.5 transition-transform ${isCollapsed ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <span className="text-[10px] text-gray-500 font-medium uppercase tracking-wide">Player</span>
        </div>
        <div className="text-[10px] text-gray-400 font-mono">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>
      </div>

      {/* Main Controls */}
      {!isCollapsed && (
        <div className="bg-gray-900/95 backdrop-blur-xl rounded-b-lg border border-t-0 border-white/20 px-3 py-2">
          {/* Progress Bar */}
          <div
            className="h-1.5 bg-white/20 rounded-full cursor-pointer mb-2 group relative"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const pos = (e.clientX - rect.left) / rect.width;
              onSeek(pos * duration);
            }}
          >
            <div
              className="h-full bg-[var(--primary-color)] rounded-full relative"
              style={{ width: `${progress}%` }}
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>

          {/* Control Buttons - Compact */}
          <div className="flex items-center justify-between gap-2">
            {/* Left: Shuffle & Skip Back */}
            <div className="flex items-center">
              <button
                onClick={onShuffleToggle}
                className={`p-1.5 rounded transition-colors ${isShuffled ? 'text-[var(--primary-color)]' : 'text-gray-500 hover:text-white'}`}
                title="Shuffle"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
                </svg>
              </button>
              <button
                onClick={onSkipBack}
                className="p-1.5 text-gray-400 hover:text-white transition-colors"
                title="Previous"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
                </svg>
              </button>
            </div>

            {/* Center: Stop, Play/Pause, Next */}
            <div className="flex items-center gap-1">
              <button
                onClick={onStop}
                className="p-1.5 text-gray-400 hover:text-white transition-colors"
                title="Stop"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 6h12v12H6z" />
                </svg>
              </button>
              <button
                onClick={onPlayPause}
                className="p-2 bg-[var(--primary-color)] text-white rounded-full hover:bg-[var(--primary-color)]/80 transition-colors"
                title={isPlaying ? "Pause (Space)" : "Play (Space)"}
              >
                {isPlaying ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>
              <button
                onClick={onSkipForward}
                className="p-1.5 text-gray-400 hover:text-white transition-colors"
                title="Next (Enter)"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
                </svg>
              </button>
            </div>

            {/* Right: Repeat, Volume, Playlist, Exit */}
            <div className="flex items-center">
              <button
                onClick={onRepeatToggle}
                className={`p-1.5 rounded transition-colors relative ${repeatMode !== 'none' ? 'text-[var(--primary-color)]' : 'text-gray-500 hover:text-white'}`}
                title={`Repeat: ${repeatMode}`}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {repeatMode === 'one' && (
                  <span className="absolute -top-0.5 -right-0.5 text-[7px] font-bold bg-[var(--primary-color)] text-white rounded-full w-2.5 h-2.5 flex items-center justify-center">1</span>
                )}
              </button>

              {/* Volume */}
              <div className="flex items-center">
                <button
                  onClick={onMuteToggle}
                  className="p-1.5 text-gray-500 hover:text-white transition-colors"
                  title={isMuted ? "Unmute (M)" : "Mute (M)"}
                >
                  {isMuted || volume === 0 ? (
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                    </svg>
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                    </svg>
                  )}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={volume}
                  onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                  className="w-12 h-1 accent-[var(--primary-color)] cursor-pointer"
                  title="Volume (Arrow Up/Down)"
                />
              </div>

              <button
                onClick={onPlaylistToggle}
                className={`p-1.5 rounded transition-colors ${showPlaylist ? 'text-[var(--primary-color)]' : 'text-gray-500 hover:text-white'}`}
                title="Queue/Playlist"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
              </button>

              <button
                onClick={onExitFullscreen}
                className="p-1.5 text-gray-500 hover:text-white transition-colors"
                title="Exit Fullscreen (Esc)"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Resize Handle */}
      {!isCollapsed && (
        <div
          className="resize-handle absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
          onMouseDown={handleResizeStart}
        >
          <svg className="w-4 h-4 text-gray-500" viewBox="0 0 24 24" fill="currentColor">
            <path d="M22 22H20V20H22V22ZM22 18H18V22H22V18ZM18 22H14V18H18V22Z" />
          </svg>
        </div>
      )}
    </div>,
    document.body
  );
}

// Types
export type MediaType = 'video' | 'image' | 'audio';
export type ViewLayout = 'single' | 'horizontal' | 'vertical' | 'quad';
export type SlideshowMode = 'all-at-once' | 'rotating';

interface MediaItem {
  source: string;
  type: MediaType;
  title?: string;
}

// Queue item with unique ID for tracking played status
interface QueueItem {
  id: string;
  source: string;
  type: MediaType;
  title?: string;
  played: boolean;
}

// Per-pane state for multi-instance playback
interface PaneState {
  currentItem: QueueItem | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
}

// Slideshow settings
interface SlideshowSettings {
  enabled: boolean;
  interval: number; // seconds
  mode: SlideshowMode;
  currentRotatingPane: number; // for rotating mode
}

// Media tab for consolidating/separating instances
interface MediaTab {
  id: string;
  title: string;
  mediaItem: MediaItem | null;
  paneIndex: number; // which pane this tab is assigned to (-1 if not in a pane)
}

interface PrivacySettings {
  profile_id: number;
  history_enabled: boolean;
  playlist_history_enabled: boolean;
  require_password: boolean;
  require_otp: boolean;
  password_hash: string | null;
  otp_secret: string | null;
  auto_clear_history_days: number | null;
}

interface Playlist {
  id: number;
  profile_id: number;
  name: string;
  description: string | null;
  thumbnail: string | null;
  is_encrypted: boolean;
  created_at: string;
  updated_at: string | null;
  item_count: number;
}

interface PlaylistItem {
  id: number;
  playlist_id: number;
  source: string;
  media_type: string;
  title: string | null;
  thumbnail: string | null;
  position: number;
  added_at: string;
}

interface EarthMultiMediaProps {
  profileId: number;
  initialSource?: string;
  initialType?: MediaType;
}

// Detect media type from URL/path
function detectMediaType(source: string): MediaType {
  const ext = source.split('.').pop()?.toLowerCase() || '';
  const videoExts = ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv', 'm4v'];
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'ico'];
  const audioExts = ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac'];

  if (videoExts.includes(ext)) return 'video';
  if (imageExts.includes(ext)) return 'image';
  if (audioExts.includes(ext)) return 'audio';

  // Check URL patterns
  if (source.includes('youtube.com') || source.includes('youtu.be') || source.includes('vimeo.com')) {
    return 'video';
  }

  return 'video'; // Default to video
}

export function EarthMultiMedia({ profileId, initialSource, initialType, onFullscreenChange }: EarthMultiMediaProps & { onFullscreenChange?: (isFullscreen: boolean) => void }) {
  // State
  const [layout, setLayout] = useState<ViewLayout>('single');
  const [mediaItems, setMediaItems] = useState<(MediaItem | null)[]>([null, null, null, null]);
  const [activePane, setActivePane] = useState(0);
  const [privacySettings, setPrivacySettings] = useState<PrivacySettings | null>(null);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [currentPlaylist, setCurrentPlaylist] = useState<Playlist | null>(null);
  const [playlistItems, setPlaylistItems] = useState<PlaylistItem[]>([]);
  const [showPlaylistPanel, setShowPlaylistPanel] = useState(false);
  const [showPrivacyPanel, setShowPrivacyPanel] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showFullscreenHeader, setShowFullscreenHeader] = useState(true);
  const fullscreenHeaderTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Playback state for floating controls
  const [playbackState, setPlaybackState] = useState({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 1,
    isMuted: false,
    isShuffled: false,
    repeatMode: 'none' as 'none' | 'one' | 'all',
  });

  // Video element ref for controlling playback
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Queue management for multi-pane playback
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [playedItems, setPlayedItems] = useState<Set<string>>(new Set());

  // Per-pane state tracking
  const [paneStates, setPaneStates] = useState<PaneState[]>([
    { currentItem: null, isPlaying: false, currentTime: 0, duration: 0 },
    { currentItem: null, isPlaying: false, currentTime: 0, duration: 0 },
    { currentItem: null, isPlaying: false, currentTime: 0, duration: 0 },
    { currentItem: null, isPlaying: false, currentTime: 0, duration: 0 },
  ]);

  // Slideshow settings
  const [slideshow, setSlideshow] = useState<SlideshowSettings>({
    enabled: false,
    interval: 5,
    mode: 'rotating',
    currentRotatingPane: 0,
  });
  const slideshowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Media tabs state for consolidating/separating instances
  const [mediaTabs, setMediaTabs] = useState<MediaTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [draggingTab, setDraggingTab] = useState<MediaTab | null>(null);
  const [dropZone, setDropZone] = useState<'tab-bar' | 'pane' | number | null>(null);
  const tabIdCounter = useRef(0);

  // Generate unique tab ID
  const generateTabId = useCallback(() => {
    tabIdCounter.current += 1;
    return `tab-${Date.now()}-${tabIdCounter.current}`;
  }, []);

  // Create a new tab from a media item
  const createTab = useCallback((mediaItem: MediaItem | null, paneIndex: number = -1): MediaTab => {
    const title = mediaItem?.title || mediaItem?.source?.split('/').pop() || 'New Tab';
    return {
      id: generateTabId(),
      title,
      mediaItem,
      paneIndex,
    };
  }, [generateTabId]);

  // Add a new tab
  const addTab = useCallback((mediaItem: MediaItem | null = null) => {
    const newTab = createTab(mediaItem);
    setMediaTabs(prev => [...prev, newTab]);
    setActiveTabId(newTab.id);
    return newTab;
  }, [createTab]);

  // Remove a tab
  const removeTab = useCallback((tabId: string) => {
    setMediaTabs(prev => {
      const filtered = prev.filter(t => t.id !== tabId);
      // If we removed the active tab, activate another one
      if (activeTabId === tabId && filtered.length > 0) {
        setActiveTabId(filtered[filtered.length - 1].id);
      } else if (filtered.length === 0) {
        setActiveTabId(null);
      }
      return filtered;
    });
  }, [activeTabId]);

  // Assign tab to a pane
  const assignTabToPane = useCallback((tabId: string, paneIndex: number) => {
    setMediaTabs(prev => prev.map(tab => {
      if (tab.id === tabId) {
        // Update mediaItems when assigning to pane
        if (tab.mediaItem) {
          setMediaItems(items => {
            const newItems = [...items];
            newItems[paneIndex] = tab.mediaItem;
            return newItems;
          });
        }
        return { ...tab, paneIndex };
      }
      // Remove other tabs from this pane
      if (tab.paneIndex === paneIndex) {
        return { ...tab, paneIndex: -1 };
      }
      return tab;
    }));
    setActiveTabId(tabId);
  }, []);

  // Unassign tab from pane (make it floating in tab bar)
  const unassignTabFromPane = useCallback((tabId: string) => {
    setMediaTabs(prev => prev.map(tab =>
      tab.id === tabId ? { ...tab, paneIndex: -1 } : tab
    ));
  }, []);

  // Handle tab drag start
  const handleTabDragStart = useCallback((tab: MediaTab) => {
    setDraggingTab(tab);
  }, []);

  // Handle tab drag end
  const handleTabDragEnd = useCallback(() => {
    if (draggingTab && dropZone !== null) {
      if (typeof dropZone === 'number') {
        // Dropped on a pane
        assignTabToPane(draggingTab.id, dropZone);
      } else if (dropZone === 'tab-bar') {
        // Dropped back on tab bar - unassign from pane
        unassignTabFromPane(draggingTab.id);
      }
    }
    setDraggingTab(null);
    setDropZone(null);
  }, [draggingTab, dropZone, assignTabToPane, unassignTabFromPane]);

  // Media password state (separate from bookmarks)
  const [showPasswordSetupModal, setShowPasswordSetupModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isSettingPassword, setIsSettingPassword] = useState(false);

  // Toggle fullscreen mode
  const toggleFullscreen = () => {
    const newState = !isFullscreen;
    setIsFullscreen(newState);
    onFullscreenChange?.(newState);
  };

  // Handle fullscreen mouse movement - show header and reset timeout
  const handleFullscreenMouseMove = useCallback(() => {
    if (!isFullscreen) return;

    setShowFullscreenHeader(true);

    if (fullscreenHeaderTimeoutRef.current) {
      clearTimeout(fullscreenHeaderTimeoutRef.current);
    }

    fullscreenHeaderTimeoutRef.current = setTimeout(() => {
      setShowFullscreenHeader(false);
    }, 3000);
  }, [isFullscreen]);

  // Cleanup fullscreen header timeout
  useEffect(() => {
    return () => {
      if (fullscreenHeaderTimeoutRef.current) {
        clearTimeout(fullscreenHeaderTimeoutRef.current);
      }
    };
  }, []);

  // Reset header visibility when entering/exiting fullscreen
  useEffect(() => {
    if (isFullscreen) {
      setShowFullscreenHeader(true);
      handleFullscreenMouseMove();
    }
  }, [isFullscreen, handleFullscreenMouseMove]);

  // Playback control handlers
  const handlePlayPause = useCallback(() => {
    // Dispatch a custom event that VideoPlayer can listen to
    window.dispatchEvent(new CustomEvent('media-playpause'));
    setPlaybackState(s => ({ ...s, isPlaying: !s.isPlaying }));
  }, []);

  const handleStop = useCallback(() => {
    window.dispatchEvent(new CustomEvent('media-stop'));
    setPlaybackState(s => ({ ...s, isPlaying: false, currentTime: 0 }));
  }, []);

  const handleSkipBack = useCallback(() => {
    // Skip to previous in playlist or rewind
    window.dispatchEvent(new CustomEvent('media-skip', { detail: { direction: 'back' } }));
  }, []);

  const handleSkipForward = useCallback(() => {
    // Skip to next in playlist
    window.dispatchEvent(new CustomEvent('media-skip', { detail: { direction: 'forward' } }));
  }, []);

  const handleSeek = useCallback((time: number) => {
    window.dispatchEvent(new CustomEvent('media-seek', { detail: { time } }));
    setPlaybackState(s => ({ ...s, currentTime: time }));
  }, []);

  const handleVolumeChange = useCallback((volume: number) => {
    window.dispatchEvent(new CustomEvent('media-volume', { detail: { volume } }));
    setPlaybackState(s => ({ ...s, volume, isMuted: volume === 0 }));
  }, []);

  const handleMuteToggle = useCallback(() => {
    window.dispatchEvent(new CustomEvent('media-mute'));
    setPlaybackState(s => ({ ...s, isMuted: !s.isMuted }));
  }, []);

  const handleShuffleToggle = useCallback(() => {
    setPlaybackState(s => ({ ...s, isShuffled: !s.isShuffled }));
  }, []);

  const handleRepeatToggle = useCallback(() => {
    setPlaybackState(s => {
      const modes: ('none' | 'one' | 'all')[] = ['none', 'one', 'all'];
      const currentIndex = modes.indexOf(s.repeatMode);
      const nextMode = modes[(currentIndex + 1) % modes.length];
      return { ...s, repeatMode: nextMode };
    });
  }, []);

  // Generate unique ID for queue items
  const generateQueueId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Add items to queue
  const addToQueue = useCallback((items: Array<{ source: string; type?: MediaType; title?: string }>) => {
    const newItems: QueueItem[] = items.map(item => ({
      id: generateQueueId(),
      source: item.source,
      type: item.type || detectMediaType(item.source),
      title: item.title || item.source.split('/').pop(),
      played: false,
    }));
    setQueue(prev => [...prev, ...newItems]);
    return newItems;
  }, []);

  // Get next unplayed item from queue
  const getNextUnplayedItem = useCallback((shuffle: boolean, excludeIds: Set<string> = new Set()): QueueItem | null => {
    const unplayed = queue.filter(item => !playedItems.has(item.id) && !excludeIds.has(item.id));
    if (unplayed.length === 0) return null;

    if (shuffle) {
      const randomIndex = Math.floor(Math.random() * unplayed.length);
      return unplayed[randomIndex];
    }
    return unplayed[0];
  }, [queue, playedItems]);

  // Mark item as played
  const markAsPlayed = useCallback((itemId: string) => {
    setPlayedItems(prev => new Set(prev).add(itemId));
  }, []);

  // Reset played items (for repeat all)
  const resetPlayedItems = useCallback(() => {
    setPlayedItems(new Set());
  }, []);

  // Get max panes for current layout
  const getMaxPanesForLayout = useCallback((l: ViewLayout): number => {
    switch (l) {
      case 'horizontal':
      case 'vertical':
        return 2;
      case 'quad':
        return 4;
      default:
        return 1;
    }
  }, []);

  // Assign next item to a specific pane
  const assignNextToPaneIndex = useCallback((paneIndex: number) => {
    // Get IDs currently being shown in other panes
    const currentlyShowingIds = new Set(
      paneStates
        .filter((_, i) => i !== paneIndex)
        .map(p => p.currentItem?.id)
        .filter(Boolean) as string[]
    );

    const nextItem = getNextUnplayedItem(playbackState.isShuffled, currentlyShowingIds);
    if (nextItem) {
      setPaneStates(prev => {
        const updated = [...prev];
        updated[paneIndex] = { ...updated[paneIndex], currentItem: nextItem, isPlaying: true };
        return updated;
      });

      // Also update mediaItems for rendering
      setMediaItems(prev => {
        const updated = [...prev];
        updated[paneIndex] = { source: nextItem.source, type: nextItem.type, title: nextItem.title };
        return updated;
      });
    }
  }, [paneStates, playbackState.isShuffled, getNextUnplayedItem]);

  // Handle video ended event for a specific pane
  const handlePaneVideoEnded = useCallback((paneIndex: number) => {
    const paneState = paneStates[paneIndex];
    if (paneState.currentItem) {
      markAsPlayed(paneState.currentItem.id);
    }

    // Check if we should load next item
    if (playbackState.repeatMode === 'one') {
      // Replay same item - don't mark as played, just restart
      window.dispatchEvent(new CustomEvent(`media-seek-pane-${paneIndex}`, { detail: { time: 0 } }));
      window.dispatchEvent(new CustomEvent(`media-play-pane-${paneIndex}`));
    } else {
      assignNextToPaneIndex(paneIndex);

      // If no more items and repeat all is enabled, reset and start over
      if (!getNextUnplayedItem(playbackState.isShuffled) && playbackState.repeatMode === 'all') {
        resetPlayedItems();
        assignNextToPaneIndex(paneIndex);
      }
    }
  }, [paneStates, playbackState.repeatMode, playbackState.isShuffled, markAsPlayed, assignNextToPaneIndex, getNextUnplayedItem, resetPlayedItems]);

  // Slideshow: advance to next image(s)
  const advanceSlideshow = useCallback(() => {
    const maxPanes = getMaxPanesForLayout(layout);
    const imageItems = queue.filter(item => item.type === 'image');

    if (imageItems.length === 0) return;

    if (slideshow.mode === 'all-at-once') {
      // Change all panes at once
      for (let i = 0; i < maxPanes; i++) {
        assignNextToPaneIndex(i);
      }
    } else {
      // Rotating mode: change one pane at a time
      const nextPane = (slideshow.currentRotatingPane + 1) % maxPanes;
      assignNextToPaneIndex(nextPane);
      setSlideshow(prev => ({ ...prev, currentRotatingPane: nextPane }));
    }
  }, [layout, queue, slideshow.mode, slideshow.currentRotatingPane, getMaxPanesForLayout, assignNextToPaneIndex]);

  // Slideshow timer effect
  useEffect(() => {
    if (slideshow.enabled && queue.some(item => item.type === 'image')) {
      slideshowTimerRef.current = setTimeout(advanceSlideshow, slideshow.interval * 1000);
    }

    return () => {
      if (slideshowTimerRef.current) {
        clearTimeout(slideshowTimerRef.current);
      }
    };
  }, [slideshow.enabled, slideshow.interval, advanceSlideshow, queue]);

  // Toggle slideshow
  const toggleSlideshow = useCallback(() => {
    setSlideshow(prev => ({ ...prev, enabled: !prev.enabled }));
  }, []);

  // Set slideshow interval
  const setSlideshowInterval = useCallback((interval: number) => {
    setSlideshow(prev => ({ ...prev, interval: Math.max(1, interval) }));
  }, []);

  // Set slideshow mode
  const setSlideshowMode = useCallback((mode: SlideshowMode) => {
    setSlideshow(prev => ({ ...prev, mode }));
  }, []);

  // Initialize queue from files (for "Open with" functionality)
  const initializeFromFiles = useCallback((files: Array<{ source: string; title?: string }>) => {
    const newItems = addToQueue(files);
    const maxPanes = getMaxPanesForLayout(layout);

    // Assign items to panes
    newItems.slice(0, maxPanes).forEach((item, index) => {
      setPaneStates(prev => {
        const updated = [...prev];
        updated[index] = { ...updated[index], currentItem: item, isPlaying: true };
        return updated;
      });
      setMediaItems(prev => {
        const updated = [...prev];
        updated[index] = { source: item.source, type: item.type, title: item.title };
        return updated;
      });
    });
  }, [addToQueue, layout, getMaxPanesForLayout]);

  // Listen for playback updates from VideoPlayer
  useEffect(() => {
    const handleTimeUpdate = (e: CustomEvent) => {
      setPlaybackState(s => ({
        ...s,
        currentTime: e.detail.currentTime,
        duration: e.detail.duration,
        isPlaying: e.detail.isPlaying,
      }));
    };

    window.addEventListener('media-timeupdate' as any, handleTimeUpdate);
    return () => window.removeEventListener('media-timeupdate' as any, handleTimeUpdate);
  }, []);

  // Listen for double-click fullscreen toggle from VideoPlayer
  useEffect(() => {
    const handleToggleFullscreen = () => {
      toggleFullscreen();
    };

    window.addEventListener('media-toggle-fullscreen', handleToggleFullscreen);
    return () => window.removeEventListener('media-toggle-fullscreen', handleToggleFullscreen);
  }, [isFullscreen, onFullscreenChange]);

  // Listen for Tauri file-open events ("Open with Reclaim")
  useEffect(() => {
    let unlisten: (() => void) | null = null;

    const setupFileOpenListener = async () => {
      try {
        // Listen for file-drop events (files dragged onto app)
        const unlistenDrop = await listen<{ paths: string[] }>('tauri://file-drop', (event) => {
          if (event.payload.paths && event.payload.paths.length > 0) {
            const files = event.payload.paths.map(path => ({
              source: path.startsWith('file://') ? path : `file://${path}`,
              title: path.split('/').pop() || path.split('\\').pop(),
            }));
            initializeFromFiles(files);
          }
        });

        // Listen for file association events (when opening files with "Open with")
        const unlistenOpen = await listen<string[]>('tauri://file-open', (event) => {
          if (event.payload && event.payload.length > 0) {
            const files = event.payload.map(path => ({
              source: path.startsWith('file://') ? path : `file://${path}`,
              title: path.split('/').pop() || path.split('\\').pop(),
            }));
            initializeFromFiles(files);
          }
        });

        // Also listen for custom event from Rust backend for cli args
        const unlistenCliFiles = await listen<string[]>('open-files', (event) => {
          if (event.payload && event.payload.length > 0) {
            const files = event.payload.map(path => ({
              source: path.startsWith('file://') ? path : `file://${path}`,
              title: path.split('/').pop() || path.split('\\').pop(),
            }));
            initializeFromFiles(files);
          }
        });

        unlisten = () => {
          unlistenDrop();
          unlistenOpen();
          unlistenCliFiles();
        };
      } catch (err) {
        console.error('Failed to setup file open listeners:', err);
      }
    };

    setupFileOpenListener();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, [initializeFromFiles]);

  // Load initial data
  useEffect(() => {
    loadPrivacySettings();
    loadPlaylists();

    if (initialSource) {
      const type = initialType || detectMediaType(initialSource);
      setMediaItems([{ source: initialSource, type }, null, null, null]);
    }
  }, [profileId, initialSource, initialType]);

  // Load privacy settings
  const loadPrivacySettings = async () => {
    try {
      const settings = await invoke<PrivacySettings>('get_media_privacy_settings', { profile_id: profileId });
      setPrivacySettings(settings);
      // Show password setup modal if no password is set
      if (!settings.password_hash) {
        setShowPasswordSetupModal(true);
      }
    } catch (err) {
      console.error('Failed to load privacy settings:', err);
    }
  };

  // Set media password
  const handleSetPassword = async () => {
    setPasswordError('');

    if (!newPassword) {
      setPasswordError('Please enter a password');
      return;
    }

    if (newPassword.length < 4) {
      setPasswordError('Password must be at least 4 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    setIsSettingPassword(true);
    try {
      await invoke('set_media_password', {
        profile_id: profileId,
        password: newPassword,
      });
      // Reload settings to reflect the change
      await loadPrivacySettings();
      setShowPasswordSetupModal(false);
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      console.error('Failed to set password:', err);
      setPasswordError('Failed to set password. Please try again.');
    } finally {
      setIsSettingPassword(false);
    }
  };

  // Skip password setup (allow using without password)
  const handleSkipPassword = () => {
    setShowPasswordSetupModal(false);
  };

  // Load playlists
  const loadPlaylists = async () => {
    try {
      const lists = await invoke<Playlist[]>('get_media_playlists', { profile_id: profileId });
      setPlaylists(lists);
    } catch (err) {
      console.error('Failed to load playlists:', err);
    }
  };

  // Open media in active pane
  const openMedia = useCallback((source: string, type?: MediaType) => {
    const mediaType = type || detectMediaType(source);
    const newItems = [...mediaItems];
    newItems[activePane] = { source, type: mediaType };
    setMediaItems(newItems);
  }, [mediaItems, activePane]);

  // Open file dialog
  const openFile = async () => {
    // In browser mode, use a file input
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'video/*,image/*,audio/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const url = URL.createObjectURL(file);
        openMedia(url, detectMediaType(file.name));
      }
    };
    input.click();
  };

  // Open URL
  const openUrl = () => {
    if (urlInput.trim()) {
      openMedia(urlInput.trim());
      setUrlInput('');
    }
  };

  // Create playlist
  const createPlaylist = async () => {
    if (!newPlaylistName.trim()) return;
    try {
      await invoke('create_media_playlist', {
        profile_id: profileId,
        name: newPlaylistName,
        description: null,
        encrypted: false,
      });
      setNewPlaylistName('');
      loadPlaylists();
    } catch (err) {
      console.error('Failed to create playlist:', err);
    }
  };

  // Load playlist items
  const loadPlaylistItems = async (playlist: Playlist) => {
    try {
      const items = await invoke<PlaylistItem[]>('get_media_playlist_items', { playlist_id: playlist.id });
      setPlaylistItems(items);
      setCurrentPlaylist(playlist);
    } catch (err) {
      console.error('Failed to load playlist items:', err);
    }
  };

  // Add current media to playlist
  const addToPlaylist = async (playlistId: number) => {
    const media = mediaItems[activePane];
    if (!media) return;
    try {
      await invoke('add_to_media_playlist', {
        playlist_id: playlistId,
        source: media.source,
        media_type: media.type,
        title: media.title || null,
        thumbnail: null,
      });
      if (currentPlaylist?.id === playlistId) {
        loadPlaylistItems(currentPlaylist);
      }
      loadPlaylists();
    } catch (err) {
      console.error('Failed to add to playlist:', err);
    }
  };

  // Render media pane
  const renderPane = (index: number) => {
    const media = mediaItems[index];
    const isActive = activePane === index;
    const isDropTarget = draggingTab && dropZone === index;

    return (
      <div
        className={`relative flex-1 min-w-0 min-h-0 overflow-hidden bg-black/50 ${
          isActive && layout !== 'single' ? 'ring-2 ring-[var(--primary-color)]' : ''
        } ${layout !== 'single' ? 'border border-gray-700/50' : ''} ${
          isDropTarget ? 'ring-2 ring-[var(--primary-color)] ring-dashed bg-[var(--primary-color)]/10' : ''
        }`}
        onClick={() => setActivePane(index)}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDropZone(index);
        }}
        onDragLeave={(e) => {
          e.stopPropagation();
          // Only clear if leaving to non-pane element
          if (!e.relatedTarget || !(e.relatedTarget as HTMLElement).closest('[data-pane]')) {
            setDropZone(null);
          }
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleTabDragEnd();
        }}
        data-pane={index}
      >
        {media ? (
          media.type === 'video' || media.type === 'audio' ? (
            <VideoPlayer
              source={media.source}
              title={media.title}
              className="w-full h-full"
            />
          ) : (
            <ImageViewer
              source={media.source}
              title={media.title}
              className="w-full h-full"
            />
          )
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <svg className="w-16 h-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <p className="text-sm">Drop media here or use the toolbar</p>
            <p className="text-xs text-gray-600 mt-1">Pane {index + 1}</p>
          </div>
        )}

        {/* Pane indicator and tab actions */}
        {layout !== 'single' && (
          <div className="absolute top-2 left-2 flex items-center gap-1">
            <div className={`px-2 py-0.5 rounded text-xs font-medium ${
              isActive ? 'bg-[var(--primary-color)] text-white' : 'bg-black/50 text-gray-400'
            }`}>
              {index + 1}
            </div>
            {/* Create tab from pane content */}
            {media && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const newTab = createTab(media, index);
                  setMediaTabs(prev => [...prev, newTab]);
                  setActiveTabId(newTab.id);
                }}
                className="p-1 bg-black/50 hover:bg-black/70 rounded text-gray-400 hover:text-white transition-colors"
                title="Create tab from this pane"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </button>
            )}
          </div>
        )}

        {/* Drop overlay indicator */}
        {isDropTarget && (
          <div className="absolute inset-0 flex items-center justify-center bg-[var(--primary-color)]/20 border-2 border-dashed border-[var(--primary-color)] pointer-events-none z-10">
            <div className="bg-black/70 rounded-lg px-4 py-2 text-white text-sm font-medium">
              Drop to assign to Pane {index + 1}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Get max panes for current layout
  const getMaxPanes = () => {
    switch (layout) {
      case 'horizontal':
      case 'vertical':
        return 2;
      case 'quad':
        return 4;
      default:
        return 1;
    }
  };

  // Get current media title
  const currentMedia = mediaItems[activePane];
  const currentTitle = currentMedia?.title || (currentMedia?.source ? currentMedia.source.split('/').pop() : 'No media loaded');

  return (
    <div
      className={`flex flex-col h-full ${isFullscreen ? 'bg-black fixed inset-0 z-[9999]' : 'bg-[var(--background-color)]'}`}
      onMouseMove={isFullscreen ? handleFullscreenMouseMove : undefined}
    >
      {/* Fullscreen Header - Auto-hides */}
      {isFullscreen && (
        <div
          className={`absolute top-0 left-0 right-0 z-[10001] bg-gradient-to-b from-black/80 to-transparent transition-opacity duration-300 ${
            showFullscreenHeader ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          <div className="flex items-center justify-between px-4 py-3">
            {/* Left: Title */}
            <div className="flex items-center gap-3">
              <span className="text-white font-medium truncate max-w-[400px]">{currentTitle}</span>
            </div>

            {/* Right: Controls */}
            <div className="flex items-center gap-2">
              {/* Layout buttons */}
              <div className="flex items-center gap-1 bg-black/30 rounded p-1">
                {(['single', 'horizontal', 'vertical', 'quad'] as ViewLayout[]).map((l) => (
                  <button
                    key={l}
                    onClick={() => setLayout(l)}
                    className={`p-1.5 rounded transition-colors ${
                      layout === l ? 'bg-[var(--primary-color)]/20 text-[var(--primary-color)]' : 'text-gray-400 hover:text-white'
                    }`}
                    title={l.charAt(0).toUpperCase() + l.slice(1)}
                  >
                    {l === 'single' && (
                      <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
                        <rect x="2" y="2" width="12" height="12" rx="1" />
                      </svg>
                    )}
                    {l === 'horizontal' && (
                      <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
                        <rect x="2" y="2" width="5" height="12" rx="1" />
                        <rect x="9" y="2" width="5" height="12" rx="1" />
                      </svg>
                    )}
                    {l === 'vertical' && (
                      <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
                        <rect x="2" y="2" width="12" height="5" rx="1" />
                        <rect x="2" y="9" width="12" height="5" rx="1" />
                      </svg>
                    )}
                    {l === 'quad' && (
                      <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
                        <rect x="2" y="2" width="5" height="5" rx="1" />
                        <rect x="9" y="2" width="5" height="5" rx="1" />
                        <rect x="2" y="9" width="5" height="5" rx="1" />
                        <rect x="9" y="9" width="5" height="5" rx="1" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>

              {/* Slideshow Controls */}
              <div className="flex items-center gap-1 bg-black/30 rounded p-1">
                {/* Slideshow toggle */}
                <button
                  onClick={toggleSlideshow}
                  className={`p-1.5 rounded transition-colors ${
                    slideshow.enabled ? 'bg-[var(--primary-color)]/20 text-[var(--primary-color)]' : 'text-gray-400 hover:text-white'
                  }`}
                  title={slideshow.enabled ? 'Stop Slideshow' : 'Start Slideshow'}
                >
                  {slideshow.enabled ? (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  )}
                </button>

                {/* Slideshow interval */}
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={slideshow.interval}
                  onChange={(e) => setSlideshowInterval(parseInt(e.target.value) || 5)}
                  className="w-10 bg-black/30 border border-gray-700/50 rounded px-1 py-0.5 text-xs text-white text-center"
                  title="Slideshow interval (seconds)"
                />
                <span className="text-xs text-gray-400">s</span>

                {/* Slideshow mode toggle - only show when not in single layout */}
                {layout !== 'single' && (
                  <button
                    onClick={() => setSlideshowMode(slideshow.mode === 'rotating' ? 'all-at-once' : 'rotating')}
                    className="p-1.5 rounded transition-colors text-gray-400 hover:text-white"
                    title={slideshow.mode === 'rotating' ? 'Mode: Rotating (one at a time)' : 'Mode: All at once'}
                  >
                    {slideshow.mode === 'rotating' ? (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                      </svg>
                    )}
                  </button>
                )}
              </div>

              {/* Queue info */}
              {queue.length > 0 && (
                <span className="text-xs text-gray-400 px-2">
                  {playedItems.size}/{queue.length}
                </span>
              )}

              {/* Playlist toggle */}
              <button
                onClick={() => setShowPlaylistPanel(!showPlaylistPanel)}
                className={`p-2 rounded transition-colors ${
                  showPlaylistPanel ? 'bg-[var(--primary-color)]/20 text-[var(--primary-color)]' : 'text-gray-400 hover:text-white'
                }`}
                title="Playlists"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
              </button>

              {/* Privacy toggle */}
              <button
                onClick={() => setShowPrivacyPanel(!showPrivacyPanel)}
                className={`p-2 rounded transition-colors ${
                  showPrivacyPanel ? 'bg-[var(--primary-color)]/20 text-[var(--primary-color)]' : 'text-gray-400 hover:text-white'
                }`}
                title="Privacy Settings"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </button>

              {/* Exit fullscreen */}
              <button
                onClick={toggleFullscreen}
                className="p-2 rounded text-gray-400 hover:text-white transition-colors"
                title="Exit Fullscreen (Esc)"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Controls - Only in fullscreen mode, auto-hides */}
      {isFullscreen && showFullscreenHeader && (
        <FloatingControls
          isPlaying={playbackState.isPlaying}
          currentTime={playbackState.currentTime}
          duration={playbackState.duration}
          volume={playbackState.volume}
          isMuted={playbackState.isMuted}
          isShuffled={playbackState.isShuffled}
          repeatMode={playbackState.repeatMode}
          onPlayPause={handlePlayPause}
          onStop={handleStop}
          onSkipBack={handleSkipBack}
          onSkipForward={handleSkipForward}
          onSeek={handleSeek}
          onVolumeChange={handleVolumeChange}
          onMuteToggle={handleMuteToggle}
          onShuffleToggle={handleShuffleToggle}
          onRepeatToggle={handleRepeatToggle}
          onPlaylistToggle={() => setShowPlaylistPanel(!showPlaylistPanel)}
          onExitFullscreen={toggleFullscreen}
          showPlaylist={showPlaylistPanel}
        />
      )}

      {/* Toolbar - Hidden in fullscreen */}
      {!isFullscreen && (
      <div className="flex items-center gap-2 p-2 bg-[var(--navbar-color)] border-b border-gray-700/50">
        {/* File/URL input */}
        <button
          onClick={openFile}
          className="px-3 py-1.5 bg-[var(--primary-color)] text-white rounded hover:bg-[var(--primary-color)]/80 transition-colors flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          Open
        </button>

        <div className="flex-1 flex items-center gap-2 max-w-md">
          <input
            type="text"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && openUrl()}
            placeholder="Enter URL or file path..."
            className="flex-1 bg-black/30 border border-gray-700/50 rounded px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[var(--primary-color)]"
          />
          <button
            onClick={openUrl}
            disabled={!urlInput.trim()}
            className="px-3 py-1.5 bg-gray-700/50 text-white rounded hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            Go
          </button>
        </div>

        {/* Media Tabs */}
        <div
          className={`flex items-center gap-1 flex-1 min-w-0 bg-black/20 rounded px-1 py-0.5 overflow-x-auto scrollbar-thin ${
            draggingTab && dropZone === 'tab-bar' ? 'ring-2 ring-[var(--primary-color)]' : ''
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDropZone('tab-bar');
          }}
          onDragLeave={() => setDropZone(null)}
          onDrop={(e) => {
            e.preventDefault();
            handleTabDragEnd();
          }}
        >
          {mediaTabs.map((tab) => (
            <div
              key={tab.id}
              draggable
              onDragStart={() => handleTabDragStart(tab)}
              onDragEnd={handleTabDragEnd}
              onClick={() => {
                setActiveTabId(tab.id);
                if (tab.paneIndex >= 0) {
                  setActivePane(tab.paneIndex);
                }
              }}
              className={`flex items-center gap-1.5 px-2 py-1 rounded cursor-grab active:cursor-grabbing transition-colors min-w-0 max-w-[150px] ${
                activeTabId === tab.id
                  ? 'bg-[var(--primary-color)]/20 text-white'
                  : 'bg-black/30 text-gray-400 hover:text-white hover:bg-black/40'
              } ${draggingTab?.id === tab.id ? 'opacity-50' : ''}`}
            >
              {/* Tab icon based on type */}
              {tab.mediaItem?.type === 'video' && (
                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              )}
              {tab.mediaItem?.type === 'image' && (
                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              )}
              {tab.mediaItem?.type === 'audio' && (
                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
              )}
              {!tab.mediaItem && (
                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              )}

              {/* Tab title */}
              <span className="text-xs truncate">{tab.title}</span>

              {/* Pane indicator */}
              {tab.paneIndex >= 0 && (
                <span className="text-[10px] bg-[var(--primary-color)]/30 rounded px-1 flex-shrink-0">
                  {tab.paneIndex + 1}
                </span>
              )}

              {/* Close button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeTab(tab.id);
                }}
                className="p-0.5 hover:bg-white/10 rounded flex-shrink-0"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}

          {/* Add new tab button */}
          <button
            onClick={() => addTab()}
            className="p-1.5 text-gray-500 hover:text-white hover:bg-black/30 rounded transition-colors flex-shrink-0"
            title="New Tab"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </button>

          {/* Drop hint when empty */}
          {mediaTabs.length === 0 && (
            <span className="text-gray-600 text-xs px-2">Drag media here to create tabs</span>
          )}
        </div>

        {/* Layout buttons */}
        <div className="flex items-center gap-1 bg-black/30 rounded p-1">
          {(['single', 'horizontal', 'vertical', 'quad'] as ViewLayout[]).map((l) => (
            <button
              key={l}
              onClick={() => setLayout(l)}
              className={`p-1.5 rounded transition-colors ${
                layout === l ? 'bg-[var(--primary-color)]/20 text-[var(--primary-color)]' : 'text-gray-400 hover:text-white'
              }`}
              title={l.charAt(0).toUpperCase() + l.slice(1)}
            >
              {l === 'single' && (
                <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
                  <rect x="2" y="2" width="12" height="12" rx="1" />
                </svg>
              )}
              {l === 'horizontal' && (
                <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
                  <rect x="2" y="2" width="5" height="12" rx="1" />
                  <rect x="9" y="2" width="5" height="12" rx="1" />
                </svg>
              )}
              {l === 'vertical' && (
                <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
                  <rect x="2" y="2" width="12" height="5" rx="1" />
                  <rect x="2" y="9" width="12" height="5" rx="1" />
                </svg>
              )}
              {l === 'quad' && (
                <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
                  <rect x="2" y="2" width="5" height="5" rx="1" />
                  <rect x="9" y="2" width="5" height="5" rx="1" />
                  <rect x="2" y="9" width="5" height="5" rx="1" />
                  <rect x="9" y="9" width="5" height="5" rx="1" />
                </svg>
              )}
            </button>
          ))}
        </div>

        {/* Slideshow Controls */}
        <div className="flex items-center gap-1 bg-black/30 rounded p-1">
          {/* Slideshow toggle */}
          <button
            onClick={toggleSlideshow}
            className={`p-1.5 rounded transition-colors ${
              slideshow.enabled ? 'bg-[var(--primary-color)]/20 text-[var(--primary-color)]' : 'text-gray-400 hover:text-white'
            }`}
            title={slideshow.enabled ? 'Stop Slideshow' : 'Start Slideshow'}
          >
            {slideshow.enabled ? (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          {/* Slideshow interval */}
          <input
            type="number"
            min="1"
            max="60"
            value={slideshow.interval}
            onChange={(e) => setSlideshowInterval(parseInt(e.target.value) || 5)}
            className="w-12 bg-black/30 border border-gray-700/50 rounded px-1 py-0.5 text-xs text-white text-center"
            title="Slideshow interval (seconds)"
          />
          <span className="text-xs text-gray-400">s</span>

          {/* Slideshow mode toggle - only show when not in single layout */}
          {layout !== 'single' && (
            <button
              onClick={() => setSlideshowMode(slideshow.mode === 'rotating' ? 'all-at-once' : 'rotating')}
              className={`p-1.5 rounded transition-colors text-gray-400 hover:text-white`}
              title={slideshow.mode === 'rotating' ? 'Mode: Rotating (one at a time)' : 'Mode: All at once'}
            >
              {slideshow.mode === 'rotating' ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
              )}
            </button>
          )}
        </div>

        {/* Queue info */}
        {queue.length > 0 && (
          <span className="text-xs text-gray-400 px-2">
            {playedItems.size}/{queue.length} played
          </span>
        )}

        {/* Playlist toggle */}
        <button
          onClick={() => setShowPlaylistPanel(!showPlaylistPanel)}
          className={`p-2 rounded transition-colors ${
            showPlaylistPanel ? 'bg-[var(--primary-color)]/20 text-[var(--primary-color)]' : 'text-gray-400 hover:text-white'
          }`}
          title="Playlists"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
          </svg>
        </button>

        {/* Privacy toggle */}
        <button
          onClick={() => setShowPrivacyPanel(!showPrivacyPanel)}
          className={`p-2 rounded transition-colors ${
            showPrivacyPanel ? 'bg-[var(--primary-color)]/20 text-[var(--primary-color)]' : 'text-gray-400 hover:text-white'
          }`}
          title="Privacy Settings"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </button>

        {/* Fullscreen toggle */}
        <button
          onClick={toggleFullscreen}
          className={`p-2 rounded transition-colors ${
            isFullscreen ? 'bg-[var(--primary-color)]/20 text-[var(--primary-color)]' : 'text-gray-400 hover:text-white'
          }`}
          title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
        >
          {isFullscreen ? (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
            </svg>
          )}
        </button>
      </div>
      )}

      {/* Main Content */}
      <div className="flex flex-1 min-h-0">
        {/* Media Viewer */}
        <div className="flex-1 flex flex-col">
          {layout === 'single' && renderPane(0)}

          {layout === 'horizontal' && (
            <div className="flex-1 flex flex-row">
              {renderPane(0)}
              <div className="w-1 bg-gray-700/50 cursor-col-resize" />
              {renderPane(1)}
            </div>
          )}

          {layout === 'vertical' && (
            <div className="flex-1 flex flex-col">
              {renderPane(0)}
              <div className="h-1 bg-gray-700/50 cursor-row-resize" />
              {renderPane(1)}
            </div>
          )}

          {layout === 'quad' && (
            <div className="flex-1 flex flex-col">
              <div className="flex-1 flex flex-row min-h-0">
                {renderPane(0)}
                <div className="w-1 bg-gray-700/50 cursor-col-resize" />
                {renderPane(1)}
              </div>
              <div className="h-1 bg-gray-700/50 cursor-row-resize" />
              <div className="flex-1 flex flex-row min-h-0">
                {renderPane(2)}
                <div className="w-1 bg-gray-700/50 cursor-col-resize" />
                {renderPane(3)}
              </div>
            </div>
          )}
        </div>

        {/* Playlist Panel */}
        {showPlaylistPanel && (
          <div className="w-64 bg-[var(--card-bg-color)] border-l border-gray-700/50 flex flex-col">
            <div className="p-3 border-b border-gray-700/50">
              <h3 className="font-medium text-white mb-2">Playlists</h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newPlaylistName}
                  onChange={(e) => setNewPlaylistName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && createPlaylist()}
                  placeholder="New playlist..."
                  className="flex-1 bg-black/30 border border-gray-700/50 rounded px-2 py-1 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[var(--primary-color)]"
                />
                <button
                  onClick={createPlaylist}
                  disabled={!newPlaylistName.trim()}
                  className="px-2 py-1 bg-[var(--primary-color)] text-white rounded text-sm disabled:opacity-50"
                >
                  +
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {playlists.length === 0 ? (
                <p className="text-gray-500 text-sm text-center p-4">No playlists yet</p>
              ) : (
                <div className="p-2 space-y-1">
                  {playlists.map((playlist) => (
                    <div
                      key={playlist.id}
                      className={`p-2 rounded cursor-pointer transition-colors ${
                        currentPlaylist?.id === playlist.id
                          ? 'bg-[var(--primary-color)]/20'
                          : 'hover:bg-white/5'
                      }`}
                      onClick={() => loadPlaylistItems(playlist)}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-white text-sm truncate">{playlist.name}</span>
                        <span className="text-gray-500 text-xs">{playlist.item_count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Playlist items */}
              {currentPlaylist && (
                <div className="border-t border-gray-700/50 p-2">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-400 text-xs">{currentPlaylist.name}</span>
                    <button
                      onClick={() => addToPlaylist(currentPlaylist.id)}
                      disabled={!mediaItems[activePane]}
                      className="text-xs text-[var(--primary-color)] hover:underline disabled:opacity-50"
                    >
                      + Add current
                    </button>
                  </div>
                  {playlistItems.length === 0 ? (
                    <p className="text-gray-600 text-xs text-center">Empty playlist</p>
                  ) : (
                    <div className="space-y-1">
                      {playlistItems.map((item) => (
                        <div
                          key={item.id}
                          className="p-1.5 rounded hover:bg-white/5 cursor-pointer"
                          onClick={() => openMedia(item.source, item.media_type as MediaType)}
                        >
                          <span className="text-white text-xs truncate block">
                            {item.title || item.source.split('/').pop()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Privacy Panel */}
        {showPrivacyPanel && (
          <div className="w-72 bg-[var(--card-bg-color)] border-l border-gray-700/50 p-4">
            <h3 className="font-medium text-white mb-4 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Privacy Settings
            </h3>

            {privacySettings && (
              <div className="space-y-4">
                {/* Privacy First Notice */}
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
                  <p className="text-green-400 text-xs">
                    Privacy-first: History and logging are disabled by default.
                  </p>
                </div>

                {/* History Toggle */}
                <label className="flex items-center justify-between">
                  <span className="text-gray-300 text-sm">Enable history</span>
                  <input
                    type="checkbox"
                    checked={privacySettings.history_enabled}
                    onChange={async (e) => {
                      const newSettings = { ...privacySettings, history_enabled: e.target.checked };
                      try {
                        await invoke('update_media_privacy_settings', { settings: newSettings });
                        setPrivacySettings(newSettings);
                      } catch (err) {
                        console.error('Failed to update settings:', err);
                      }
                    }}
                    className="w-5 h-5 rounded accent-[var(--primary-color)]"
                  />
                </label>

                {/* Playlist History Toggle */}
                <label className="flex items-center justify-between">
                  <span className="text-gray-300 text-sm">Track playlist history</span>
                  <input
                    type="checkbox"
                    checked={privacySettings.playlist_history_enabled}
                    onChange={async (e) => {
                      const newSettings = { ...privacySettings, playlist_history_enabled: e.target.checked };
                      try {
                        await invoke('update_media_privacy_settings', { settings: newSettings });
                        setPrivacySettings(newSettings);
                      } catch (err) {
                        console.error('Failed to update settings:', err);
                      }
                    }}
                    className="w-5 h-5 rounded accent-[var(--primary-color)]"
                  />
                </label>

                {/* Password Protection */}
                <div className="border-t border-gray-700/50 pt-4">
                  <label className="flex items-center justify-between mb-2">
                    <span className="text-gray-300 text-sm">Require password</span>
                    <input
                      type="checkbox"
                      checked={privacySettings.require_password}
                      onChange={async (e) => {
                        const newSettings = { ...privacySettings, require_password: e.target.checked };
                        try {
                          await invoke('update_media_privacy_settings', { settings: newSettings });
                          setPrivacySettings(newSettings);
                        } catch (err) {
                          console.error('Failed to update settings:', err);
                        }
                      }}
                      className="w-5 h-5 rounded accent-[var(--primary-color)]"
                    />
                  </label>
                  <p className="text-gray-500 text-xs">
                    Require password to access history and playlists
                  </p>
                </div>

                {/* OTP Protection */}
                <div className="border-t border-gray-700/50 pt-4">
                  <label className="flex items-center justify-between mb-2">
                    <span className="text-gray-300 text-sm">Require OTP</span>
                    <input
                      type="checkbox"
                      checked={privacySettings.require_otp}
                      onChange={async (e) => {
                        const newSettings = { ...privacySettings, require_otp: e.target.checked };
                        try {
                          await invoke('update_media_privacy_settings', { settings: newSettings });
                          setPrivacySettings(newSettings);
                        } catch (err) {
                          console.error('Failed to update settings:', err);
                        }
                      }}
                      className="w-5 h-5 rounded accent-[var(--primary-color)]"
                    />
                  </label>
                  <p className="text-gray-500 text-xs">
                    Two-factor authentication for sensitive actions
                  </p>
                </div>

                {/* Auto Clear */}
                <div className="border-t border-gray-700/50 pt-4">
                  <label className="block text-gray-300 text-sm mb-2">Auto-clear history</label>
                  <select
                    value={privacySettings.auto_clear_history_days || 0}
                    onChange={async (e) => {
                      const days = parseInt(e.target.value) || null;
                      const newSettings = { ...privacySettings, auto_clear_history_days: days };
                      try {
                        await invoke('update_media_privacy_settings', { settings: newSettings });
                        setPrivacySettings(newSettings);
                      } catch (err) {
                        console.error('Failed to update settings:', err);
                      }
                    }}
                    className="w-full bg-black/30 border border-gray-700/50 rounded px-3 py-2 text-sm text-white"
                  >
                    <option value="0">Never</option>
                    <option value="1">After 1 day</option>
                    <option value="7">After 7 days</option>
                    <option value="30">After 30 days</option>
                    <option value="90">After 90 days</option>
                  </select>
                </div>

                {/* Clear History Button */}
                {privacySettings.history_enabled && (
                  <button
                    onClick={async () => {
                      if (confirm('Clear all media history?')) {
                        try {
                          await invoke('clear_media_history', { profile_id: profileId });
                        } catch (err) {
                          console.error('Failed to clear history:', err);
                        }
                      }
                    }}
                    className="w-full mt-4 px-4 py-2 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition-colors text-sm"
                  >
                    Clear All History
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Status Bar - Hidden in fullscreen */}
      {!isFullscreen && (
        <div className="flex items-center gap-4 px-3 py-1 bg-[var(--navbar-color)] border-t border-gray-700/50 text-xs text-gray-500">
          <span>Pane {activePane + 1}/{getMaxPanes()}</span>
          <span>|</span>
          <span>Layout: {layout}</span>
          {privacySettings && !privacySettings.history_enabled && (
            <>
              <span>|</span>
              <span className="text-green-500 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Privacy Mode
              </span>
            </>
          )}
        </div>
      )}

      {/* Password Setup Modal */}
      {showPasswordSetupModal && (
        <div className="fixed inset-0 z-[10002] flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-[var(--primary-color)]/20 to-purple-500/20 px-6 py-4 border-b border-gray-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[var(--primary-color)]/20 flex items-center justify-center">
                  <svg className="w-5 h-5 text-[var(--primary-color)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Set Up Password Protection</h2>
                  <p className="text-sm text-gray-400">Secure your media history and playlists</p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="px-6 py-5">
              {/* Warning Banner */}
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 mb-5">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div>
                    <p className="text-amber-400 font-medium text-sm">Important Warning</p>
                    <p className="text-amber-300/80 text-xs mt-1">
                      If you lose your password, your media history and playlists will be <strong>permanently unretrievable</strong>. There is no password recovery option.
                    </p>
                  </div>
                </div>
              </div>

              {/* Password Fields */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-300 mb-1.5">New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter password..."
                    className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-[var(--primary-color)] transition-colors"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-300 mb-1.5">Confirm Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSetPassword()}
                    placeholder="Confirm password..."
                    className="w-full bg-black/30 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-[var(--primary-color)] transition-colors"
                  />
                </div>

                {/* Error Message */}
                {passwordError && (
                  <div className="flex items-center gap-2 text-red-400 text-sm">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {passwordError}
                  </div>
                )}
              </div>

              {/* Info Text */}
              <p className="text-xs text-gray-500 mt-4">
                Your password will be used to encrypt and protect your media history, playlists, and privacy settings.
              </p>
            </div>

            {/* Footer */}
            <div className="bg-black/20 px-6 py-4 border-t border-gray-700 flex items-center justify-between">
              <button
                onClick={handleSkipPassword}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors text-sm"
              >
                Skip for now
              </button>
              <button
                onClick={handleSetPassword}
                disabled={isSettingPassword}
                className="px-6 py-2 bg-[var(--primary-color)] text-white rounded-lg hover:bg-[var(--primary-color)]/80 transition-colors text-sm font-medium disabled:opacity-50 flex items-center gap-2"
              >
                {isSettingPassword ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Setting...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Set Password
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export { VideoPlayer, ImageViewer };
export default EarthMultiMedia;
