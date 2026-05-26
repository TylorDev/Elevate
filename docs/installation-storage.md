# Elevate installation storage

This document defines where Elevate stores data in development and in packaged Windows installs.

## Runtime policy

- Release builds use the installed app model only.
- Mutable user data must live under `app.getPath('userData')`.
- The executable directory and `resources` are treated as app-owned locations, not writable data storage.
- Portable storage is not part of production. If `ELEVATE_PORTABLE_DATA_DIR` is used for debugging, it must be paired with `ELEVATE_ENABLE_PORTABLE_MODE=1` and is considered a debug-only override.

## Windows release layout

| Purpose | Location |
| --- | --- |
| Installed executable | `%LOCALAPPDATA%\Programs\Elevate\` |
| Packaged resources | `%LOCALAPPDATA%\Programs\Elevate\resources\` |
| App ASAR | `%LOCALAPPDATA%\Programs\Elevate\resources\app.asar` |
| Template DB | `%LOCALAPPDATA%\Programs\Elevate\resources\prisma\template.db` |
| User data root | `%APPDATA%\Elevate\` |
| SQLite DB | `%APPDATA%\Elevate\elevate.db` |
| SQLite WAL/SHM | `%APPDATA%\Elevate\elevate.db-wal`, `%APPDATA%\Elevate\elevate.db-shm` |
| Cover cache | `%APPDATA%\Elevate\covers\` |
| Feed cache | `%APPDATA%\Elevate\feed-cache-v1\` |
| Background images | `%APPDATA%\Elevate\background-images\` |
| Window state | `%APPDATA%\Elevate\window-state.json` |
| Optional signal file | `%APPDATA%\Elevate\signal.txt` |
| Updater cache | `%LOCALAPPDATA%\elevate-updater\` |

## Development layout

| Purpose | Location |
| --- | --- |
| Development DB | `<repo>/prisma/dev.db` |
| Template DB | `<repo>/prisma/template.db` |
| Cover cache | `<repo>/covers/` |
| User-data-backed settings/cache | `app.getPath('userData')` for the current Electron app profile |

## First launch expectations

On first packaged launch, Elevate should:

1. Resolve `userData`.
2. Copy `resources/prisma/template.db` to `userData/elevate.db` if the DB does not exist yet.
3. Create additional cache directories only when the related feature is used.
4. Avoid creating mutable files under the installation directory.

## Reset guidance

To reset the packaged app to a fresh state, remove the contents of `app.getPath('userData')` for Elevate. Deleting the installation directory alone is not enough to clear user data.

## Diagnostics

The main process exposes `app:get-storage-paths`, and preload exposes `window.electron.appDiagnostics.getStoragePaths()`, to inspect the effective runtime paths and basic file status for support and QA.
