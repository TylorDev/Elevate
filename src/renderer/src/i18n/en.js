const en = {
  common: {
    cancel: 'Cancel',
    confirm: 'Confirm',
    delete: 'Delete',
    details: 'Details',
    loading: 'Loading...',
    next: 'Next',
    previous: 'Previous',
    save: 'Save',
    saving: 'Saving...',
    up: 'Up',
    unknown: 'Unknown'
  },
  actions: {
    addLater: 'Add later',
    addToPlaylist: 'Add to playlist',
    addToQueue: 'Add to queue',
    closeWindow: 'Close window',
    deleteDirectory: 'Delete directory',
    deletePlaylist: 'Delete playlist',
    disableAlwaysOnTop: 'Disable always on top',
    editPlaylist: 'Edit playlist',
    enableAlwaysOnTop: 'Enable always on top',
    exportAsM3u: 'Export as M3U',
    hideHeader: 'Hide header',
    hideQueuePanel: 'Hide queue panel',
    markFavorite: 'Mark as favorite',
    maximizeWindow: 'Maximize window',
    minimizeWindow: 'Minimize window',
    openFolder: 'Open folder',
    openGlobalSearch: 'Open global search',
    remove: 'Remove',
    removeFavorite: 'Remove favorite',
    removeFromList: 'Remove from {{name}}',
    removeLink: 'Remove link',
    restoreWindow: 'Restore window',
    saveAsPlaylist: 'Save as playlist',
    showHeader: 'Show header',
    showInExplorer: 'Show in explorer',
    showQueuePanel: 'Show queue panel'
  },
  navigation: {
    compactMain: 'Compact main navigation',
    developerLinks: 'Developer links',
    developerSocials: 'Developer social links',
    feed: 'Feed',
    settings: 'Settings',
    statistics: 'Statistics',
    windowControls: 'Window controls',
    windowAreas: 'Areas',
    windowAreaPicker: 'Window area picker'
  },
  statusBar: {
    searchPlaceholder: 'Search songs, playlists, directories...'
  },
  search: {
    addDirectory: 'Add a directory',
    artist: 'Artist',
    changeBackground: 'Change background',
    configuration: 'Configuration',
    directory: 'Directory',
    directories: 'Directories',
    filters: 'Search filters',
    noResults: 'Try another search or enable more filters to broaden results.',
    name: 'Name',
    openColorSettings: 'Open color settings',
    openLibrarySettings: 'Open library settings',
    openVisualSettings: 'Open visual settings',
    playlist: 'Playlist',
    playlists: 'Playlists',
    primaryColor: 'Primary color',
    quickAccess: 'Quick access',
    songs: 'Songs',
    placeholder: 'Search songs, playlists, directories, or quick actions...'
  },
  queue: {
    allSongsUnavailable: 'No songs are available to play.',
    directoryEmpty: 'The random directory has no available songs.',
    directoryUnavailable: 'No directories are available to play.',
    directoryRandomError: 'Could not play a random directory.',
    playlistEmpty: 'The random playlist has no available songs.',
    playlistUnavailable: 'No playlists are available to play.',
    removed: 'Removed successfully!',
    songAdded: 'Added: {{name}}'
  },
  playlists: {
    addedToPlaylist: 'Added to {{name}}{{suffix}}',
    createQuickPlaylist: 'Create quick playlist "{{name}}"',
    createQuickPlaylistTooltip: 'This will create a quick playlist in the selected song folder',
    empty: 'No playlists available',
    exportEmpty: 'There are no songs to export.',
    exported: 'Playlist exported: {{name}}',
    imported: 'Playlist imported: {{name}}',
    invalidPath: 'Invalid playlist path.',
    loadingEditor: 'Loading editor...',
    loadingPlaylists: 'Loading playlists...',
    noMatches: 'No matches',
    notFound: 'The selected playlist was not found.',
    playlistRequiredTracks: 'A playlist must have at least one song.',
    saveDirectoryError: 'Could not resolve a folder to save the playlist.',
    saveFailed: 'Could not save the playlist.',
    saved: 'Playlist created: {{name}}',
    searchOrCreate: 'Search or create playlist',
    selectSaveFolder: 'No folder selected.',
    unnamed: 'Untitled playlist'
  },
  directories: {
    openFailed: 'Could not open the folder.',
    removed: 'Directory removed!'
  },
  music: {
    currentList: 'the current list'
  },
  settings: {
    importPlaylist: 'Import Playlist'
  },
  modals: {
    addToPlaylist: {
      title: 'Add to playlist',
      readyCount: '{{count}} songs ready to add',
      empty: 'No playlists are available to reuse.',
      adding: 'Adding songs...',
      addFailed: 'Could not add the songs.',
      added: 'Added {{count}} songs to {{name}}{{suffix}}'
    },
    playlistSave: {
      absolutePathPlaceholder: 'Paste an absolute path',
      browserLabel: 'Playlist browser',
      emptyDirectory: 'No folders or .m3u files in this location.',
      invalidControlCharacter: 'The playlist name contains invalid characters.',
      invalidName: 'Enter a valid playlist name.',
      invalidTrailingCharacter: 'The playlist name cannot end with a dot or space.',
      navigationPathRequired: 'Enter a path to navigate.',
      noFolderToOpen: 'There is no valid folder to open.',
      openExplorerFailed: 'Could not open the playlist explorer.',
      openFolderFailed: 'Could not open this folder.',
      reservedName: 'The playlist name is reserved by the system.',
      saveTitle: 'Save playlist',
      selectedFolderRequired: 'No folder selected.',
      folderAddress: 'Folder address'
    }
  },
  errors: {
    folderInvalid: 'Invalid folder path.',
    folderMissing: 'The selected folder does not exist.',
    notDirectory: 'The selected path is not a directory.',
    playlistNotFound: 'Playlist not found',
    songsLoadFailed: 'Could not load songs.'
  },
  toasts: {
    completed: 'Completed!',
    recentsLoaded: 'Recents loaded!'
  }
}

export default en
