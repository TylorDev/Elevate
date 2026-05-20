import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  LuFolderOpen,
  LuHeart,
  LuListMusic,
  LuListPlus,
  LuPencil,
  LuPlay,
  LuRefreshCw,
  LuTrash2
} from 'react-icons/lu'
import { Bounce, toast } from 'react-toastify'
import { formatDuration, formatTimestamp } from '../../../timeUtils'
import { useLikes } from '../../Contexts/LikeContext'
import { useImages } from '../../Contexts/ImagesContext'
import { useQueue } from '../../Contexts/QueueContext'
import { usePlaylists } from '../../Contexts/PlaylistsContex'
import { useMini } from '../../Contexts/MiniContext'
import { Button } from '../../components/Button/Button'
import { CollectionInsightsPanel } from '../../components/CollectionInsights/CollectionInsightsPanel'
import ConfirmActionModal from '../../components/ConfirmActionModal/ConfirmActionModal'
import { CollectionAddToPlaylistModal } from '../../components/CollectionAddToPlaylistModal/CollectionAddToPlaylistModal'
import Modal from '../../components/Modal/Modal'
import { OverflowMenu } from '../../components/OverflowMenu/OverflowMenu'
import PlaylistForm from '../../components/PlaylistForm/PlaylistForm'
import './CollectionPage.scss'

function getCollectionKind(pathname = '') {
  if (pathname.startsWith('/playlists/')) {
    return 'playlist'
  }

  if (pathname.startsWith('/favourites')) {
    return 'likes'
  }

  return 'directory'
}

const COLLECTION_MENU_IDS = {
  ADD_TO_QUEUE: 'add-to-queue',
  ADD_TO_NEW_PLAYLIST: 'add-to-new-playlist',
  ADD_TO_EXISTING_PLAYLIST: 'add-to-existing-playlist',
  REVEAL_IN_EXPLORER: 'reveal-in-explorer',
  DELETE: 'delete'
}

function buildCollectionMenuOptions(type) {
  if (type === 'likes') {
    return [
      { id: COLLECTION_MENU_IDS.ADD_TO_QUEUE, label: 'AÃ±adir a la Cola', icon: <LuListPlus /> },
      {
        id: COLLECTION_MENU_IDS.ADD_TO_NEW_PLAYLIST,
        label: 'AÃ±adir a Playlist Nueva',
        icon: <LuListMusic />
      },
      {
        id: COLLECTION_MENU_IDS.ADD_TO_EXISTING_PLAYLIST,
        label: 'AÃ±adir a Playlist Existente',
        icon: <LuListPlus />
      }
    ]
  }

  return [
    { id: COLLECTION_MENU_IDS.ADD_TO_QUEUE, label: 'AÃ±adir a la Cola', icon: <LuListPlus /> },
    {
      id: COLLECTION_MENU_IDS.ADD_TO_NEW_PLAYLIST,
      label: 'AÃ±adir a Playlist Nueva',
      icon: <LuListMusic />
    },
    {
      id: COLLECTION_MENU_IDS.ADD_TO_EXISTING_PLAYLIST,
      label: 'AÃ±adir a Playlist Existente',
      icon: <LuListPlus />
    },
    {
      id: COLLECTION_MENU_IDS.REVEAL_IN_EXPLORER,
      label: 'Mostrar en el explorador',
      icon: <LuFolderOpen />
    },
    {
      id: COLLECTION_MENU_IDS.DELETE,
      label: type === 'playlist' ? 'Eliminar playlist' : 'Eliminar directorio',
      icon: <LuTrash2 />
    }
  ]
}

function EmptyCollectionState({ type }) {
  const title =
    type === 'playlist'
      ? 'Playlist vacÃ­a'
      : type === 'likes'
        ? 'No hay canciones con like'
        : 'Directorio sin canciones'

  return (
    <div className="collection-empty">
      <h2>{title}</h2>
      <p>Esta colecciÃ³n no tiene canciones disponibles para mostrarse todavÃ­a.</p>
    </div>
  )
}

function ErrorState({ message, onRetry }) {
  return (
    <div className="collection-error">
      <strong>No se pudo cargar la colecciÃ³n.</strong>
      <p>{message}</p>
      <button type="button" onClick={onRetry}>
        Reintentar
      </button>
    </div>
  )
}

function normalizeLikesDetail(likesPayload) {
  const tracks = Array.isArray(likesPayload?.fileInfos) ? likesPayload.fileInfos : []
  const sumMetric = (key) =>
    tracks.reduce((total, track) => total + (Number(track?.[key]) || 0), 0)

  return {
    success: true,
    type: 'likes',
    meta: {
      title: 'Favourites'
    },
    tracks,
    summary: {
      totalDuration: Number(likesPayload?.totalDuration) || 0,
      trackCount: tracks.length,
      cover: likesPayload?.cover || null,
      totalShortViews: sumMetric('short_view_count'),
      totalLongViews: sumMetric('long_view_count'),
      totalAccumulatedDuration: sumMetric('active_listening_seconds'),
      totalRepeats: sumMetric('consecutive_repeat_count'),
      totalSkips: sumMetric('skip_count')
    }
  }
}

function CollectionPage() {
  const params = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const type = getCollectionKind(location.pathname)
  const encodedSourcePath =
    type === 'playlist' ? params.dir || '' : type === 'directory' ? params.directory || '' : ''
  const sourcePath = decodeURIComponent(encodedSourcePath)
  const shouldAutoPlay = type === 'directory' && params.play === 'true'

  const { getCollectionCoverUrl } = useImages()
  const { handleQueueAndPlay, PlayQueue, appendManyToCurrentQueue } = useQueue()
  const { getLikes, likes } = useLikes()
  const {
    addPlaylisthistory,
    deletePlaylist,
    updatePlaylistMetadata,
    savePlaylistFromTracks
  } = usePlaylists()
  const { deleteDirectory } = useMini()

  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isEditVisible, setIsEditVisible] = useState(false)
  const [isAddToPlaylistVisible, setIsAddToPlaylistVisible] = useState(false)
  const [isDeleteVisible, setIsDeleteVisible] = useState(false)
  const autoPlayedRef = useRef('')
  const likesHydratedRef = useRef(false)

  const loadDetail = useCallback(async () => {
    if (type !== 'likes' && !sourcePath) {
      setError('No se encontrÃ³ la ruta de la colecciÃ³n.')
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')

    try {
      if (type === 'likes') {
        const likesPayload = await getLikes()
        likesHydratedRef.current = true
        setDetail(normalizeLikesDetail(likesPayload))
        return
      }

      const channel = type === 'playlist' ? 'get-playlist-detail' : 'get-directory-detail'
      const response = await window.electron.ipcRenderer.invoke(channel, sourcePath)

      if (!response?.success) {
        setError(response?.error || 'No se pudo cargar la colecciÃ³n.')
        setDetail(null)
        return
      }

      setDetail(response)
    } catch (loadError) {
      console.error('Error loading collection detail:', loadError)
      setError(loadError?.message || 'No se pudo cargar la colecciÃ³n.')
      setDetail(null)
    } finally {
      setLoading(false)
    }
  }, [getLikes, sourcePath, type])

  useEffect(() => {
    if (type === 'likes') {
      return
    }

    void loadDetail()
  }, [loadDetail, type])

  useEffect(() => {
    if (type !== 'likes') {
      likesHydratedRef.current = false
      return
    }

    const hasLikesPayload =
      Array.isArray(likes?.fileInfos) ||
      likes?.totalDuration !== undefined ||
      likes?.cover !== undefined

    if (hasLikesPayload) {
      likesHydratedRef.current = true
      setDetail(normalizeLikesDetail(likes))
      setError('')
      setLoading(false)
      return
    }

    if (likesHydratedRef.current) {
      setDetail(normalizeLikesDetail(likes))
      setError('')
      setLoading(false)
      return
    }

    let isCancelled = false

    setLoading(true)
    setError('')

    void getLikes()
      .then((likesPayload) => {
        if (isCancelled) {
          return
        }

        likesHydratedRef.current = true
        setDetail(normalizeLikesDetail(likesPayload))
        setError('')
      })
      .catch((loadError) => {
        if (isCancelled) {
          return
        }

        console.error('Error loading likes detail:', loadError)
        setError(loadError?.message || 'No se pudo cargar la colecciÃƒÂ³n.')
        setDetail(null)
      })
      .finally(() => {
        if (!isCancelled) {
          setLoading(false)
        }
      })

    return () => {
      isCancelled = true
    }
  }, [getLikes, likes, type])

  useEffect(() => {
    if (!shouldAutoPlay || !detail?.tracks?.length || autoPlayedRef.current === sourcePath) {
      return
    }

    PlayQueue(detail.tracks, `folder:${sourcePath}`, 0)
    autoPlayedRef.current = sourcePath
  }, [PlayQueue, detail?.tracks, shouldAutoPlay, sourcePath])

  const summary = detail?.summary
  const tracks = detail?.tracks || []
  const meta = detail?.meta

  const heroCoverUrl = useMemo(() => {
    if (!summary?.cover) {
      return ''
    }

    const imageKey = sourcePath || type
    return getCollectionCoverUrl(`collection:${type}:${imageKey}`, summary.cover)
  }, [getCollectionCoverUrl, sourcePath, summary?.cover, type])

  const menuOptions = useMemo(() => buildCollectionMenuOptions(type), [type])

  const collectionName =
    meta?.title || (type === 'playlist' ? 'Playlist' : type === 'likes' ? 'Favourites' : 'Directory')
  const routeBack =
    type === 'playlist' ? '/playlists' : type === 'likes' ? '/favourites' : '/directories'
  const collectionSourceName =
    type === 'playlist' ? sourcePath : type === 'directory' ? `folder:${sourcePath}` : 'favourites'
  const showSourcePath = Boolean(summary?.sourcePath && type !== 'likes')

  const handlePlayCollection = useCallback(async () => {
    if (tracks.length === 0) {
      return
    }

    if (type === 'playlist') {
      await handleQueueAndPlay(undefined, 0, sourcePath, false)
      addPlaylisthistory(sourcePath)
      return
    }

    if (type === 'likes') {
      PlayQueue(tracks, 'favourites', 0)
      return
    }

    PlayQueue(tracks, `folder:${sourcePath}`, 0)
  }, [PlayQueue, addPlaylisthistory, handleQueueAndPlay, sourcePath, tracks, type])

  const handleRevealInExplorer = useCallback(async () => {
    const result = await window.electron.ipcRenderer.invoke('reveal-path-in-explorer', sourcePath)

    if (!result?.success) {
      toast.error(result?.error || 'No se pudo abrir el explorador.', {
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
  }, [sourcePath])

  const handleDeleteCollection = useCallback(async () => {
    if (type === 'playlist') {
      await deletePlaylist(sourcePath)
    } else {
      await deleteDirectory(sourcePath)
    }

    setIsDeleteVisible(false)
    navigate(routeBack)
  }, [deleteDirectory, deletePlaylist, navigate, routeBack, sourcePath, type])

  const handleCollectionMenuSelect = useCallback(async (optionId) => {
    if (optionId === COLLECTION_MENU_IDS.ADD_TO_QUEUE) {
      appendManyToCurrentQueue(tracks)
      return
    }

    if (optionId === COLLECTION_MENU_IDS.ADD_TO_NEW_PLAYLIST) {
      const result = await savePlaylistFromTracks(tracks, {
        nombre: `${collectionName}-copy`
      })

      if (!result?.success && result?.error !== 'Save canceled') {
        toast.error(result?.error || 'No se pudo crear la playlist.', {
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
      return
    }

    if (optionId === COLLECTION_MENU_IDS.ADD_TO_EXISTING_PLAYLIST) {
      setIsAddToPlaylistVisible(true)
      return
    }

    if (optionId === COLLECTION_MENU_IDS.REVEAL_IN_EXPLORER) {
      await handleRevealInExplorer()
      return
    }

    if (optionId === COLLECTION_MENU_IDS.DELETE) {
      setIsDeleteVisible(true)
    }
  }, [
    appendManyToCurrentQueue,
    collectionName,
    handleRevealInExplorer,
    savePlaylistFromTracks,
    tracks
  ])

  const handleUpdatePlaylist = useCallback(async (playlistPath, payload) => {
    const response = await updatePlaylistMetadata(playlistPath, payload)

    if (response?.success) {
      await loadDetail()
    }

    return response
  }, [loadDetail, updatePlaylistMetadata])

  if (loading) {
    return (
      <section className="collection-page collection-page--loading">
        <div className="collection-loading">
          <LuRefreshCw />
          Cargando colecciÃ³n...
        </div>
      </section>
    )
  }

  if (error) {
    return (
      <section className="collection-page">
        <ErrorState message={error} onRetry={() => void loadDetail()} />
      </section>
    )
  }

  if (!detail) {
    return (
      <section className="collection-page">
        <ErrorState message="No se encontrÃ³ la colecciÃ³n solicitada." onRetry={() => navigate(routeBack)} />
      </section>
    )
  }

  return (
    <section className={`collection-page collection-page--${type}`}>
      <header className="collection-hero">
        <div className="collection-hero__media">
          {heroCoverUrl ? (
            <img src={heroCoverUrl} alt={collectionName} />
          ) : (
            <div className="collection-hero__placeholder">
              {type === 'playlist' ? <LuListMusic /> : type === 'likes' ? <LuHeart /> : <LuFolderOpen />}
            </div>
          )}
        </div>

        <div className="collection-hero__body">
          <span className="collection-hero__eyebrow">
            {type === 'playlist'
              ? 'Playlist profile'
              : type === 'likes'
                ? 'System collection'
                : 'Directory profile'}
          </span>
          <h1>{collectionName}</h1>
          {showSourcePath && (
            <p className="collection-hero__path" title={summary?.sourcePath}>
              {summary?.sourcePath}
            </p>
          )}

          <div className="collection-hero__meta">
            <span>{summary?.trackCount || 0} tracks</span>
            <span>{formatDuration(summary?.totalDuration || 0)}</span>
            {meta?.createdAt && <span>{formatTimestamp(meta.createdAt)}</span>}
          </div>

          <div className="collection-hero__actions">
            <Button onClick={() => void handlePlayCollection()} disabled={tracks.length === 0}>
              <LuPlay />
            </Button>
            {type === 'playlist' && (
              <Button onClick={() => setIsEditVisible(true)}>
                <LuPencil />
              </Button>
            )}
            <OverflowMenu options={menuOptions} onSelect={handleCollectionMenuSelect} />
          </div>
        </div>
      </header>

      {tracks.length === 0 ? (
        <section className="collection-tracklist">
          <div className="collection-tracklist__header">
            <div>
              <span>Track manifest</span>
              <h2>Todas las canciones</h2>
            </div>
            <strong>{tracks.length}</strong>
          </div>
          <EmptyCollectionState type={type} />
        </section>
      ) : (
        <CollectionInsightsPanel
          tracks={tracks}
          sourceName={collectionSourceName}
          mode="collection"
          showAllSongsTab={false}
        />
      )}

      <Modal isVisible={isEditVisible} closeModal={() => setIsEditVisible(false)}>
        {type === 'playlist' && detail?.playlistData ? (
          <PlaylistForm
            playlist={detail.playlistData}
            suggestedCovers={detail.suggestedCovers || []}
            coverConfig={detail.coverConfig || {}}
            automaticCover={detail.cover}
            effectiveCover={detail.effectiveCover || detail.summary?.cover}
            onUpdate={handleUpdatePlaylist}
            close={() => setIsEditVisible(false)}
          />
        ) : null}
      </Modal>

      <CollectionAddToPlaylistModal
        isVisible={isAddToPlaylistVisible}
        onClose={() => setIsAddToPlaylistVisible(false)}
        tracks={tracks}
        currentCollectionPath={type === 'playlist' ? sourcePath : ''}
        sourceName={collectionSourceName}
      />

      {type !== 'likes' && (
        <ConfirmActionModal
          isVisible={isDeleteVisible}
          title={type === 'playlist' ? 'Eliminar playlist?' : 'Eliminar directorio?'}
          message={
            type === 'playlist'
              ? 'Se eliminarÃ¡ esta playlist de Elevate.'
              : 'Se eliminarÃ¡ este directorio de la biblioteca de Elevate.'
          }
          confirmLabel={type === 'playlist' ? 'Eliminar playlist' : 'Eliminar directorio'}
          onCancel={() => setIsDeleteVisible(false)}
          onConfirm={() => {
            void handleDeleteCollection()
          }}
        />
      )}
    </section>
  )
}

export default CollectionPage
