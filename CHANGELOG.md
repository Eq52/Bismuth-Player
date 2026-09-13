# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [9.6.0] - 2026-09-13

### ✨ New Features

- ✨ Added standalone Filter page — the homepage no longer shows category tabs and loads the full video list by default; a "筛选" button next to the search box opens a dedicated filter page with top-level / sub-category rows, an infinite-scroll grid, and filter state preserved across navigation
- ✨ Added source annotation for history & favorites — every card now shows which video source the item came from; entries keep their original annotation even after the user switches sources
- ✨ Added cross-source playback — opening an item from history/favorites fetches details and plays from the annotated source instead of the currently selected one, without switching the global source (legacy entries without a recorded source fall back to the current source)
- ✨ Added deleted-source fallback — when the annotated source no longer exists, detail/player pages show a dedicated error notice ("没了 o(TヘTo) / 对应影视源被删除 / 影视源信息-ID/名称"); orphaned entries are kept for a 30-minute grace window (marked "源已删除·即将清理") before being purged, and re-adding a source with the same ID restores them

### 🐛 Bug Fixes

- 🐛 Fixed cross-source handoff losing the annotated source — DetailPage passed the raw API detail object (without `sourceId`) to the player, so the player silently fell back to the current source; the annotated source now travels with the video item through the detail → player handoff
- 🐛 Fixed stale pending-cleanup markers — re-adding a deleted source left entries marked "源已删除" forever, and a stale timestamp would skip the 30-minute grace window on a second deletion; markers are now cleared as soon as the source is alive again
- 🐛 Fixed history/favorites identity key — entries were keyed by `vod_id` alone, so different sources sharing a numeric ID overwrote each other's records, mislit the favorite star, and let deletion remove another source's entry; identity is now `vod_id + sourceId`

### 🖥️ Desktop & Branding

- 🖥️ Desktop-shell adaptation (Bismuth Desktop) — when running inside the desktop shell the app auto-detects the built-in local CORS proxy via `/__desktop_info`, routes every source API call and video stream through it, and the CORS settings page shows a "已内置本地代理，免配置" banner — zero manual proxy setup
- 🏷️ Unified product name **Bismuth** — the page `<title>` and the desktop window title now read "Bismuth"
- 🔧 Completed project metadata — `package.json` now declares description / author / license / homepage / repository, and the desktop build embeds a full Windows version resource (product name, author, copyright)

## [9.5.1] - 2026-09-07

### 🐛 Bug Fixes

- 🐛 Fixed favicon 404 — `index.html` referenced `/vite.svg` (a Vite template leftover that does not exist in `public/`); now points to the real app icons (`icon-192x192.svg` + `apple-touch-icon`)
- 🐛 Fixed incorrect Node.js requirement — README claimed Node >= 18, but Vite 7 requires >= 20.19; corrected both READMEs and added an `engines` field to `package.json`

### ⚡ Performance

- ⚡ Added `manualChunks` code-splitting in `vite.config.ts` — the single 902 KB bundle is now split into `hls` (hls.js), `react` (runtime), and `vendor` chunks; hls.js is additionally loaded on demand via dynamic import, cutting first-payload JS from ~277 KB to ~114 KB gzip (-59%)

### 📦 CI/CD

- 🔧 Added GitHub Actions workflow (`.github/workflows/deploy-pages.yml`) — builds on every push to `main` and auto-publishes to GitHub Pages (also supports manual `workflow_dispatch`)
- ☁️ Added Cloudflare Pages one-click deploy support — `wrangler.toml` (project recognition for the "Deploy to Cloudflare" button), `public/_redirects` (SPA fallback), and `public/_headers` (security headers + immutable caching for hashed assets); all three deploy buttons (Vercel / Netlify / Cloudflare) now work out of the box

## [9.5.0] - 2026-09-06

### 🐛 Bug Fixes

- 🐛 Fixed episode list not scrollable on player page — the right-side panel had no height constraint on mobile, causing `overflow-y-auto` to never activate; added `flex-1 max-h-[45vh]` on mobile so episode grid scrolls independently when there are many episodes
- 🐛 Fixed resume playback bug — `PlayerPage` useEffect was missing `initialEpisode` in dependency array, causing episode to not update when navigating from history with a specific episode

### ✨ New Features

- ✨ Added 🔞 Ethics content filter — "屏蔽伦理片" toggle in **Video Source Settings**; when enabled, ethics categories are hidden from homepage navigation and ethics videos are filtered from all lists (matches category names containing 伦理/情色/成人/色情/18禁/三级 etc.)
- ✨ Added Favorites system — ❤️ button on video detail page to add/remove favorites; "收藏" tab in bottom navigation and desktop sidebar with full favorites management (view, play, remove individual, clear all)
- ✨ Favorites persist across sessions via localStorage (`bismuth_favorites` key)

### 📱 UI/UX

- 📱 **Navigation redesign** — History moved from bottom tab to homepage top-right icon button; bottom nav now 4 items (Home / Search / Favorites / Settings); desktop sidebar synced
- 📱 **Ethics filter relocated** — moved from Player Settings to Video Source Settings for better content-source association
- 📱 Favorite indicator (❤️ badge) on video cards in favorites list
- 📱 Global scrollbar styling — unified 6px thin scrollbar across all scrollable areas with hover highlight
- 📱 Current episode pulse animation — selected episode button in player page has a breathing purple glow effect
- 📱 Homepage top-right button changed from Settings to History (settings accessible via bottom nav)

### 🧹 Cleanup

- 🧹 Removed duplicate `Category` interface definition in `src/types/index.ts` — the legacy `{ id, name }` definition at line 92 was dead code (TypeScript interface merging combined it with the active `{ type_id, type_pid, type_name }` definition); only the Apple CMS class-field definition is retained

---

## [9.4.0] - 2026-09-06

### 🐛 Bug Fixes

- 🐛 Fixed build failure — removed 49 unused shadcn/ui zombie components (only button/input/dialog/switch are actually referenced) and restored the missing `index.html` Vite entry file that was absent from the repository
- 🐛 Fixed categories always falling back to hardcoded list — `getCategories()` requested `?ac=videolist`, but Apple CMS omits the `class` field when that parameter is present; now requests the base URL directly so categories are dynamically loaded from the API (43 categories on iqiyizyapi, 48 on jyzyapi)
- 🐛 Fixed inconsistent localStorage key naming — `video_sources` and `current_source_id` were the only keys without the `bismuth_` prefix; renamed to `bismuth_video_sources` / `bismuth_current_source_id` with automatic one-time migration of legacy data
- 🐛 Fixed pagination field type inconsistency — Apple CMS returns `page`/`pagecount`/`total` as numbers without parameters but as strings with `pg`/`limit`; `safeApiResponse()` now normalizes all pagination fields with `Number()` to prevent string-comparison bugs like `"10" < "9" === true`
- 🐛 Fixed sub-category "All" tab showing empty results — Apple CMS top-level categories (e.g. "连续剧" type_id=8) contain no direct videos (all videos live under sub-categories), so requesting `t=8` returns `total: 0`; clicking a top-level category now auto-selects its first sub-category, and the non-functional "All" sub-category button has been removed

### ✨ Improvements

- ✨ Added two-level category navigation — leverages the `type_pid` hierarchy from Apple CMS `class` field: top-level categories as tabs (first row), sub-categories as chips (second row), replacing the previous flat horizontal scroll of 40+ categories
- ✨ Added `Category` type to `ApiResponse` — the `class` field is now properly typed and passed through `safeApiResponse()`

### 🧹 Cleanup

- 🧹 Removed 49 unused shadcn/ui component files from `src/components/ui/` (accordion, alert, avatar, badge, calendar, card, carousel, chart, checkbox, collapsible, command, context-menu, drawer, dropdown-menu, field, form, hover-card, input-group, input-otp, item, kbd, label, menubar, navigation-menu, pagination, popover, progress, radio-group, resizable, scroll-area, select, separator, sheet, sidebar, skeleton, slider, sonner, spinner, table, tabs, textarea, toggle, toggle-group, tooltip, button-group, alert-dialog, empty, aspect-ratio, breadcrumb)

---

## [9.3.0] - 2026-05-10

### 🐛 Bug Fixes

- 🐛 Fixed HomePage not refreshing after adding the first video source — the mount-only `useEffect` never re-checked `localStorage`, so the empty welcome screen persisted until page reload
- 🐛 Fixed HomePage categories not updating after switching video source — same root cause: categories were loaded once on mount and never refreshed
- 🐛 Fixed SimPlayer `crossOrigin` conflict on iOS — the init `useEffect` unconditionally set `video.crossOrigin = 'anonymous'`, overriding the JSX `crossOrigin={isIOS ? undefined : 'anonymous'}` intent to skip CORS on iOS native HLS, potentially causing playback failures on CDN resources without `Access-Control-Allow-Origin`
- 🐛 Fixed API response not validated — raw `response.json()` was cast directly to `ApiResponse`, so malformed or error responses without a `list` field caused `TypeError` crashes at all consumption sites (video list spread, detail access, etc.)
- 🐛 Fixed `components.json` pointing to wrong Tailwind config file — `postcss.config.js` instead of `tailwind.config.js`, breaking `npx shadcn add` CLI commands

### 🔧 Changes

- 🔧 Updated version fallback from `9.2.0` to `9.3.0` in Settings and About pages

---

## [9.2.1] - 2026-05-10

### 🐛 Bug Fixes

- 🐛 Fixed VideoCard still referencing the removed `imageError` variable after the v9.2.0 cleanup — caused runtime crash when `imageError` was referenced in the render path
- 🐛 Fixed images continuing to load in the background after leaving the home page — replaced native `loading="lazy"` with `IntersectionObserver` so that observers can be properly disconnected on unmount
- 🐛 Fixed `img.src` being cleared on component unmount triggering "Image corrupt or truncated" console error — cleanup logic now removes event listeners before clearing `src` to prevent aborted-download error events
- 🐛 Fixed `HomePage` `hasMore` pagination referencing undefined variable `limit` — caused `ReferenceError` crash on API sources that do not return `page`/`pagecount` metadata, leading to infinite re-fetch loop

### 🧹 Cleanup

- 🧹 Removed unused `CACHE_TTL.search` from `api.ts` — search requests bypass cache entirely, making this configuration dead code

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
