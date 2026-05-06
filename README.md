# Elevate Music Player

## Overview

Elevate is a modern, cross-platform music player built with cutting-edge web technologies. Combining the power of Electron with the flexibility of React and the reliability of SQLite, Elevate delivers a native-like experience while maintaining the customization and extensibility of web applications.

## Built with modern technology:

- 🖥️ Electron for desktop integration
- ⚛️ React for dynamic UI
- 🚀 Vite for optimal performance
- 💾 SQLite & Prisma for data management
- 📦 Node.js for robust backend operations

## Core Features

### Intelligent Playback Management

- **Universal Song Resumption**
  - Resume playback from any source including "Listen Later," liked songs, custom playlists, and specific directories
  - Seamless continuation from your last listening session
  - Smart queue management across different playback sources

### Comprehensive Library Organization

- **Flexible Collection Management**

  - Add individual songs or entire directories to your library
  - Automatic library scanning and organization
  - Support for various music file formats
  - Quick search functionality across your entire collection

- **Smart Playlists**
  - Create and manage custom playlists
  - Import existing playlists from other sources
  - "Listen Later" queue for future playback
  - Favorites system with like/unlike functionality

### Advanced List Management

- **Playlist Operations**

  - Create, rename, and delete playlists
  - Import/export playlist functionality
  - Add or remove songs from any list
  - Automatic playlist backup and synchronization

- **Queue Management**
  - Custom queue creation and modification
  - Dynamic queue updates during playback
  - Shuffle functionality with smart playlist handling

### User Experience

- **Intuitive Controls**

  - Standard playback controls (play, pause, skip)
  - Volume muting
  - Progress tracking and seeking
  - Shuffle and repeat modes

- **Modern Interface**
  - Clean and responsive design
  - Dark theme support

## Technical Specifications

### Architecture

- **Frontend**: React application bundled with Vite for optimal performance
- **Backend**: Node.js running within Electron
- **Database**: SQLite with Prisma ORM for reliable data persistence
- **Desktop Integration**: Electron for native system integration

### Data Management

- Efficient music metadata handling
- Automatic library synchronization
- Playlist version control
- Fast search indexing

### Performance

- Optimized audio processing
- Minimal memory footprint
- Quick startup time
- Smooth playlist handling even with large libraries

## System Requirements

- Windows 10/11, macOS 10.13+, or Linux
- 4GB RAM minimum
- 1GB available storage for application
- Additional storage space for music library

## Future Development

Elevate is actively maintained and regularly updated with new features and improvements.

## Support

- Regular updates and bug fixes

## Project Setup

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

### Install

```bash
$ npm install
```

### Development

```bash
$ npm run dev
```

### Chrome DevTools MCP with Codex

To inspect the real Electron renderer with `chrome-devtools-mcp`, this project enables
Chromium remote debugging in development only.

1. Start the app:

```bash
$ npm run dev
```

2. Verify the DevTools endpoint is available:

```text
http://127.0.0.1:9222/json/version
http://127.0.0.1:9222/json/list
```

3. Add the MCP server to Codex using the project config in `.codex/config.toml`, or
register it manually:

```toml
[mcp_servers.chrome-devtools]
command = "cmd"
args = ["/c", "npx", "-y", "chrome-devtools-mcp@latest", "--browser-url=http://127.0.0.1:9222"]
env = { SystemRoot = "C:\\Windows", PROGRAMFILES = "C:\\Program Files" }
startup_timeout_ms = 20000
```

The MCP target is the Electron renderer window, not the Electron main process. To avoid
port conflicts, change `ELECTRON_REMOTE_DEBUGGING_PORT` in `.env` and update the MCP
server URL to match.

### Build

```bash
# For windows
$ npm run build:win

# For macOS
$ npm run build:mac

# For Linux
$ npm run build:linux
```
