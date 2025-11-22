// WebView Component for browsing websites within Reclaim
// Uses iframe for browser dev mode, will use Tauri webview in production

import { useState, useEffect, useRef } from 'react';
import { invoke } from '../lib/tauri';
import { QuickBookmarkModal, Bookmark } from './BookmarkComponents';

interface WebViewProps {
  url: string;
  tabId: number;
  profileId?: number;
  onNavigate?: (newUrl: string) => void;
  onTitleChange?: (title: string) => void;
}

export function WebView({
  url,
  tabId,
  profileId = 1,
  onNavigate,
  onTitleChange,
}: WebViewProps) {
  const [currentUrl, setCurrentUrl] = useState(url);
  const [inputUrl, setInputUrl] = useState(url);
  const [isLoading, setIsLoading] = useState(true);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [currentBookmark, setCurrentBookmark] = useState<Bookmark | null>(null);
  const [showBookmarkModal, setShowBookmarkModal] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const historyRef = useRef<string[]>([url]);
  const historyIndexRef = useRef(0);

  // Check if current URL is bookmarked
  const checkBookmarkStatus = async (urlToCheck: string) => {
    try {
      const bookmarkId = await invoke<number | null>('is_url_bookmarked', { profile_id: profileId, url: urlToCheck });
      if (bookmarkId) {
        // Get full bookmark details
        const bookmarks = await invoke<Bookmark[]>('get_all_bookmarks', { profile_id: profileId });
        const bookmark = bookmarks.find(b => b.id === bookmarkId);
        setIsBookmarked(true);
        setCurrentBookmark(bookmark || null);
      } else {
        setIsBookmarked(false);
        setCurrentBookmark(null);
      }
    } catch {
      setIsBookmarked(false);
      setCurrentBookmark(null);
    }
  };

  // Handle star button click - open modal
  const handleStarClick = () => {
    setShowBookmarkModal(true);
  };

  // Handle bookmark saved
  const handleBookmarkSaved = () => {
    checkBookmarkStatus(currentUrl);
  };

  // Handle bookmark deleted
  const handleBookmarkDeleted = () => {
    setIsBookmarked(false);
    setCurrentBookmark(null);
  };

  useEffect(() => {
    setCurrentUrl(url);
    setInputUrl(url);
    setIsLoading(true);
    setError(null);
    checkBookmarkStatus(url);
  }, [url]);

  const navigateTo = async (targetUrl: string) => {
    // Ensure URL has protocol
    let fullUrl = targetUrl;
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      // Check if it looks like a URL or a search query
      if (targetUrl.includes('.') && !targetUrl.includes(' ')) {
        fullUrl = `https://${targetUrl}`;
      } else {
        // Treat as search query - could integrate with EarthSearch
        fullUrl = `https://duckduckgo.com/?q=${encodeURIComponent(targetUrl)}`;
      }
    }

    setIsLoading(true);
    setError(null);
    setCurrentUrl(fullUrl);
    setInputUrl(fullUrl);

    // Update history
    const newHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
    newHistory.push(fullUrl);
    historyRef.current = newHistory;
    historyIndexRef.current = newHistory.length - 1;

    setCanGoBack(historyIndexRef.current > 0);
    setCanGoForward(false);

    onNavigate?.(fullUrl);

    // Try to use Tauri webview command if available
    try {
      await invoke('webview_navigate', { tabId, url: fullUrl });
    } catch {
      // Fallback to iframe (browser dev mode)
      console.log('Using iframe fallback for:', fullUrl);
    }
  };

  const goBack = () => {
    if (historyIndexRef.current > 0) {
      historyIndexRef.current--;
      const prevUrl = historyRef.current[historyIndexRef.current];
      setCurrentUrl(prevUrl);
      setInputUrl(prevUrl);
      setCanGoBack(historyIndexRef.current > 0);
      setCanGoForward(true);
      onNavigate?.(prevUrl);
    }
  };

  const goForward = () => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyIndexRef.current++;
      const nextUrl = historyRef.current[historyIndexRef.current];
      setCurrentUrl(nextUrl);
      setInputUrl(nextUrl);
      setCanGoBack(true);
      setCanGoForward(historyIndexRef.current < historyRef.current.length - 1);
      onNavigate?.(nextUrl);
    }
  };

  const reload = () => {
    setIsLoading(true);
    setError(null);
    if (iframeRef.current) {
      iframeRef.current.src = currentUrl;
    }
  };

  const handleIframeLoad = () => {
    setIsLoading(false);
    // Try to get title from iframe (same-origin only)
    try {
      const title = iframeRef.current?.contentDocument?.title;
      if (title) {
        onTitleChange?.(title);
      }
    } catch {
      // Cross-origin - can't access title
    }
  };

  const handleIframeError = () => {
    setIsLoading(false);
    setError('Unable to load this page. It may block embedding or require direct browser access.');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      navigateTo(inputUrl);
    }
  };

  // Extract domain for display
  const getDomain = (urlString: string) => {
    try {
      return new URL(urlString).hostname;
    } catch {
      return urlString;
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full bg-gray-900">
      {/* Navigation Bar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-800 border-b border-gray-700">
        {/* Navigation Buttons */}
        <button
          onClick={goBack}
          disabled={!canGoBack}
          className="p-2 rounded-lg hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Go back"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <button
          onClick={goForward}
          disabled={!canGoForward}
          className="p-2 rounded-lg hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Go forward"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        <button
          onClick={reload}
          className="p-2 rounded-lg hover:bg-gray-700 transition-colors"
          title="Reload"
        >
          <svg className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>

        {/* URL Bar */}
        <div className="flex-1 flex items-center gap-2 px-3 py-1.5 bg-gray-900 border border-gray-600 rounded-lg focus-within:border-[var(--primary-color)]">
          {/* Security indicator */}
          {currentUrl.startsWith('https://') ? (
            <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-gray-500 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
            </svg>
          )}

          <input
            type="text"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent text-sm text-white outline-none placeholder-gray-500"
            placeholder="Enter URL or search..."
          />

          {isLoading && (
            <div className="w-4 h-4 border-2 border-gray-500 border-t-white rounded-full animate-spin flex-shrink-0" />
          )}

          {/* Bookmark Star Button */}
          <button
            onClick={handleStarClick}
            className={`p-1 rounded transition-colors flex-shrink-0 ${
              isBookmarked
                ? 'text-yellow-400 hover:text-yellow-300'
                : 'text-gray-500 hover:text-yellow-400'
            }`}
            title={isBookmarked ? 'Edit bookmark' : 'Add bookmark'}
          >
            <svg
              className="w-4 h-4"
              fill={isBookmarked ? 'currentColor' : 'none'}
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
              />
            </svg>
          </button>
        </div>

        {/* Quick Bookmark Modal */}
        <QuickBookmarkModal
          profileId={profileId}
          isOpen={showBookmarkModal}
          onClose={() => setShowBookmarkModal(false)}
          url={currentUrl}
          existingBookmark={currentBookmark}
          onSave={handleBookmarkSaved}
          onDelete={handleBookmarkDeleted}
        />

      </div>

      {/* Web Content Area */}
      <div className="flex-1 min-h-0 relative bg-white">
        {error ? (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
            <div className="text-center p-8 max-w-md">
              <svg className="w-16 h-16 mx-auto text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <h3 className="text-xl font-semibold text-white mb-2">Cannot Display Page</h3>
              <p className="text-gray-400 mb-4">{error}</p>
              <div className="flex gap-2 justify-center">
                <button
                  onClick={() => window.open(currentUrl, '_blank')}
                  className="px-4 py-2 bg-[var(--primary-color)] text-white rounded-lg hover:opacity-90 transition-opacity"
                >
                  Open in Browser
                </button>
                <button
                  onClick={reload}
                  className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Loading overlay */}
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 z-10">
                <div className="text-center">
                  <div className="w-12 h-12 border-4 border-gray-600 border-t-[var(--primary-color)] rounded-full animate-spin mb-4" />
                  <p className="text-gray-400 text-sm">Loading {getDomain(currentUrl)}...</p>
                </div>
              </div>
            )}

            {/* Iframe for web content */}
            <iframe
              ref={iframeRef}
              src={currentUrl}
              className="absolute inset-0 w-full h-full border-0"
              title={`WebView - ${getDomain(currentUrl)}`}
              sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-downloads"
              onLoad={handleIframeLoad}
              onError={handleIframeError}
            />
          </>
        )}
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between px-3 py-1 bg-gray-800 border-t border-gray-700 text-xs text-gray-400">
        <span>{getDomain(currentUrl)}</span>
        <span>
          {isLoading ? 'Loading...' : 'Ready'}
        </span>
      </div>
    </div>
  );
}

export default WebView;
