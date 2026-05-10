# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### 🐛 Bug Fixes

- 🐛 Fixed VideoCard still referencing the removed `imageError` variable after the v9.2.0 cleanup — caused runtime crash when `imageError` was referenced in the render path
- 🐛 Fixed images continuing to load in the background after leaving the home page — replaced native `loading="lazy"` with `IntersectionObserver` so that observers can be properly disconnected on unmount
- 🐛 Fixed `img.src` being cleared on component unmount triggering "Image corrupt or truncated" console error — cleanup logic now removes event listeners before clearing `src` to prevent aborted-download error events

---

## [9.2.0] - 2026-05-09

### 🐛 Bug Fixes

- 🐛 Fixed `parsePlayUrls` not handling multi-source `$$$` separator — only the first source's episodes were parsed, causing missing episodes on sources with multiple playlists
- 🐛 Fixed iOS Safari HLS event listener memory leak — `stalled` and `error` handlers accumulated on every `src` change, never cleaned up on unmount
- 🐛 Fixed iOS HLS error handler race condition — CORS retry handler and iOS native error handler both fired on the same error event, causing double-reload and potential playback failure
- 🐛 Fixed `DetailPage` skeleton screen not showing when switching videos — `coverLoaded` state was never reset
- 🐛 Fixed `PlayerPage` episode not syncing with `initialEpisode` prop — navigating to play from history always started at episode 0
- 🐛 Fixed `fetchWithRetry` throwing generic "请求失败" for non-OK responses — now reports the actual HTTP status code and consumes response body to prevent connection pool exhaustion
- 🐛 Fixed version number fallback hardcoded as `8.0.0` in About and Settings pages

### ✨ Improvements

- ✨ Added volume slider to SimPlayer — hover over the volume icon to reveal a draggable volume control (previously volume could only be adjusted via keyboard)
- ✨ Improved pagination accuracy — `hasMore` now uses API `page/pagecount` metadata when available, falling back to list length check (prevents premature scroll stop on sources with custom page sizes)
- 🧹 Removed unused `_viewKey` state from `App.tsx` — was written 7+ times per navigation but never read, causing unnecessary full-tree re-renders
- 🧹 Removed unused `imageError` state from `VideoCard` — original image URL is now preserved for retry after transient network failures (note: one stale reference was missed and fixed in a subsequent commit)
- ⚡ Optimized `PlayerPage` — `getPlayerSettings()` no longer reads localStorage on every render, cached in state instead
- ⚡ Optimized `SimPlayer.handleScreenshot` — no longer recreates ~4 times per second due to `currentTime` dependency, reads directly from video element
- 🔧 Added `loadVideos` to useEffect dependency array in `HomePage` (exhaustive-deps compliance)
- 🔧 Cleaned up `resumePromptTimerRef` on unmount to prevent unintended progress deletion
- 🔧 Clamped negative time differences in `HistoryPage.formatTime` for robustness

### 🏗️ Repository

- 📁 Added `.gitignore` — build artifacts (`dist/`, `Demo/`, `assets/`, root `index.html`, `icon-*.png/svg`) are now excluded from version control
- 🧹 Removed legacy build artifacts from repository tracking (`Demo/`, `assets/`, root `index.html`, `icon-*.png`, `icon-*.svg`)

---

## [9.1.0] - 2026-04-16

### 🐛 Bug Fixes

- 🐛 Fixed settings page crash — `ArrowLeft` icon missing from import caused "ArrowLeft is not defined" runtime error
- 🐛 Fixed critical CORS proxy double-wrapping bug — `buildUrl()` was called both in callers and inside `fetchWithRetry()`, causing proxy URLs to be nested inside themselves and all API requests to fail when CORS proxy was enabled
- 🐛 Fixed Toast notifications invisible — `SimPlayer` dispatched toast messages but no `<Toaster>` renderer existed in the app; created a lightweight Toaster component using the existing `use-toast` hook
- 🐛 Fixed auto-resume setting not working — the "Auto Resume" toggle saved its value but `SimPlayer` never read it, always showing the resume prompt regardless
- 🧹 Removed dead `carousel.tsx` import dependencies (embla-carousel) that were never used by any page component

---

## [9.0.0] - 2026-04-16

> **Note:** No separate Git tag was created for v9.0.0. The changes below are included within the v9.1 tag range (`v8.2..v9.1`).

### ✨ New Features

- 🏗️ **Settings page redesigned** — each setting category (Video Sources, Player, CORS Proxy, Cache, About) now has its own dedicated page with full-screen navigation
- ✨ Added proxy priority reordering — drag proxies up/down with arrow buttons to adjust priority order
- ✨ Enhanced cache settings page — now displays detailed cache policy breakdown (TTL for each request type)
- ✨ Settings home page now shows live summaries (active proxy count, cache item count, version info)
- 🎨 Consistent page header design across all settings sub-pages with color-coded icons
- 🎨 Added explanatory help text on every settings page for better user guidance

### 🔧 Changes

- 🔧 Unified storage key naming convention (`bismuth_` prefix across all keys)
- 🔧 Improved API layer — `fetchWithRetry` now uses proper URL variable tracking instead of fragile string reverse-parsing

---

## [8.3.0] - 2026-04-16

> **Note:** No separate Git tag was created for v8.3.0. The changes below are included within the v9.1 tag range (`v8.2..v9.1`). The original CHANGELOG entry listed the date as 2026-04-15, but no commits exist on that date — the actual changes were committed on 2026-04-16 alongside the v9.0/v9.1 release batch.

### 🐛 Bug Fixes

- 🐛 Fixed iOS Safari HLS playback stuttering — switched from bare `video.src` to optimized native HLS with `preload="auto"`, removed unnecessary `crossOrigin="anonymous"` on iOS, added error recovery and buffer stall recovery logic
- 🐛 Fixed CORS preflight overhead on iOS causing slow buffering

---

## [8.2.0] - 2026-04-14

### 🐛 Bug Fixes

- 🐛 Fixed fullscreen button not responding on iOS Safari (added `webkitEnterFullscreen` fallback)
- 🐛 Fixed fullscreen state detection on Safari (added `webkitfullscreenchange` event listener)

### ✨ Improvements

- ✨ Fullscreen now uses webkit-prefixed APIs as fallback for Safari/iOS compatibility

---

## [8.1.0] - 2026-04-10

### 🐛 Bug Fixes

- 🐛 Fixed progress bar not responding to clicks and drags (hot zone z-index conflict blocked pointer events)

### ✨ New Features

- ✨ Version number now dynamically read from `package.json` instead of being hardcoded
- ✨ Added "Check for Updates" feature in Settings → About, using GitHub Releases API

---

## [8.0.0] - 2026-04-09

### ✨ New Features

- ✨ Integrated SimPlayer as built-in player (supports MP4/WebM/HLS)
- ✨ Built-in player features: screenshot, picture-in-picture, playback speed, progress memory, keyboard shortcuts
- ✨ Auto-hide player controls — move mouse to reveal, idle to hide (YouTube-style)
- ✨ CORS proxy toggle — optionally disable CORS proxy for direct API requests
- ✨ "Continue" button in history jumps directly to the player page

### 💄 Design

- 💄 Desktop player and episode list in left-right layout, episode panel scrollable
- 💄 Responsive player control bar with compact buttons for mobile
- 💄 Transparent progress bar hover zone

### 🐛 Bug Fixes

- 🐛 Fixed invisible player on mobile in all modes
- 🐛 Fixed PiP button not showing on some environments (multi-detection fallback)

---

## [7.0.0] - 2026-02-27

### ✨ New Features

- ✨ Added splash screen animation
- ✨ Added page transition animations
- ✨ Added image loading animations
- ✨ Added elegant SVG placeholder images
- ✨ Added skeleton screen loading effects

### 🐛 Bug Fixes

- 🐛 Removed PWA functionality for simplified deployment

### 💄 Design

- 💄 Optimized loading state display
- 💄 Optimized desktop sidebar
