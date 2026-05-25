import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import {
  LuFolderOpen,
  LuHeart,
  LuLoaderCircle,
  LuListMusic,
  LuListPlus,
  LuPencil,
  LuPlay,
  LuTrash2
} from 'react-icons/lu'
import { Bounce, toast } from 'react-toastify'
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
  if (pathname.startsWith('/playlists/')) return 'playlist'
  if (pathname.startsWith('/favourites')) return 'likes'
  return 'directory'
}

const COLLECTION_MENU_IDS = {
  ADD_TO_QUEUE: 'add-to-queue',
  ADD_TO_NEW_PLAYLIST: 'add-to-new-playlist',
  ADD_TO_EXISTING_PLAYLIST: 'add-to-existing-playlist',
  REVEAL_IN_EXPLORER: 'reveal-in-explorer',
  DELETE: 'delete'
}
const RANKING_PLAY_PAGE_SIZE = 200

function buildCollectionMenuOptions(type) {
  const sharedOptions = [
    { id: COLLECTION_MENU_IDS.ADD_TO_QUEUE, label: 'Anadir a la cola', icon: <LuListPlus /> },
    {
      id: COLLECTION_MENU_IDS.ADD_TO_NEW_PLAYLIST,
      label: 'Anadir a playlist nueva',
      icon: <LuListMusic />
    },
    {
      id: COLLECTION_MENU_IDS.ADD_TO_EXISTING_PLAYLIST,
      label: 'Anadir a playlist existente',
      icon: <LuListPlus />
    }
  ]

  if (type === 'likes') {
    return sharedOptions
  }

  return [
    ...sharedOptions,
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



function ErrorState({ message, onRetry }) {
  return (
    <div className="collection-error">
      <strong>No se pudo cargar la coleccion.</strong>
      <p>{message}</p>
      <button type="button" onClick={onRetry}>
        Reintentar
      </button>
    </div>
  )
}

function mergeRankingPage(currentRanking, nextRanking) {
  if (!nextRanking) return currentRanking

  const currentItems = Array.isArray(currentRanking?.items) ? currentRanking.items : []
  const nextItems = Array.isArray(nextRanking?.items) ? nextRanking.items : []

  if (nextRanking.page <= (currentRanking?.page || 0)) {
    return currentRanking
  }

  return {
    ...nextRanking,
    items: [...currentItems, ...nextItems]
  }
}

function toastLoadError(message) {
  toast.error(message, {
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

function CollectionPage() {
  const outletContext = useOutletContext() || {}
  const params = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const type = getCollectionKind(location.pathname)
  const encodedSourcePath =
    type === 'playlist' ? params.dir || '' : type === 'directory' ? params.directory || '' : ''
  const sourcePath = decodeURIComponent(encodedSourcePath)
  const shouldAutoPlay = type === 'directory' && params.play === 'true'
  const shouldUseHorizontalCollectionLayout = Boolean(
    outletContext.shouldUseCollectionHorizontalMobileLayout
  )
  const shouldUseMobileCollectionLayout = Boolean(outletContext.shouldUseCollectionMobileLayout)
  const collectionCompactLayout = shouldUseHorizontalCollectionLayout
    ? 'horizontal'
    : shouldUseMobileCollectionLayout
      ? 'vertical'
      : 'default'
  const collectionPageClassName = `collection-page ${
    collectionCompactLayout === 'vertical' ? 'collection-page--movil' : ''
  } ${
    collectionCompactLayout === 'horizontal' ? 'collection-page--movil-horizontal' : ''
  }`.trim()
  const loadingActionCount = type === 'playlist' ? 4 : 3
  const loadingCollectionTitle =
    type === 'playlist' ? 'Playlist' : type === 'likes' ? 'Favourites' : 'Directory'
  const loadingSourceTypeLabel =
    type === 'playlist' ? 'Playlist' : type === 'likes' ? 'Favourites' : 'Directory'

  const { ensurePlaylistAutoCover, getCachedCollectionCoverUrl, getCollectionCoverUrl } = useImages()
  const { PlayQueue, appendManyToCurrentQueue, playQueueShuffled } = useQueue()
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
  const [rankingLoadingTab, setRankingLoadingTab] = useState('')
  const [hydratingTracks, setHydratingTracks] = useState(false)
  const [shufflingCollection, setShufflingCollection] = useState(false)
  const [playlistEditPayload, setPlaylistEditPayload] = useState(null)
  const [autoGeneratedCoverUrl, setAutoGeneratedCoverUrl] = useState('')
  const [, setGeneratingAutoCover] = useState(false)
  const autoPlayedRef = useRef('')
  const allTracksCacheRef = useRef(null)

  const loadDetail = useCallback(async () => {
    if (type !== 'likes' && !sourcePath) {
      setError('No se encontro la ruta de la coleccion.')
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')
    setPlaylistEditPayload(null)
    allTracksCacheRef.current = null
    const startTime = performance.now()

    try {
      const response = await window.electron.ipcRenderer.invoke('collection:get-overview', {
        type,
        sourcePath,
        pageSize: 50
      })

      if (!response?.success) {
        setError(response?.error || 'No se pudo cargar la coleccion.')
        setDetail(null)
        return
      }

      setDetail(response)
      console.info('[collection] overview loaded', {
        type,
        tracks: response?.summary?.trackCount || 0,
        ms: Math.round(performance.now() - startTime)
      })
    } catch (loadError) {
      console.error('Error loading collection overview:', loadError)
      setError(loadError?.message || 'No se pudo cargar la coleccion.')
      setDetail(null)
    } finally {
      setLoading(false)
    }
  }, [sourcePath, type])

  useEffect(() => {
    void loadDetail()
  }, [loadDetail])

  const loadAllTracks = useCallback(async () => {
    if (allTracksCacheRef.current) {
      return allTracksCacheRef.current
    }

    const total = Number(detail?.summary?.trackCount) || 0
    if (total === 0) {
      allTracksCacheRef.current = []
      return []
    }

    const startTime = performance.now()
    const pageSize = 200
    const hydratedTracks = []
    let page = 1
    let hasMore = true

    setHydratingTracks(true)

    try {
      while (hasMore) {
        const response = await window.electron.ipcRenderer.invoke('collection:get-tracks-page', {
          type,
          sourcePath,
          page,
          pageSize
        })

        if (response?.success === false) {
          throw new Error(response.error || 'No se pudieron cargar las canciones.')
        }

        hydratedTracks.push(...(response?.items || []))
        hasMore = Boolean(response?.hasMore)
        page += 1
      }

      allTracksCacheRef.current = hydratedTracks
      console.info('[collection] full tracks hydrated', {
        type,
        tracks: hydratedTracks.length,
        ms: Math.round(performance.now() - startTime)
      })
      return hydratedTracks
    } finally {
      setHydratingTracks(false)
    }
  }, [detail?.summary?.trackCount, sourcePath, type])

  useEffect(() => {
    if (!shouldAutoPlay || !detail?.summary?.trackCount || autoPlayedRef.current === sourcePath) {
      return
    }

    void loadAllTracks().then((tracksToPlay) => {
      if (tracksToPlay.length === 0 || autoPlayedRef.current === sourcePath) return

      PlayQueue(tracksToPlay, `folder:${sourcePath}`, 0)
      autoPlayedRef.current = sourcePath
    })
  }, [PlayQueue, detail?.summary?.trackCount, loadAllTracks, shouldAutoPlay, sourcePath])

  const summary = detail?.summary
  const tracks = allTracksCacheRef.current || []
  const meta = detail?.meta
  const hasTracks = Number(summary?.trackCount) > 0

  const heroCoverUrl = useMemo(() => {
    if (!summary?.cover) return ''

    const imageKey = sourcePath || type
    return getCollectionCoverUrl(`collection:${type}:${imageKey}`, summary.cover)
  }, [getCollectionCoverUrl, sourcePath, summary?.cover, type])
  const playlistAutoCoverKey = type === 'playlist' && sourcePath ? `playlist:auto:${sourcePath}` : ''
  const playlistAutoCoverSignature = detail?.coverConfig?.customCoverHash || ''
  const hasCustomPlaylistCover = ['suggested-collage', 'local-image', 'remote-image'].includes(
    detail?.coverConfig?.customCoverMode
  )

  useEffect(() => {
    let alive = true

    if (type !== 'playlist' || !sourcePath || hasCustomPlaylistCover || heroCoverUrl) {
      setAutoGeneratedCoverUrl('')
      setGeneratingAutoCover(false)
      return () => {
        alive = false
      }
    }

    const cachedCoverUrl = getCachedCollectionCoverUrl(
      playlistAutoCoverKey,
      playlistAutoCoverSignature || undefined
    )
    if (cachedCoverUrl) {
      setAutoGeneratedCoverUrl(cachedCoverUrl)
      setGeneratingAutoCover(false)
      return () => {
        alive = false
      }
    }

    setGeneratingAutoCover(true)
    ensurePlaylistAutoCover(sourcePath, {
      coverKey: playlistAutoCoverKey,
      signature: playlistAutoCoverSignature || playlistAutoCoverKey
    }).then((generatedCoverUrl) => {
      if (!alive) return

      setAutoGeneratedCoverUrl(generatedCoverUrl || '')
      setGeneratingAutoCover(false)
    })

    return () => {
      alive = false
    }
  }, [
    ensurePlaylistAutoCover,
    getCachedCollectionCoverUrl,
    hasCustomPlaylistCover,
    heroCoverUrl,
    playlistAutoCoverKey,
    playlistAutoCoverSignature,
    sourcePath,
    type
  ])

  const menuOptions = useMemo(() => buildCollectionMenuOptions(type), [type])

  const collectionName =
    meta?.title || (type === 'playlist' ? 'Playlist' : type === 'likes' ? 'Favourites' : 'Directory')
  const sourceTypeLabel =
    type === 'playlist' ? 'Playlist' : type === 'likes' ? 'Favourites' : 'Directory'
  const routeBack =
    type === 'playlist' ? '/playlists' : type === 'likes' ? '/favourites' : '/directories'
  const collectionSourceName =
    type === 'playlist' ? sourcePath : type === 'directory' ? `folder:${sourcePath}` : 'favourites'

  const handlePlayCollection = useCallback(async () => {
    if (!hasTracks) return

    try {
      const hydratedTracks = await loadAllTracks()

      if (type === 'playlist') {
        PlayQueue(hydratedTracks, sourcePath, 0)
        addPlaylisthistory(sourcePath)
        return
      }

      if (type === 'likes') {
        PlayQueue(hydratedTracks, 'favourites', 0)
        return
      }

      PlayQueue(hydratedTracks, `folder:${sourcePath}`, 0)
    } catch (tracksError) {
      toastLoadError(tracksError?.message || 'No se pudieron cargar las canciones.')
    }
  }, [PlayQueue, addPlaylisthistory, hasTracks, loadAllTracks, sourcePath, type])

  const handlePlayCollectionShuffled = useCallback(async () => {
    if (!hasTracks || shufflingCollection) return

    setShufflingCollection(true)

    try {
      const hydratedTracks = await loadAllTracks()

      if (hydratedTracks.length === 0) {
        return
      }

      if (type === 'playlist') {
        playQueueShuffled(hydratedTracks, sourcePath)
        addPlaylisthistory(sourcePath)
        return
      }

      if (type === 'likes') {
        playQueueShuffled(hydratedTracks, 'favourites')
        return
      }

      playQueueShuffled(hydratedTracks, `folder:${sourcePath}`)
    } catch (tracksError) {
      toastLoadError(tracksError?.message || 'No se pudieron cargar las canciones.')
    } finally {
      setShufflingCollection(false)
    }
  }, [
    addPlaylisthistory,
    hasTracks,
    loadAllTracks,
    playQueueShuffled,
    shufflingCollection,
    sourcePath,
    type
  ])

  const handleOpenEdit = useCallback(async () => {
    setIsEditVisible(true)

    if (type !== 'playlist' || playlistEditPayload) return

    const response = await window.electron.ipcRenderer.invoke(
      'collection:get-playlist-edit-payload',
      sourcePath
    )

    if (response?.success) {
      setPlaylistEditPayload(response)
      return
    }

    toastLoadError(response?.error || 'No se pudo cargar la playlist.')
  }, [playlistEditPayload, sourcePath, type])

  const handleRevealInExplorer = useCallback(async () => {
    const result = await window.electron.ipcRenderer.invoke('reveal-path-in-explorer', sourcePath)

    if (!result?.success) {
      toastLoadError(result?.error || 'No se pudo abrir el explorador.')
    }
  }, [sourcePath])

  const handleDeleteCollection = useCallback(async () => {
    if (type === 'playlist') {
      deletePlaylist(sourcePath)
    } else {
      await deleteDirectory(sourcePath)
    }

    setIsDeleteVisible(false)
    navigate(routeBack)
  }, [deleteDirectory, deletePlaylist, navigate, routeBack, sourcePath, type])

  const getHydratedTracksForAction = useCallback(async () => {
    try {
      return await loadAllTracks()
    } catch (tracksError) {
      toastLoadError(tracksError?.message || 'No se pudieron cargar las canciones.')
      return []
    }
  }, [loadAllTracks])

  const handleCollectionMenuSelect = useCallback(async (optionId) => {
    if (optionId === COLLECTION_MENU_IDS.ADD_TO_QUEUE) {
      appendManyToCurrentQueue(await getHydratedTracksForAction())
      return
    }

    if (optionId === COLLECTION_MENU_IDS.ADD_TO_NEW_PLAYLIST) {
      const result = await savePlaylistFromTracks(await getHydratedTracksForAction(), {
        nombre: `${collectionName}-copy`
      })

      if (!result?.success && result?.error !== 'Save canceled') {
        toastLoadError(result?.error || 'No se pudo crear la playlist.')
      }
      return
    }

    if (optionId === COLLECTION_MENU_IDS.ADD_TO_EXISTING_PLAYLIST) {
      await getHydratedTracksForAction()
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
    getHydratedTracksForAction,
    handleRevealInExplorer,
    savePlaylistFromTracks
  ])

  const handleLoadMoreRanking = useCallback(async (tabId) => {
    const currentRanking = detail?.rankings?.[tabId]

    if (!currentRanking?.hasMore || rankingLoadingTab) return

    setRankingLoadingTab(tabId)

    try {
      const response = await window.electron.ipcRenderer.invoke('collection:get-overview', {
        type,
        sourcePath,
        page: (currentRanking.page || 1) + 1,
        pageSize: currentRanking.pageSize || 50
      })

      if (!response?.success) {
        throw new Error(response?.error || 'No se pudo cargar el ranking.')
      }

      setDetail((currentDetail) => ({
        ...currentDetail,
        rankings: {
          ...currentDetail.rankings,
          [tabId]: mergeRankingPage(currentDetail.rankings?.[tabId], response.rankings?.[tabId])
        }
      }))
    } catch (rankingError) {
      toastLoadError(rankingError?.message || 'No se pudo cargar el ranking.')
    } finally {
      setRankingLoadingTab('')
    }
  }, [detail?.rankings, rankingLoadingTab, sourcePath, type])

  const handlePlayRanking = useCallback(async (tabId) => {
    if (!tabId) return

    try {
      const rankingTracks = []
      let page = 1
      let hasMore = true

      while (hasMore) {
        const response = await window.electron.ipcRenderer.invoke('collection:get-overview', {
          type,
          sourcePath,
          page,
          pageSize: RANKING_PLAY_PAGE_SIZE
        })

        if (!response?.success) {
          throw new Error(response?.error || 'No se pudo cargar el ranking.')
        }

        const ranking = response.rankings?.[tabId]
        const items = Array.isArray(ranking?.items) ? ranking.items : []
        rankingTracks.push(...items)
        hasMore = Boolean(ranking?.hasMore)
        page += 1
      }

      if (rankingTracks.length === 0) {
        throw new Error('Este ranking no tiene canciones para reproducir.')
      }

      playQueueShuffled(rankingTracks, `${collectionSourceName}:${tabId}`)
    } catch (rankingError) {
      toastLoadError(rankingError?.message || 'No se pudo reproducir el ranking.')
    }
  }, [collectionSourceName, playQueueShuffled, sourcePath, type])

  const handleUpdatePlaylist = useCallback(async (playlistPath, payload) => {
    const response = await updatePlaylistMetadata(playlistPath, payload)

    if (response?.success) {
      await loadDetail()
    }

    return response
  }, [loadDetail, updatePlaylistMetadata])

  if (loading) {
    return (
      <section
        className={`${collectionPageClassName} collection-page--loading`}
      >
        <CollectionInsightsPanel
          loading
          mode="collection"
          compactLayout={collectionCompactLayout}
          showAllSongsTab={false}
          loadingRows={4}
          loadingActionCount={loadingActionCount}
          loadingTitle={loadingCollectionTitle}
          loadingEyebrow={loadingSourceTypeLabel}
        />
      </section>
    )
  }

  if (error) {
    return (
      <section className={collectionPageClassName}>
        <ErrorState message={error} onRetry={() => void loadDetail()} />
      </section>
    )
  }

  if (!detail) {
    return (
      <section className={collectionPageClassName}>
        <ErrorState message="No se encontro la coleccion solicitada." onRetry={() => navigate(routeBack)} />
      </section>
    )
  }

  return (
    <section className={`${collectionPageClassName} collection-page--${type}`.trim()}>
      <CollectionInsightsPanel
          rankings={detail.rankings}
          totalTrackCount={summary?.trackCount || 0}
          sourceName={collectionSourceName}
          mode="collection"
          compactLayout={collectionCompactLayout}
          collectionCoverUrl={heroCoverUrl || autoGeneratedCoverUrl}
          collectionDisplayName={collectionName}
          sourceTypeLabel={sourceTypeLabel}
          isEmptyCollection={!hasTracks}
          emptyCollectionType={type}
          onPlayCollectionShuffled={handlePlayCollectionShuffled}
          shuffleActionDisabled={!hasTracks || hydratingTracks}
          shuffleActionLoading={shufflingCollection}
          shuffleActionLabel="Reproducir toda la coleccion en aleatorio"
          headerActions={
            <>
              <Button
                onClick={() => void handlePlayCollection()}
                disabled={!hasTracks || hydratingTracks || shufflingCollection}
              >
                {hydratingTracks && !shufflingCollection ? <LuLoaderCircle /> : <LuPlay />}
              </Button>
              {type === 'playlist' && (
                <Button onClick={() => void handleOpenEdit()}>
                  <LuPencil />
                </Button>
              )}
              <OverflowMenu options={menuOptions} onSelect={handleCollectionMenuSelect} />
            </>
          }
          showAllSongsTab={false}
          visibleRows={4}
          rankingLoadingTab={rankingLoadingTab}
          onLoadMoreRanking={handleLoadMoreRanking}
          onPlayRanking={handlePlayRanking}
        />

      <Modal isVisible={isEditVisible} closeModal={() => setIsEditVisible(false)}>
        {type === 'playlist' && (playlistEditPayload?.playlistData || detail?.playlistData) ? (
          <PlaylistForm
            playlist={playlistEditPayload?.playlistData || detail.playlistData}
            suggestedCovers={playlistEditPayload?.suggestedCovers || []}
            coverConfig={playlistEditPayload?.coverConfig || detail.coverConfig || {}}
            automaticCover={playlistEditPayload?.cover || detail.cover}
            effectiveCover={
              playlistEditPayload?.effectiveCover ||
              detail.effectiveCover ||
              detail.summary?.cover ||
              autoGeneratedCoverUrl
            }
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
              ? 'Se eliminara esta playlist de Elevate.'
              : 'Se eliminara este directorio de la biblioteca de Elevate.'
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
