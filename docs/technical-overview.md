# Elevate Technical Overview

This document preserves the detailed architecture, behavior, IPC, performance, and contribution notes that previously lived in the main README. For installation and user-facing setup, start with the [main README](../README.md).

---

**Elevate** is a desktop music player for local libraries, built around fast navigation, persistent playback, reactive visualizations, playlists, directories, listening history, statistics, and memory-conscious cover handling.

This repository is intended for developers who want to understand, maintain, and contribute to the Elevate codebase.

---

## Overview

Elevate focuses on a smooth local music experience where playback should remain reliable even when secondary features fail. The app combines an Electron-based desktop shell, a React renderer, IPC-driven backend contracts, Butterchurn visualizations, virtualized lists, and optimized image caching.

Core product areas include:

* Local audio playback with persistent queue behavior.
* Immersive music view with cover mode and Butterchurn visualizer mode.
* Playlist and directory navigation.
* Library statistics and collection rankings.
* Per-song listening history.
* Lazy-loaded covers with LRU caching and object URL cleanup.
* Picture-in-Picture playback controls.
* Large-list performance through virtualization.

---

## Main Features

### Local Music Playback

Elevate provides a global audio player that exposes:

* Play / pause.
* Previous / next track.
* Shuffle and repeat.
* Volume and mute controls.
* Queue panel visibility.
* Like / unlike actions.
* Picture-in-Picture mode.
* Navigation to the immersive music screen.

Playback should remain stable even if covers, rankings, history, or other secondary data fail to load.

---

### Immersive Music View

The music screen provides an interactive playback experience with:

* Current song cover.
* Cover-as-background mode.
* Butterchurn visualizer mode.
* Preset navigation.
* Preset shuffle.
* Favorite presets.
* Preset cycle duration controls.
* Context menu actions.
* Keyboard shortcuts.
* Picture-in-Picture rendering.

Important shortcuts include:

| Key          | Action                      |
| ------------ | --------------------------- |
| `Tab`        | Toggle cover / visualizer   |
| `T`          | Toggle step mode            |
| `F1`         | Toggle favorite preset      |
| `ArrowRight` | Next preset                 |
| `ArrowLeft`  | Previous preset             |
| `ArrowDown`  | Pause / resume preset cycle |
| `ArrowUp`    | Toggle shuffle              |

Shortcuts must not trigger while the user is typing inside inputs or textareas.

---

### Audio Visualizer

The visualizer is powered by Butterchurn and rendered through a canvas component.

Expected behavior:

* Initialize only when the audio element, canvas, and dimensions are valid.
* Reuse the global audio context and source node.
* Cache presets at module level.
* Resize through `ResizeObserver` without recreating the visualizer.
* Start `requestAnimationFrame` only while audio is playing.
* Stop rendering when playback is paused or the component unmounts.
* Disconnect visualizer audio resources on teardown.
* Keep playback functional if visualizer initialization fails.

---

### Queue Sources

The queue panel provides several source tabs:

* Current queue.
* Playlists.
* Directories.
* Liked songs.
* Full library.

The panel should only instantiate the active tab to avoid unnecessary data loading.

Accessibility requirements:

* Use `role="tablist"`.
* Use `role="tab"`.
* Use `role="tabpanel"`.
* Provide useful labels through `title`, `aria-selected`, `aria-controls`, and `aria-labelledby`.

---

### Playlists

Playlist behavior is designed around lazy loading and large-list performance.

Expected behavior:

* Load lightweight playlist metadata only when the playlist tab becomes active.
* Deduplicate active playlist requests.
* Keep local tab state independent from global playlist context.
* Sync external updates through playlist timestamps.
* Hide playlists immediately while deletion is pending.
* Support M3U import.
* Virtualize playlist lists.
* Load playlist contents only when selected.
* Support random playlist playback.
* Prevent duplicate random playlist requests.

---

### Directories

Directory browsing supports imported music folders and grouped navigation.

Expected behavior:

* Load directories only when the directory tab becomes active.
* Group directories by parent folder.
* Sort groups and directories alphabetically.
* Show an empty state with an import action.
* Support random directory playback.
* Validate directory paths and tracks before playback.
* Use hierarchical back navigation:

  * Directory → group → root.
* Virtualize large directory lists.

---

### Statistics

The statistics screen shows global library telemetry.

Supported insights include:

* Short views.
* Long views.
* Total listening duration.
* Active listening duration.
* Repeats.
* Skips.
* Ranking pages.
* Full-library shuffled playback.

Rankings must load incrementally and playback actions should include the full ranking, not only the visible page.

---

### Feed

The feed displays ranked collections across different scopes:

* Mixed.
* Playlists.
* Directories.

Expected behavior:

* Cache overview data by scope.
* Handle refreshing states.
* Listen for collection ranking updates.
* Support manual refresh.
* Virtualize active ranking lists.
* Adapt layout for default, vertical, and horizontal views.
* Open playlists and directories through their corresponding routes.

---

### Collection Insights

`CollectionInsightsPanel` is the reusable insights view used by both collection pages and library-level screens.

It supports:

* Collection mode.
* Library mode.
* Precomputed rankings.
* Rankings built from tracks.
* Optional `All Songs` tab.
* Metric cards.
* Active board view.
* Cover-aware backgrounds.
* Virtualized song rendering.
* Infinite loading.
* Play collection and play ranking actions.

---

### History

Elevate tracks listening history and supports paginated browsing.

Expected behavior:

* Load history page by page.
* Deduplicate entries by `filePath`.
* Avoid duplicate page requests.
* Support manual refresh.
* Group history by time.
* Open per-song history detail instead of playing the full list when a history item is selected.

---

### Per-Song History

The song history detail screen displays:

* Hero cover.
* Title and artist.
* Total records.
* Date added to library.
* Last played date.
* Peak day.
* Daily chart.
* Timeline of library and playback events.

Invalid dates, empty data, and IPC errors should degrade gracefully.

---

### Cover and Image Cache

Covers are centralized through `ImagesContext`.

Expected behavior:

* Provide a `DEFAULT_COVER`.
* Support song cover variants:

  * `thumb`, limited to 300 entries.
  * `full`, limited to 20 entries.
* Support collection cover cache, limited to 150 entries.
* Use LRU-style cache updates.
* Deduplicate pending cover requests.
* Convert valid buffer data into object URLs.
* Accept valid data URLs, blob URLs, and HTTP(S) URLs.
* Fall back to `DEFAULT_COVER` on invalid data or errors.
* Revoke object URLs when:

  * Cache entries are pruned.
  * Entries are replaced.
  * Individual images are revoked.
  * Cache is cleared.
  * The provider unmounts.

No object URLs should remain alive after the image provider is destroyed.

---

## Tech Stack

Elevate currently assumes the following architecture and dependencies:

* Electron.
* React.
* React Router.
* Electron IPC.
* Butterchurn.
* Butterchurn presets.
* `react-window`.
* A Prisma-backed backend or equivalent existing data layer.
* Renderer-side contexts for audio, queue, images, playlists, and related state.

---

## Project Structure

Important areas of the codebase include:

```txt
src/
  renderer/
    src/
      components/
        AudioPlayer/
        CollectionInsights/
        QueueTabsPanel/
        Render/
        SongItem/
      Contexts/
        ImagesContext.jsx
      Pages/
        Feed/
        History/
        Music/
        Statistics/
```

Key files:

```txt
src/renderer/src/components/Render/Render.jsx
src/renderer/src/Pages/Music/Music.jsx
src/renderer/src/components/QueueTabsPanel/QueueTabsPanel.jsx
src/renderer/src/components/QueueTabsPanel/Playlists/PlaylistsQueueTab.jsx
src/renderer/src/components/QueueTabsPanel/Directories/DirectoriesQueueTab.jsx
src/renderer/src/components/AudioPlayer/AudioPlayer.jsx
src/renderer/src/Pages/Statistics/Statistics.jsx
src/renderer/src/Pages/Feed/Feed.jsx
src/renderer/src/components/CollectionInsights/CollectionInsightsPanel.jsx
src/renderer/src/Pages/History/History.jsx
src/renderer/src/components/SongItem/SongItem.jsx
src/renderer/src/Pages/History/HistorySong.jsx
src/renderer/src/Contexts/ImagesContext.jsx
```

---

## IPC Contracts

Contributors should preserve existing IPC contracts unless a migration is explicitly planned.

### Visual and Covers

```txt
get-audio-cover-thumbnail(filePath)
get-audio-cover-full(filePath)
feed:get-collection-cover({ coverKey, coverSignature })
playlist:ensure-cover({ playlistPath, variant })
playlist:get-cover({ playlistPath, coverHash, variant })
```

### Library

```txt
get-playlists-minimal()
get-random-playlist()
get-list(playlistPath)
get-all-directories()
get-audio-in-directory(directoryPath)
get-directories-number()
get-random-directory()
```

### Telemetry

```txt
statistics:get-overview({ pageSize })
statistics:get-ranking-page({ tabId, page, pageSize })
feed:get-collection-rankings({ scope, tabId?, page, pageSize })
feed:refresh-collection-rankings({ scope })
feed:collection-rankings-updated({ scope })
```

### History

```txt
get-history({ page, pageSize })
history:get-song-timeline({ filePath })
```

---

## Data Models

### Track

Minimum fields expected by the UI:

```ts
type Track = {
  filePath: string;
  fileName?: string;
  title?: string;
  artist?: string;
  duration?: number;
  short_view_count?: number;
  long_view_count?: number;
  active_listening_seconds?: number;
  consecutive_repeat_count?: number;
  skip_count?: number;
  lastPlayedAt?: string | Date;
  liked?: boolean;
};
```

### Collection

Minimum fields expected by feed and insights:

```ts
type Collection = {
  type: string;
  path: string;
  name: string;
  coverKey?: string;
  coverSignature?: string;
  recentActivityAt?: string | Date;
  totalShortViews?: number;
  totalLongViews?: number;
  totalDuration?: number;
  totalAccumulatedDuration?: number;
  totalRepeats?: number;
  totalSkips?: number;
  rankings?: Record<string, unknown>;
};
```

### Paginated Ranking

```ts
type PaginatedRanking<T = unknown> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalValue: number;
  hasMore: boolean;
};
```

---

## Performance Guidelines

Performance is a core requirement for Elevate.

When contributing, make sure that:

* The visualizer does not render at 60 FPS while audio is paused.
* Resizing the visualizer does not recreate the Butterchurn instance.
* Queue tabs load data only when active.
* Large lists use virtualization.
* Visible covers are preloaded only for visible rows and overscan.
* Cover thumbnails are used in lists and rankings.
* Full covers are reserved for detail views.
* Object URLs are revoked when no longer needed.
* IPC listeners are cleaned up on unmount.
* Duplicate requests are deduplicated when possible.
* Failed secondary data loads do not break playback.

Suggested limits:

| Cache             | Limit |
| ----------------- | ----: |
| Song thumbnails   |   300 |
| Full song covers  |    20 |
| Collection covers |   150 |

---

## Accessibility Guidelines

Contributions should preserve or improve accessibility.

Use:

* Semantic tabs.
* Proper ARIA attributes.
* `aria-busy` for loading states where appropriate.
* `aria-label` or `title` for icon-only buttons.
* Empty `alt=""` for decorative covers.
* Useful alt text for primary covers.
* Grouped controls for Picture-in-Picture actions.

---

## Error Handling Principles

Elevate should degrade gracefully.

A contributor should ensure that:

* Cover failures do not block playback.
* Ranking failures do not unmount the player or queue.
* Empty playlists and directories show controlled errors.
* Random playback validates source and tracks before playing.
* Pagination does not duplicate results.
* IPC listener cleanup happens reliably.
* Loading, empty, error, and incremental loading states are handled explicitly.

---

## Testing Strategy

### Unit Tests

Recommended areas:

* Duration formatters.
* Metric formatters.
* Date formatters.
* Collection ranking builders.
* Collection summary builders.
* Insight aggregate helpers.
* Insight value label helpers.
* Image cache behavior:

  * Hit.
  * Miss.
  * Deduplication.
  * Pruning.
  * Object URL revocation.
  * Cache clearing.

### Renderer Integration Tests

Recommended flows:

* Queue tab switching.
* Lazy playlist loading.
* Lazy directory loading.
* Statistics pagination.
* Feed pagination.
* History pagination.
* Play ranking actions.
* Play full library shuffled.
* Random playlist playback.
* Random directory playback.

### Manual / E2E Tests

Before merging major UI or playback changes, verify:

* Play a song and open the music screen.
* Toggle cover and visualizer.
* Enter and exit Picture-in-Picture.
* Open song history from the music cover.
* Open song history from the history page.
* Create a playlist from a song context menu.
* Add a song to an existing playlist.
* Navigate rankings with a large library.
* Confirm virtualized scrolling remains smooth.

### Performance Checks

Verify that:

* Cover caches stay within their defined limits.
* `Cola` preloads only visible rows plus overscan.
* The visualizer render loop stops when paused.
* Resizing the visualizer does not create a new Butterchurn instance.

---

## Contribution Guidelines

### Before You Start

Before opening a pull request:

1. Understand the area you are modifying.
2. Check whether the change affects IPC contracts.
3. Check whether the change affects playback reliability.
4. Check whether the change affects large-list performance.
5. Check whether the change affects cover caching or object URL lifecycle.

### Development Rules

Please follow these rules:

* Do not rewrite architecture unless the issue explicitly requires it.
* Do not rename public routes casually.
* Do not rename IPC channels without a migration plan.
* Keep playback resilient.
* Prefer lazy loading for expensive data.
* Prefer virtualization for large lists.
* Keep components focused and memoized where needed.
* Avoid global state changes when local tab state is enough.
* Clean up IPC listeners, animation frames, object URLs, and observers.
* Keep UI errors recoverable.

### Pull Request Checklist

Before submitting a PR, confirm:

* [ ] Playback still works after the change.
* [ ] The queue still works after the change.
* [ ] No secondary failure blocks audio playback.
* [ ] Large lists remain virtualized.
* [ ] Loading states are handled.
* [ ] Empty states are handled.
* [ ] Error states are handled.
* [ ] IPC listeners are cleaned up.
* [ ] Animation frames are cleaned up.
* [ ] Object URLs are revoked when appropriate.
* [ ] Accessibility labels were preserved or improved.
* [ ] Relevant tests or manual validation were completed.

---

## Recommended Commit Style

Use clear, scoped commit messages:

```txt
feat(music): add visualizer preset controls
fix(images): revoke object urls when pruning cache
perf(queue): avoid loading inactive tabs
refactor(feed): cache rankings by scope
test(history): cover paginated history dedupe
```

---

## Roadmap Notes

Current non-goals:

* Complete architecture rewrite.
* Public route changes.
* IPC channel renaming.
* Full bilingual UI copy normalization.

These areas should only be addressed through dedicated future iterations.

---

## Maintainer Notes

Elevate should feel fast, local, and reliable. When deciding between a feature and playback stability, prioritize playback stability.

A good contribution should make the app easier to use, easier to maintain, or more reliable without making large libraries, covers, visualizer rendering, or IPC communication heavier than necessary.
