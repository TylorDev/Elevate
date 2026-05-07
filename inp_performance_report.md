# Elevate — INP Performance Report

**Current INP:** 616 ms (Poor — target is < 200 ms)

---

## Chrome DevTools Trace Results

A live performance trace was captured from `http://localhost:5173/#/` using Chrome DevTools MCP.

| Metric | Value | Rating |
|--------|-------|--------|
| **LCP** | 1,553 ms | ⚠️ Needs Improvement |
| **CLS** | 0.01 | ✅ Good |
| **INP** | 616 ms | 🔴 Poor |
| **Max Critical Path** | 1,505 ms | — |

### Key Trace Findings

1. **Forced Reflow (52ms):** Caused by `updateDimensions()` in [MediaTimeDisplay.jsx:52](file:///c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/renderer/src/components/MediaTimeDisplay/MediaTimeDisplay.jsx#L65-L72) calling `canvas.getBoundingClientRect()` during React's commit phase. This blocks the main thread during paint.

2. **LCP Element:** `<h2 class='feed-title'>` — 99.2% of LCP time (1,541ms) is **render delay**, not network. This means the bottleneck is JavaScript execution / React rendering, not resource loading.

3. **Deep Network Dependency Chain (10 levels):**
   ```
   index.html → main.jsx → App.jsx → Main.jsx → AudioPlayer.jsx 
   → MediaTimeDisplay.jsx → Feed.jsx → HorizonList.jsx 
   → TrackCard.jsx → TrackCard.scss
   ```
   This waterfall means components are loaded sequentially, delaying first paint.

---

## Root Causes (Ranked by Impact)

### 🔴 Critical #1: SupeContext Mega-Provider (est. -300–400ms)

[SupeContext.jsx](file:///c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/renderer/src/Contexts/SupeContext.jsx)

**Problem:** A single context provides **49 values** (lines 508–550). The `progress` state updates ~4×/second via the `timeupdate` event (line 186). Since React context triggers re-renders in ALL consumers when ANY value changes, **every component using `useSuper()` re-renders 4 times per second**.

**Affected components (34 files consume `useSuper()`):** Header, SongItem, TrackCard, Controls, Timer, SliderVolume, Cola, DirItem, all Pages, MediaTimeDisplay, AudioPlayer, and more.

```
timeupdate → setProgress() → SuperContext.Provider value changes
→ ALL 34 consumers re-render → DOM commits → Paint delayed → INP spike
```

> [!CAUTION]
> This is the #1 cause. When a user clicks a SongItem, the interaction must wait for the entire tree to finish processing the latest `progress` re-render before the click result can paint.

---

### 🔴 Critical #2: Broken Event Listener Cleanup (compounds #1)

[SupeContext.jsx:201-208](file:///c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/renderer/src/Contexts/SupeContext.jsx#L201-L208)

**Problem:** The cleanup function creates **new anonymous arrow functions** instead of removing the original listeners:

```javascript
// ❌ This does NOT remove the original listener — it's a different function reference
mediaRef.current.removeEventListener('timeupdate', () => {})

// ✅ Must reference the same function
mediaRef.current.removeEventListener('timeupdate', updateProgress)
```

**Impact:** `updateProgress` listeners **accumulate** and are never removed. Over time, each `timeupdate` event calls `setProgress()` multiple times, multiplying the re-render cascade from #1.

---

### 🟡 High #3: MediaTimeDisplay Forced Reflow (52ms per occurrence)

[MediaTimeDisplay.jsx:65-72](file:///c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/renderer/src/components/MediaTimeDisplay/MediaTimeDisplay.jsx#L65-L72)

**Confirmed by trace:** `updateDimensions` at line 52 calls `canvas.getBoundingClientRect()` which forces a synchronous layout recalculation. The trace measured **52ms** of forced reflow directly attributed to this call.

The `ResizeObserver` callback fires during layout, and reading geometric properties inside it triggers forced synchronous layout.

---

### 🟡 High #4: SongItem — Async IPC on Every Mount

[SongItem.jsx:34-41](file:///c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/renderer/src/components/SongItem/SongItem.jsx#L34-L41)

**Problem:** Every `SongItem` calls `isLiked()` via IPC on mount. In a list of 100+ songs, this fires **100+ concurrent IPC calls** that block the main thread when their responses return and trigger 100+ `setState` calls.

---

### 🟠 Medium #5: TrackCard Not Memoized + Sync Color Extraction

[TrackCard.jsx](file:///c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/renderer/src/components/TrackCard/TrackCard.jsx)

- Not wrapped in `React.memo` → re-renders on every parent update
- `extractDominantColor()` creates a canvas and draws an image **synchronously on the main thread**
- `menuOptions` array recreated every render (not memoized)
- `useEffect` dependency on `[song]` (object reference) triggers unnecessary re-checks

---

### 🟠 Medium #6: LikeContext Re-renders All Consumers

[LikeContext.jsx:82-89](file:///c:/Users/Jimbo/Downloads/Music/xc/Elevate/src/renderer/src/Contexts/LikeContext.jsx#L82-L89)

`toggleLike` calls `getLikes()` after every toggle, which triggers a full state update on `likeState` and re-renders every consumer of `useLikes()` — including every visible `SongItem`.

---

## Recommended Fixes (Priority Order)

### Fix 1: Split SupeContext (Critical — est. -300ms INP)

Create separate contexts for high-frequency vs. low-frequency state:

```javascript
// PlaybackTimeContext — only Timer and MediaTimeDisplay subscribe
const PlaybackTimeContext = createContext()
// Provides: { progress, duration }

// PlaybackContext — song changes only
const PlaybackContext = createContext()
// Provides: { currentFile, currentIndex, isPlaying, ... }

// PlayerActionsContext — stable function references (never changes)
const PlayerActionsContext = createContext()
// Provides: { handleSongClick, togglePlayPause, ... }
```

### Fix 2: Fix Event Listener Leak (Critical — 5 min fix)

```diff
+ const updateProgressRef = useRef(null)
+ const updateDurationRef = useRef(null)

  const tryAttachListeners = () => {
+   updateProgressRef.current = () => setProgress(mediaRef.current.currentTime)
+   updateDurationRef.current = () => setDuration(mediaRef.current.duration || 0)
-   mediaRef.current.addEventListener('timeupdate', updateProgress)
+   mediaRef.current.addEventListener('timeupdate', updateProgressRef.current)
    ...
  }

  return () => {
-   mediaRef.current.removeEventListener('timeupdate', () => {})
+   mediaRef.current.removeEventListener('timeupdate', updateProgressRef.current)
  }
```

### Fix 3: Throttle `setProgress` with rAF (High — est. -100ms)

```javascript
const rafRef = useRef(null)

const updateProgress = () => {
  if (rafRef.current) cancelAnimationFrame(rafRef.current)
  rafRef.current = requestAnimationFrame(() => {
    setProgress(mediaRef.current.currentTime)
  })
}
```

### Fix 4: Debounce MediaTimeDisplay Reflow (Medium — est. -52ms)

The `ResizeObserver` callback should avoid reading layout properties synchronously:

```javascript
const updateDimensions = () => {
  // ResizeObserver entries already provide size — no need for getBoundingClientRect
  // Use entry.contentRect instead
}

const resizeObserver = new ResizeObserver((entries) => {
  const entry = entries[0]
  if (entry) {
    const pixelRatio = window.devicePixelRatio || 1
    dimensionsRef.current = {
      width: Math.max(1, Math.floor(entry.contentRect.width * pixelRatio)),
      height: Math.max(1, Math.floor(entry.contentRect.height * pixelRatio))
    }
  }
})
```

### Fix 5: Batch Like Status Checks (High — est. -50ms)

Replace per-item IPC calls with a single batch query on mount.

### Fix 6: Memoize TrackCard + Defer Color Extraction (Medium)

```javascript
export const TrackCard = memo(function TrackCard({ song, ... }) {
  const menuOptions = useMemo(() => [...], [])
  
  useEffect(() => {
    if (coverUrl && !coverUrl.includes('svg')) {
      requestIdleCallback(() => {
        extractDominantColor(coverUrl).then(setDominantColor)
      })
    }
  }, [coverUrl])
})
```

---

## Impact Estimate

| Fix | Estimated INP Reduction | Effort |
|-----|------------------------|--------|
| Split SupeContext | -300 ms | High |
| Fix listener leak | -50 ms | Low |
| Throttle `setProgress` | -100 ms | Low |
| Fix MediaTimeDisplay reflow | -52 ms | Low |
| Batch like checks | -50 ms | Medium |
| Memoize TrackCard | -30 ms | Low |
| **Total** | **~-582 ms** | |
| **Projected INP** | **~34 ms ✅** | |

> [!IMPORTANT]
> Fixes #2 and #3 alone (listener leak + throttle) are **15-minute changes** that should bring INP under 400ms. Splitting the context (#1) is the high-effort fix that gets you under 200ms.
