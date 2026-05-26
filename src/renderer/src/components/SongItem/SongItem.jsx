import { memo, useCallback, useMemo, useRef, useState } from 'react'
import { FaPlay, FaEye } from 'react-icons/fa'
import { Bounce, toast } from 'react-toastify'
import { LuFolder, LuHeart, LuHeartOff, LuPin } from 'react-icons/lu'
import { usePlaylists } from '../../Contexts/PlaylistsContex'
import { usePlaybackProgress } from '../../Contexts/PlaybackProgressContext'
import { OverflowMenu } from '../OverflowMenu/OverflowMenu'
import { Button } from './../Button/Button'
import './SongItem.scss'
import 'react-toastify/dist/ReactToastify.css'

const ADD_TO_PLAYLIST_OPTION_ID = 'add to playlist'
const CREATE_PLAYLIST_OPTION_ID = '__create_playlist__'
const PLAYLIST_MENU_SEARCH_ID = '__playlist_search__'
const PLAYLIST_MENU_LOADING_ID = '__playlist_loading__'
const PLAYLIST_MENU_EMPTY_ID = '__playlist_empty__'
const PLAYLIST_MENU_NO_MATCHES_ID = '__playlist_no_matches__'

function normalizePlaylistName(value = '') {
  return String(value).trim().replace(/\.m3u$/i, '')
}

function normalizeSearchValue(value = '') {
  return normalizePlaylistName(value).toLocaleLowerCase()
}

function showMenuToast(type, message) {
  const notify = type === 'error' ? toast.error : toast.success

  notify(message, {
    position: 'bottom-right',
    autoClose: 3000,
    hideProgressBar: false,
    closeOnClick: true,
    pauseOnHover: true,
    draggable: true,
    progress: undefined,
    theme: 'dark',
    transition: Bounce
  })
}

function areStylesEqual(prevStyle, nextStyle) {
  if (prevStyle === nextStyle) return true
  if (!prevStyle || !nextStyle) return !prevStyle && !nextStyle

  return (
    prevStyle.top === nextStyle.top &&
    prevStyle.left === nextStyle.left &&
    prevStyle.width === nextStyle.width &&
    prevStyle.height === nextStyle.height
  )
}

const INACTIVE_PROGRESS_STYLE = { width: '0%' }

function ActiveSongProgress() {
  const { progress, duration } = usePlaybackProgress()
  const progressPercent = duration ? Math.min((progress / duration) * 100, 100) : 0

  return <div className="song-progress-fill" style={{ width: `${progressPercent}%` }} />
}

export const SongItemView = memo(function SongItemView({
  title,
  artist,
  shortViewCount,
  containerFolderName = '',
  durationText,
  insightValueLabel = '',
  showInsightValue = false,
  coverUrl,
  isActive = false,
  isPinned = false,
  isPinEnabled = false,
  isLiked = false,
  style,
  menuOptions,
  onPlay,
  onToggleLike,
  onMenuSelect,
  overflowMenuRef,
  onOpenMenu,
  itemRef,
  onPointerDown,
  onPointerUp,
  onPointerLeave,
  onPointerCancel
}) {
  return (
    <li
      ref={itemRef}
      className={isPinned ? 'songItem-container visible is-pinned' : 'songItem-container visible'}
      style={style}
      onClick={onPlay}
      onContextMenu={onOpenMenu}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerLeave}
      onPointerCancel={onPointerCancel}
    >
      <div
        className={[
          'songItem',
          isActive ? 'active' : '',
          showInsightValue ? 'songItem--insight' : ''
        ].filter(Boolean).join(' ')}
      >
        <div
          className={[
            'songItem__pinIndicator',
            isPinned ? 'is-active' : '',
            isPinEnabled ? '' : 'is-hidden'
          ].filter(Boolean).join(' ')}
        >
          {isPinEnabled ? <LuPin /> : null}
        </div>

        <div className="song-progress">
          {isActive ? <ActiveSongProgress /> : <div className="song-progress-fill" style={INACTIVE_PROGRESS_STYLE} />}
        </div>

        <div className="cover">
          <div className="ico">
            <FaPlay />
          </div>
          <img src={coverUrl} loading="lazy" alt="" />
        </div>

        <div className="songdata">
          <span className="song-tittle">{title}</span>
          <span className="song-artist">
            {artist || 'Unknow'} -{' '}
            <span className="song-views">
              <FaEye /> {shortViewCount}
            </span>
          </span>
          {containerFolderName ? (
            <span className="song-folder" title={containerFolderName}>
              <LuFolder />
              <strong>{containerFolderName}</strong>
            </span>
          ) : null}
        </div>

        {showInsightValue ? (
          <div className="songItem__insightValue">{insightValueLabel}</div>
        ) : null}

        <div className={isLiked ? 'optiones liked' : '  optiones'}>
          <Button className="btnLike" onClick={onToggleLike}>
            {isLiked ? <LuHeart /> : <LuHeartOff />}
          </Button>
        </div>

        <div className="stime">{durationText}</div>

        <OverflowMenu
          ref={overflowMenuRef}
          options={menuOptions}
          onSelect={onMenuSelect}
          showButton={false}
        />
      </div>
    </li>
  )
}, areSongItemViewPropsEqual)

function SongItemContainer({
  file,
  index,
  style,
  coverUrl,
  isActive = false,
  isPinned = false,
  isPinEnabled = false,
  isLiked = false,
  insightValueLabel = '',
  showInsightValue = false,
  menuOptions,
  onPlay,
  onToggleLike,
  onMenuSelect,
  itemRef,
  onPointerDown,
  onPointerUp,
  onPointerLeave,
  onPointerCancel
}) {
  const {
    playlists,
    playlistsLoaded,
    playlistsLoading,
    getSavedLists,
    appendTracksToPlaylist,
    resolvePlaylistSaveDirectory,
    savePlaylistFromTracks
  } = usePlaylists()
  const menuRef = useRef(null)
  const playlistSubmitLockRef = useRef(false)
  const [playlistQuery, setPlaylistQuery] = useState('')
  const [isPlaylistSubmitting, setIsPlaylistSubmitting] = useState(false)

  if (!file) {
    return <div className="songItem loading">Cargando...</div>
  }

  const normalizedPlaylistQuery = useMemo(
    () => normalizePlaylistName(playlistQuery),
    [playlistQuery]
  )
  const normalizedSearchTerm = useMemo(
    () => normalizeSearchValue(playlistQuery),
    [playlistQuery]
  )
  const filteredPlaylists = useMemo(() => {
    if (!Array.isArray(playlists)) {
      return []
    }

    if (!normalizedSearchTerm) {
      return playlists.filter((playlist) => playlist?.path)
    }

    return playlists.filter((playlist) => {
      if (!playlist?.path) {
        return false
      }

      return normalizeSearchValue(playlist.nombre).includes(normalizedSearchTerm)
    })
  }, [normalizedSearchTerm, playlists])
  const exactPlaylistMatch = useMemo(() => {
    if (!normalizedSearchTerm) {
      return null
    }

    return (
      playlists.find(
        (playlist) =>
          playlist?.path && normalizeSearchValue(playlist.nombre) === normalizedSearchTerm
      ) || null
    )
  }, [normalizedSearchTerm, playlists])

  const closeMenu = useCallback(() => {
    menuRef.current?.close?.()
  }, [])

  const handleContextMenu = useCallback((event) => {
    menuRef.current?.open?.(event)
  }, [])

  const handlePlaylistMenuOpen = useCallback(() => {
    if (!playlistsLoaded && !playlistsLoading) {
      void getSavedLists().catch((error) => {
        console.error('Error loading playlists for song menu:', error)
      })
    }
  }, [getSavedLists, playlistsLoaded, playlistsLoading])

  const handlePlaylistMenuClose = useCallback(() => {
    setPlaylistQuery('')
  }, [])

  const handleAppendToPlaylist = useCallback(
    async (playlistPath) => {
      if (!playlistPath || playlistSubmitLockRef.current) {
        return
      }

      const playlist = playlists.find((item) => item?.path === playlistPath)

      if (!playlist) {
        showMenuToast('error', 'No se encontro la playlist seleccionada.')
        return
      }

      playlistSubmitLockRef.current = true
      setIsPlaylistSubmitting(true)

      try {
        const result = await appendTracksToPlaylist(playlistPath, [file])

        if (!result?.success) {
          showMenuToast('error', result?.error || 'No se pudo agregar la cancion a la playlist.')
          return
        }

        showMenuToast(
          'success',
          `Agregada a ${playlist.nombre}${result.skippedCount ? ` - ${result.skippedCount} repetida` : ''}`
        )
        closeMenu()
      } finally {
        playlistSubmitLockRef.current = false
        setIsPlaylistSubmitting(false)
      }
    },
    [appendTracksToPlaylist, closeMenu, file, playlists]
  )

  const handleCreatePlaylist = useCallback(async () => {
    const nextPlaylistName = normalizePlaylistName(playlistQuery)

    if (!nextPlaylistName || playlistSubmitLockRef.current) {
      return
    }

    playlistSubmitLockRef.current = true
    setIsPlaylistSubmitting(true)

    try {
      const targetDirectory = await resolvePlaylistSaveDirectory(file?.filePath || '')

      if (!targetDirectory) {
        showMenuToast('error', 'No se pudo resolver una carpeta para guardar la playlist.')
        return
      }

      const result = await savePlaylistFromTracks([file], {
        nombre: nextPlaylistName,
        targetDirectory
      })

      if (!result?.success) {
        return
      }

      closeMenu()
    } finally {
      playlistSubmitLockRef.current = false
      setIsPlaylistSubmitting(false)
    }
  }, [closeMenu, file, playlistQuery, resolvePlaylistSaveDirectory, savePlaylistFromTracks])

  const handlePlaylistInputSubmit = useCallback(async () => {
    if (exactPlaylistMatch?.path) {
      await handleAppendToPlaylist(exactPlaylistMatch.path)
      return
    }

    await handleCreatePlaylist()
  }, [exactPlaylistMatch?.path, handleAppendToPlaylist, handleCreatePlaylist])

  const playlistSubmenuItems = useMemo(() => {
    const items = [
      {
        id: PLAYLIST_MENU_SEARCH_ID,
        type: 'input',
        value: playlistQuery,
        placeholder: 'Buscar o crear playlist',
        autoFocus: true,
        disabled: isPlaylistSubmitting,
        onValueChange: setPlaylistQuery,
        onSubmit: () => {
          void handlePlaylistInputSubmit()
        }
      }
    ]

    if (isPlaylistSubmitting) {
      items.push({
        id: PLAYLIST_MENU_LOADING_ID,
        label: 'Guardando...',
        disabled: true
      })
      return items
    }

    if (playlistsLoading && !playlistsLoaded && playlists.length === 0) {
      items.push({
        id: PLAYLIST_MENU_LOADING_ID,
        label: 'Cargando playlists...',
        disabled: true
      })
      return items
    }

    if (filteredPlaylists.length > 0) {
      items.push(
        ...filteredPlaylists.map((playlist) => ({
          id: playlist.path,
          label: playlist.nombre || 'Playlist sin nombre',
          closeOnSelect: false
        }))
      )
    } else if (normalizedPlaylistQuery) {
      items.push({
        id: PLAYLIST_MENU_NO_MATCHES_ID,
        label: 'Sin coincidencias',
        disabled: true
      })
    } else {
      items.push({
        id: PLAYLIST_MENU_EMPTY_ID,
        label: 'No hay playlists disponibles',
        disabled: true
      })
    }

    if (normalizedPlaylistQuery && !exactPlaylistMatch) {
      items.push({
        id: CREATE_PLAYLIST_OPTION_ID,
        label: `Crear playlist rapida "${normalizedPlaylistQuery}"`,
        tooltip: 'Esto creara una playlist rapida en la ruta de la cancion seleccionada',
        closeOnSelect: false
      })
    }

    return items
  }, [
    exactPlaylistMatch,
    filteredPlaylists,
    handlePlaylistInputSubmit,
    isPlaylistSubmitting,
    normalizedPlaylistQuery,
    playlistQuery,
    playlists.length,
    playlistsLoaded,
    playlistsLoading
  ])

  const handlePlaylistSubmenuSelect = useCallback(
    (optionId) => {
      if (optionId === CREATE_PLAYLIST_OPTION_ID) {
        void handleCreatePlaylist()
        return
      }

      if (
        optionId === PLAYLIST_MENU_EMPTY_ID ||
        optionId === PLAYLIST_MENU_LOADING_ID ||
        optionId === PLAYLIST_MENU_NO_MATCHES_ID
      ) {
        return
      }

      void handleAppendToPlaylist(optionId)
    },
    [handleAppendToPlaylist, handleCreatePlaylist]
  )

  const resolvedMenuOptions = useMemo(() => {
    if (!Array.isArray(menuOptions)) {
      return menuOptions
    }

    return menuOptions.map((option) => {
      if (option?.id !== ADD_TO_PLAYLIST_OPTION_ID) {
        return option
      }

      return {
        ...option,
        type: 'single-select',
        closeOnSelect: false,
        items: playlistSubmenuItems,
        onOpen: handlePlaylistMenuOpen,
        onClose: handlePlaylistMenuClose,
        onItemSelect: handlePlaylistSubmenuSelect
      }
    })
  }, [
    handlePlaylistMenuClose,
    handlePlaylistMenuOpen,
    handlePlaylistSubmenuSelect,
    menuOptions,
    playlistSubmenuItems
  ])

  const durationText = useMemo(
    () =>
      `${Math.floor(file.duration / 60)}:${Math.floor(file.duration % 60)
        .toString()
        .padStart(2, '0')}`,
    [file.duration]
  )
  const containerFolderName = useMemo(() => {
    const filePath = file?.filePath

    if (typeof filePath !== 'string' || !filePath.trim()) {
      return ''
    }

    const normalizedPath = filePath.replace(/\\/g, '/').replace(/\/+$/, '')
    const pathParts = normalizedPath.split('/').filter(Boolean)

    if (pathParts.length < 2) {
      return ''
    }

    return pathParts[pathParts.length - 2] || ''
  }, [file?.filePath])

  return (
    <SongItemView
      title={file.fileName}
      artist={file.artist}
      shortViewCount={file.short_view_count || 0}
      containerFolderName={containerFolderName}
      durationText={durationText}
      insightValueLabel={insightValueLabel}
      showInsightValue={showInsightValue}
      coverUrl={coverUrl}
      isActive={isActive}
      isPinned={isPinned}
      isPinEnabled={isPinEnabled}
      isLiked={isLiked}
      style={style}
      menuOptions={resolvedMenuOptions}
      onPlay={() => onPlay?.(file, index)}
      onToggleLike={(event) => onToggleLike?.(event, file, isLiked)}
      onMenuSelect={(optionId) => onMenuSelect?.(optionId, file, index)}
      overflowMenuRef={menuRef}
      onOpenMenu={handleContextMenu}
      itemRef={itemRef}
      onPointerDown={(event) => onPointerDown?.(event, file, index)}
      onPointerUp={(event) => onPointerUp?.(event, file, index)}
      onPointerLeave={(event) => onPointerLeave?.(event, file, index)}
      onPointerCancel={(event) => onPointerCancel?.(event, file, index)}
    />
  )
}

function areSongItemViewPropsEqual(prevProps, nextProps) {
  return (
    prevProps.title === nextProps.title &&
    prevProps.artist === nextProps.artist &&
    prevProps.shortViewCount === nextProps.shortViewCount &&
    prevProps.containerFolderName === nextProps.containerFolderName &&
    prevProps.durationText === nextProps.durationText &&
    prevProps.insightValueLabel === nextProps.insightValueLabel &&
    prevProps.showInsightValue === nextProps.showInsightValue &&
    prevProps.coverUrl === nextProps.coverUrl &&
    prevProps.isActive === nextProps.isActive &&
    prevProps.isPinned === nextProps.isPinned &&
    prevProps.isPinEnabled === nextProps.isPinEnabled &&
    prevProps.isLiked === nextProps.isLiked &&
    prevProps.menuOptions === nextProps.menuOptions &&
    prevProps.onPlay === nextProps.onPlay &&
    prevProps.onToggleLike === nextProps.onToggleLike &&
    prevProps.onMenuSelect === nextProps.onMenuSelect &&
    prevProps.onOpenMenu === nextProps.onOpenMenu &&
    prevProps.onPointerDown === nextProps.onPointerDown &&
    prevProps.onPointerUp === nextProps.onPointerUp &&
    prevProps.onPointerLeave === nextProps.onPointerLeave &&
    prevProps.onPointerCancel === nextProps.onPointerCancel &&
    areStylesEqual(prevProps.style, nextProps.style)
  )
}

function areSongItemContainerPropsEqual(prevProps, nextProps) {
  return (
    prevProps.file === nextProps.file &&
    prevProps.index === nextProps.index &&
    prevProps.coverUrl === nextProps.coverUrl &&
    prevProps.isActive === nextProps.isActive &&
    prevProps.isPinned === nextProps.isPinned &&
    prevProps.isPinEnabled === nextProps.isPinEnabled &&
    prevProps.isLiked === nextProps.isLiked &&
    prevProps.insightValueLabel === nextProps.insightValueLabel &&
    prevProps.showInsightValue === nextProps.showInsightValue &&
    prevProps.menuOptions === nextProps.menuOptions &&
    prevProps.onPlay === nextProps.onPlay &&
    prevProps.onToggleLike === nextProps.onToggleLike &&
    prevProps.onMenuSelect === nextProps.onMenuSelect &&
    prevProps.onPointerDown === nextProps.onPointerDown &&
    prevProps.onPointerUp === nextProps.onPointerUp &&
    prevProps.onPointerLeave === nextProps.onPointerLeave &&
    prevProps.onPointerCancel === nextProps.onPointerCancel &&
    areStylesEqual(prevProps.style, nextProps.style)
  )
}

export const SongItem = memo(SongItemContainer, areSongItemContainerPropsEqual)
