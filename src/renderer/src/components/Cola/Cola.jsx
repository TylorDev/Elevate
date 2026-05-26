import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FixedSizeList, VariableSizeList } from 'react-window'
import { RiFocus3Line } from 'react-icons/ri'
import { FaListUl, FaPlusCircle, FaRegSave, FaTrash } from 'react-icons/fa'
import { LuClock3 } from 'react-icons/lu'
import { useLikes } from '../../Contexts/LikeContext'
import { useI18n } from '../../Contexts/I18nContext'
import { useImages } from '../../Contexts/ImagesContext'
import { useMini } from '../../Contexts/MiniContext'
import { usePlaylists } from '../../Contexts/PlaylistsContex'
import { useQueue } from '../../Contexts/QueueContext'
import { DEFAULT_COVER } from '../../Contexts/ImagesContext'
import PlaylistSaveModal from '../PlaylistSaveModal/PlaylistSaveModal'
import { SongItem } from '../SongItem/SongItem'
import {
  DEFAULT_SONG_ITEM_HEIGHT,
  useSongItemRowHeight
} from '../SongItem/songItemLayout'
import './Cola.scss'
import './VirtualizedCola.scss'

const DEFAULT_ROW_HEIGHT = DEFAULT_SONG_ITEM_HEIGHT
const DEFAULT_DATE_HEADER_HEIGHT = 54
const DEFAULT_HOUR_HEADER_HEIGHT = 38
const DEFAULT_VIRTUALIZATION_THRESHOLD = 25
const DEFAULT_OVERSCAN_COUNT = 8
const DEFAULT_MIN_HEIGHT = 320
const DEFAULT_VIEWPORT_OFFSET = 190
const LOAD_MORE_THRESHOLD = 12
const NON_VIRTUALIZED_COVER_LIMIT = 40
const LONG_PRESS_DELAY_MS = 2000
const POINTER_CANCEL_DISTANCE = 12

function getDefaultHeight() {
  return Math.max(window.innerHeight - DEFAULT_VIEWPORT_OFFSET, DEFAULT_MIN_HEIGHT)
}

function resolveListHeight(height) {
  if (typeof height === 'number' && Number.isFinite(height)) {
    return height
  }

  if (typeof height === 'string' && height.trim().endsWith('px')) {
    const parsedHeight = Number.parseInt(height, 10)

    if (Number.isFinite(parsedHeight)) {
      return parsedHeight
    }
  }

  return getDefaultHeight()
}

function shouldFillParentHeight(height) {
  return typeof height === 'string' && height.trim() === '100%'
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

function getLikeValue(likesLookup, file) {
  if (!file?.filePath) {
    return false
  }

  if (likesLookup.has(file.filePath)) {
    return true
  }

  return Boolean(file.liked)
}

function areArraysEqual(first = [], second = []) {
  if (first === second) {
    return true
  }

  if (first.length !== second.length) {
    return false
  }

  return first.every((value, index) => value === second[index])
}

function dedupeSongsByFilePath(list = []) {
  if (!Array.isArray(list) || list.length === 0) {
    return []
  }

  const seenFilePaths = new Set()

  return list.filter((file) => {
    if (!file?.filePath) {
      return true
    }

    if (seenFilePaths.has(file.filePath)) {
      return false
    }

    seenFilePaths.add(file.filePath)
    return true
  })
}

function resolveManualOrder(list, persistedOrder) {
  if (!Array.isArray(list) || list.length === 0) {
    return { orderedList: [], normalizedOrder: [] }
  }

  if (!Array.isArray(persistedOrder) || persistedOrder.length === 0) {
    const fallbackOrder = list.map((file) => file.filePath).filter(Boolean)
    return {
      orderedList: list,
      normalizedOrder: fallbackOrder
    }
  }

  const fileByPath = new Map()
  const unseenFiles = []

  for (const file of list) {
    if (!file?.filePath) {
      unseenFiles.push(file)
      continue
    }

    fileByPath.set(file.filePath, file)
  }

  const orderedList = []
  const normalizedOrder = []

  for (const filePath of persistedOrder) {
    const file = fileByPath.get(filePath)

    if (file) {
      orderedList.push(file)
      normalizedOrder.push(filePath)
      fileByPath.delete(filePath)
    }
  }

  for (const file of list) {
    if (!file?.filePath) {
      continue
    }

    if (fileByPath.has(file.filePath)) {
      orderedList.push(file)
      normalizedOrder.push(file.filePath)
      fileByPath.delete(file.filePath)
    }
  }

  if (unseenFiles.length > 0) {
    orderedList.push(...unseenFiles)
  }

  return { orderedList, normalizedOrder }
}

function moveItemBelowTarget(list, sourceIndex, targetIndex) {
  if (!Array.isArray(list) || sourceIndex < 0 || targetIndex < 0) {
    return list
  }

  if (sourceIndex === targetIndex) {
    return list
  }

  const nextList = [...list]
  const [movedItem] = nextList.splice(sourceIndex, 1)

  if (!movedItem) {
    return list
  }

  let insertionIndex = targetIndex + 1

  if (sourceIndex < targetIndex) {
    insertionIndex -= 1
  }

  nextList.splice(insertionIndex, 0, movedItem)
  return nextList
}

function clearTimer(timerRef) {
  if (timerRef.current) {
    window.clearTimeout(timerRef.current)
    timerRef.current = null
  }
}

function getDateKey(value) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'unknown'
  }

  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

function getHourKey(value) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'unknown'
  }

  return `${date.getHours()}`
}

function formatDateHeader(value) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Fecha desconocida'
  }

  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)

  if (getDateKey(date) === getDateKey(today)) {
    return 'Hoy'
  }

  if (getDateKey(date) === getDateKey(yesterday)) {
    return 'Ayer'
  }

  return new Intl.DateTimeFormat(navigator.language, {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(date)
}

function formatHourHeader(value) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Hora desconocida'
  }

  return `${date.getHours().toString().padStart(2, '0')}:00`
}

function buildTimeGroupedRows(list = []) {
  const rows = []
  let currentDateKey = ''
  let currentHourKey = ''

  list.forEach((file, songIndex) => {
    const lastPlayedAt = file?.lastPlayedAt
    const dateKey = getDateKey(lastPlayedAt)
    const hourKey = `${dateKey}-${getHourKey(lastPlayedAt)}`

    if (dateKey !== currentDateKey) {
      currentDateKey = dateKey
      currentHourKey = ''
      rows.push({
        id: `date-${dateKey}`,
        type: 'date-header',
        label: formatDateHeader(lastPlayedAt)
      })
    }

    if (hourKey !== currentHourKey) {
      currentHourKey = hourKey
      rows.push({
        id: `hour-${hourKey}`,
        type: 'hour-header',
        label: formatHourHeader(lastPlayedAt)
      })
    }

    rows.push({
      id: `song-${file?.filePath || songIndex}`,
      type: 'song',
      file,
      songIndex
    })
  })

  return rows
}

const VirtualSongRow = memo(function VirtualSongRow({ index, style, data }) {
  const file = data.songs[index]

  if (!file) {
    return (
      <div style={style} className="VirtualizedCola__loader">
        Loading more tracks...
      </div>
    )
  }

  const isActive = data.activeFilePath === file.filePath

  return (
    <SongItem
      style={style}
      file={file}
      index={index}
      coverUrl={data.coverUrls[file.filePath] || DEFAULT_COVER}
      isActive={isActive}
      isPinned={data.pinnedSongPath === file.filePath}
      isPinEnabled={data.enablePinMove}
      isLiked={getLikeValue(data.likesLookup, file)}
      showInsightValue={data.insightMode}
      insightValueLabel={data.insightValueResolver?.(file) || ''}
      menuOptions={data.menuOptions}
      onPlay={data.onPlay}
      onToggleLike={data.onToggleLike}
      onMenuSelect={data.onMenuSelect}
      onPointerDown={data.onSongPointerDown}
      onPointerUp={data.onSongPointerUp}
      onPointerLeave={data.onSongPointerLeave}
      onPointerCancel={data.onSongPointerCancel}
    />
  )
}, areVirtualRowsEqual)

const TimeGroupedSongRow = memo(function TimeGroupedSongRow({ index, style, data }) {
  const row = data.groupedRows[index]

  if (!row) {
    return (
      <div style={style} className="VirtualizedCola__loader">
        Loading more tracks...
      </div>
    )
  }

  if (row.type === 'date-header') {
    return (
      <div style={style} className="VirtualizedCola__dateHeader">
        <span>{row.label}</span>
      </div>
    )
  }

  if (row.type === 'hour-header') {
    return (
      <div style={style} className="VirtualizedCola__hourHeader">
        <span>{row.label}</span>
      </div>
    )
  }

  const file = row.file
  const isActive = data.activeFilePath === file?.filePath

  return (
    <SongItem
      style={style}
      file={file}
      index={row.songIndex}
      coverUrl={data.coverUrls[file.filePath] || DEFAULT_COVER}
      isActive={isActive}
      isPinned={data.pinnedSongPath === file.filePath}
      isPinEnabled={data.enablePinMove}
      isLiked={getLikeValue(data.likesLookup, file)}
      showInsightValue={data.insightMode}
      insightValueLabel={data.insightValueResolver?.(file) || ''}
      menuOptions={data.menuOptions}
      onPlay={data.onPlay}
      onToggleLike={data.onToggleLike}
      onMenuSelect={data.onMenuSelect}
      onPointerDown={data.onSongPointerDown}
      onPointerUp={data.onSongPointerUp}
      onPointerLeave={data.onSongPointerLeave}
      onPointerCancel={data.onSongPointerCancel}
    />
  )
}, areTimeGroupedRowsEqual)

function areTimeGroupedRowsEqual(prevProps, nextProps) {
  if (prevProps.index !== nextProps.index || !areStylesEqual(prevProps.style, nextProps.style)) {
    return false
  }

  const prevRow = prevProps.data.groupedRows[prevProps.index]
  const nextRow = nextProps.data.groupedRows[nextProps.index]

  if (prevRow !== nextRow) {
    return false
  }

  if (!nextRow || nextRow.type !== 'song') {
    return true
  }

  const filePath = nextRow.file?.filePath

  return (
    prevProps.data.activeFilePath === nextProps.data.activeFilePath &&
    prevProps.data.coverUrls[filePath] === nextProps.data.coverUrls[filePath] &&
    getLikeValue(prevProps.data.likesLookup, prevRow.file) ===
      getLikeValue(nextProps.data.likesLookup, nextRow.file) &&
    prevProps.data.menuOptions === nextProps.data.menuOptions &&
    prevProps.data.onPlay === nextProps.data.onPlay &&
    prevProps.data.onToggleLike === nextProps.data.onToggleLike &&
    prevProps.data.onMenuSelect === nextProps.data.onMenuSelect &&
    prevProps.data.onSongPointerDown === nextProps.data.onSongPointerDown &&
    prevProps.data.onSongPointerUp === nextProps.data.onSongPointerUp &&
    prevProps.data.onSongPointerLeave === nextProps.data.onSongPointerLeave &&
    prevProps.data.onSongPointerCancel === nextProps.data.onSongPointerCancel &&
    prevProps.data.enablePinMove === nextProps.data.enablePinMove &&
    prevProps.data.pinnedSongPath === nextProps.data.pinnedSongPath
  )
}

function areVirtualRowsEqual(prevProps, nextProps) {
  if (prevProps.index !== nextProps.index || !areStylesEqual(prevProps.style, nextProps.style)) {
    return false
  }

  const prevFile = prevProps.data.songs[prevProps.index]
  const nextFile = nextProps.data.songs[nextProps.index]

  if (prevFile !== nextFile) {
    return false
  }

  if (!nextFile) {
    return true
  }

  const filePath = nextFile.filePath
  const wasActive = prevProps.data.activeFilePath === filePath
  const isActive = nextProps.data.activeFilePath === filePath
  const wasPinned = prevProps.data.pinnedSongPath === filePath
  const isPinned = nextProps.data.pinnedSongPath === filePath

  if (wasActive !== isActive || wasPinned !== isPinned) {
    return false
  }

  return (
    prevProps.data.coverUrls[filePath] === nextProps.data.coverUrls[filePath] &&
    getLikeValue(prevProps.data.likesLookup, prevFile) === getLikeValue(nextProps.data.likesLookup, nextFile) &&
    (prevProps.data.insightValueResolver?.(prevFile) || '') ===
    (nextProps.data.insightValueResolver?.(nextFile) || '') &&
    prevProps.data.menuOptions === nextProps.data.menuOptions &&
    prevProps.data.onPlay === nextProps.data.onPlay &&
    prevProps.data.onToggleLike === nextProps.data.onToggleLike &&
    prevProps.data.onMenuSelect === nextProps.data.onMenuSelect &&
    prevProps.data.onSongPointerDown === nextProps.data.onSongPointerDown &&
    prevProps.data.onSongPointerUp === nextProps.data.onSongPointerUp &&
    prevProps.data.onSongPointerLeave === nextProps.data.onSongPointerLeave &&
    prevProps.data.onSongPointerCancel === nextProps.data.onSongPointerCancel &&
    prevProps.data.enablePinMove === nextProps.data.enablePinMove
  )
}

export function Cola({
  list = [],
  name = 'tracks',
  actions,
  preserveOrder = false,
  onPlayOverride,
  playbackMode = 'list',
  groupByTime = false,
  virtualized,
  virtualizationThreshold = DEFAULT_VIRTUALIZATION_THRESHOLD,
  rowHeight = DEFAULT_ROW_HEIGHT,
  height,
  overscanCount = DEFAULT_OVERSCAN_COUNT,
  hasMore = false,
  isLoading = false,
  onLoadMore,
  enablePinMove = false,
  pinMoveScope = 'none',
  sourceKey,
  onMoveCommit,
  insightMode = false,
  insightValueResolver = null
}) {
  const {
    handleSongClick,
    currentFile,
    appendToCurrentQueue,
    removeFromCurrentQueue,
    manualQueueOrders,
    setManualQueueOrders
  } = useQueue()
  const { likesLookup, toggleLike } = useLikes()
  const { latersong } = useMini()
  const { addPlaylisthistory, removeSongFromList } = usePlaylists()
  const { preloadVisibleSongCovers } = useImages()
  const [isSavePlaylistVisible, setIsSavePlaylistVisible] = useState(false)
  const [visibleRange, setVisibleRange] = useState({ start: 0, stop: -1 })
  const [coverUrls, setCoverUrls] = useState({})
  const [pinnedSongPath, setPinnedSongPath] = useState(null)
  const [pinnedOriginalIndex, setPinnedOriginalIndex] = useState(null)
  const [pinnedSourceKey, setPinnedSourceKey] = useState(null)
  const containerRef = useRef(null)
  const scrollContainerRef = useRef(null)
  const virtualListRef = useRef(null)
  const activeSongNodeRef = useRef(null)
  const longPressTimerRef = useRef(null)
  const longPressStateRef = useRef(null)
  const suppressClickRef = useRef(null)
  const isDescending = true
  const [measuredHeight, setMeasuredHeight] = useState(DEFAULT_MIN_HEIGHT)
  const responsiveSongRowHeight = useSongItemRowHeight()
  const effectiveRowHeight = rowHeight === DEFAULT_ROW_HEIGHT ? responsiveSongRowHeight : rowHeight

  const baseList = useMemo(() => {
    const uniqueList = dedupeSongsByFilePath(list)

    if (preserveOrder) return uniqueList

    return uniqueList
      .slice()
      .sort((a, b) =>
        isDescending
          ? (b.short_view_count || 0) - (a.short_view_count || 0)
          : (a.short_view_count || 0) - (b.short_view_count || 0)
      )
  }, [isDescending, list, preserveOrder])

  const persistedOrder =
    pinMoveScope === 'source-local' && sourceKey ? manualQueueOrders?.[sourceKey] : null

  const { orderedList } = useMemo(() => resolveManualOrder(baseList, persistedOrder), [baseList, persistedOrder])

  const displayedList = pinMoveScope === 'source-local' ? orderedList : baseList

  const shouldVirtualize =
    typeof virtualized === 'boolean'
      ? virtualized
      : displayedList.length >= virtualizationThreshold
  const groupedRows = useMemo(
    () => (groupByTime ? buildTimeGroupedRows(displayedList) : []),
    [displayedList, groupByTime]
  )

  const activeFilePath = currentFile?.filePath ?? null
  const activeSongIndex = useMemo(
    () => displayedList.findIndex((file) => file?.filePath === activeFilePath),
    [activeFilePath, displayedList]
  )
  const activeGroupedRowIndex = useMemo(
    () =>
      groupByTime
        ? groupedRows.findIndex(
            (row) => row?.type === 'song' && row?.file?.filePath === activeFilePath
          )
        : -1,
    [activeFilePath, groupByTime, groupedRows]
  )
  const isDirectorySource = typeof name === 'string' && name.startsWith('folder:')
  const isCurrentQueueSource = name === 'currentQueue'
  const isPlaylistSource =
    typeof name === 'string' &&
    !isDirectorySource &&
    !isCurrentQueueSource &&
    /\.m3u8?$/i.test(name)

  const isPinMoveEnabled =
    enablePinMove &&
    displayedList.length > 1 &&
    (pinMoveScope === 'session-queue' || (pinMoveScope === 'source-local' && sourceKey))

  const cancelPendingLongPress = useCallback(() => {
    clearTimer(longPressTimerRef)
    longPressStateRef.current = null
  }, [])

  useEffect(() => {
    return () => {
      cancelPendingLongPress()
    }
  }, [cancelPendingLongPress])

  useEffect(() => {
    if (!pinnedSongPath) {
      return
    }

    const pinnedStillExists = displayedList.some((file) => file?.filePath === pinnedSongPath)

    if (!pinnedStillExists) {
      setPinnedSongPath(null)
      setPinnedOriginalIndex(null)
      setPinnedSourceKey(null)
    }
  }, [displayedList, pinnedSongPath])

  const menuOptions = useMemo(() => {
    const options = [
      { id: 'add to queue', label: t('actions.addToQueue'), icon: <FaPlusCircle /> },
      { id: 'add later', label: t('actions.addLater'), icon: <LuClock3 /> },
      { id: 'add to playlist', label: t('actions.addToPlaylist'), icon: <FaListUl /> },
      { id: 'save as playlist', label: t('actions.saveAsPlaylist'), icon: <FaRegSave /> },
      { id: 'remove', label: t('actions.remove'), icon: <FaTrash />, disabled: isDirectorySource }
    ]

    if (actions) {
      Object.keys(actions).forEach((key) => {
        options.push({ id: key, label: key })
      })
    }

    return options
  }, [actions, isDirectorySource, t])

  const commitMovedList = useCallback(
    (nextList) => {
      if (pinMoveScope === 'source-local' && sourceKey) {
        const nextOrder = nextList.map((file) => file.filePath).filter(Boolean)

        if (!areArraysEqual(nextOrder, manualQueueOrders?.[sourceKey] || [])) {
          setManualQueueOrders((currentOrders) => ({
            ...currentOrders,
            [sourceKey]: nextOrder
          }))
        }
      }

      onMoveCommit?.(nextList)
    },
    [manualQueueOrders, onMoveCommit, pinMoveScope, setManualQueueOrders, sourceKey]
  )

  const clearPinnedSong = useCallback(() => {
    setPinnedSongPath(null)
    setPinnedOriginalIndex(null)
    setPinnedSourceKey(null)
  }, [])

  const onPlay = useCallback(
    (file, index) => {
      if (suppressClickRef.current === file?.filePath) {
        suppressClickRef.current = null
        return
      }

      if (pinnedSongPath) {
        if (file?.filePath === pinnedSongPath) {
          clearPinnedSong()
          return
        }

        const sourceIndex = displayedList.findIndex((item) => item?.filePath === pinnedSongPath)
        const targetIndex = displayedList.findIndex((item) => item?.filePath === file?.filePath)

        if (sourceIndex >= 0 && targetIndex >= 0) {
          const nextList = moveItemBelowTarget(displayedList, sourceIndex, targetIndex)
          commitMovedList(nextList)
        }

        clearPinnedSong()
        return
      }

      if (onPlayOverride) {
        onPlayOverride(file, index, displayedList, name)
        return
      }

      if (playbackMode === 'single') {
        handleSongClick(file, 0, [file], name)
        return
      }

      handleSongClick(file, index, displayedList, name)

      if (name && !name.startsWith('folder:') && !name.startsWith('/')) {
        addPlaylisthistory(name)
      }
    },
    [
      addPlaylisthistory,
      clearPinnedSong,
      commitMovedList,
      displayedList,
      handleSongClick,
      name,
      onPlayOverride,
      playbackMode,
      pinnedSongPath
    ]
  )

  const onToggleLike = useCallback(
    async (event, file, isLiked) => {
      event.stopPropagation()
      await toggleLike(file, isLiked, { refreshCollection: false })
    },
    [toggleLike]
  )

  const onMenuSelect = useCallback(
    (optionId, file, index) => {
      if (optionId === 'add to queue') {
        appendToCurrentQueue(file)
        return
      }

      if (optionId === 'add later') {
        latersong(file)
        return
      }

      if (optionId === 'save as playlist') {
        setIsSavePlaylistVisible(true)
        return
      }

      if (optionId === 'remove') {
        if (isDirectorySource) {
          return
        }

        if (isCurrentQueueSource) {
          removeFromCurrentQueue(index)
          return
        }

        if (isPlaylistSource) {
          void removeSongFromList(name, index)
          return
        }
      }

      const action = actions?.[optionId]
      if (action) {
        action(file, index)
      } else {
        console.log('Opcion no reconocida:', optionId)
      }
    },
    [
      actions,
      appendToCurrentQueue,
      isCurrentQueueSource,
      isDirectorySource,
      isPlaylistSource,
      latersong,
      name,
      removeFromCurrentQueue,
      removeSongFromList
    ]
  )

  const [isActiveVisible, setIsActiveVisible] = useState(true)

  const evaluateActiveVisibility = useCallback(() => {
    if (!activeFilePath) {
      setIsActiveVisible(true)
      return
    }

    if (shouldVirtualize) {
      const comparisonIndex = groupByTime ? activeGroupedRowIndex : activeSongIndex

      if (comparisonIndex < 0) {
        setIsActiveVisible(true)
        return
      }

      const currentStart = visibleRange.start
      const currentStop = visibleRange.stop
      const visible = currentStop >= currentStart && comparisonIndex >= currentStart && comparisonIndex <= currentStop
      setIsActiveVisible(visible)
      return
    }

    const scrollContainer = scrollContainerRef.current
    const activeNode = activeSongNodeRef.current

    if (!scrollContainer || !activeNode) {
      setIsActiveVisible(true)
      return
    }

    const containerRect = scrollContainer.getBoundingClientRect()
    const activeRect = activeNode.getBoundingClientRect()
    const visible =
      activeRect.top >= containerRect.top && activeRect.bottom <= containerRect.bottom

    setIsActiveVisible(visible)
  }, [
    activeFilePath,
    activeGroupedRowIndex,
    activeSongIndex,
    groupByTime,
    shouldVirtualize,
    visibleRange.start,
    visibleRange.stop
  ])

  const scrollActiveItemToCenter = useCallback(() => {
    if (!activeFilePath) {
      return
    }

    if (shouldVirtualize) {
      const targetIndex = groupByTime ? activeGroupedRowIndex : activeSongIndex

      if (targetIndex >= 0) {
        virtualListRef.current?.scrollToItem(targetIndex, 'center')
      }

      return
    }

    const scrollContainer = scrollContainerRef.current
    const activeNode = activeSongNodeRef.current

    if (!scrollContainer || !activeNode) {
      return
    }

    const targetScrollTop =
      activeNode.offsetTop - scrollContainer.clientHeight / 2 + activeNode.clientHeight / 2

    scrollContainer.scrollTo({
      top: Math.max(0, targetScrollTop),
      behavior: 'smooth'
    })
  }, [activeFilePath, activeGroupedRowIndex, activeSongIndex, groupByTime, shouldVirtualize])

  const handleItemsRendered = useCallback(
    ({ visibleStartIndex, visibleStopIndex }) => {
      setVisibleRange((currentRange) => {
        if (
          currentRange.start === visibleStartIndex &&
          currentRange.stop === visibleStopIndex
        ) {
          return currentRange
        }

        return {
          start: visibleStartIndex,
          stop: visibleStopIndex
        }
      })

      const loadMoreStartIndex = groupByTime ? groupedRows.length : displayedList.length
      const shouldLoadMore =
        hasMore && !isLoading && visibleStopIndex >= loadMoreStartIndex - LOAD_MORE_THRESHOLD

      if (shouldLoadMore) {
        onLoadMore?.()
      }
    },
    [displayedList.length, groupByTime, groupedRows.length, hasMore, isLoading, onLoadMore]
  )

  useEffect(() => {
    evaluateActiveVisibility()
  }, [evaluateActiveVisibility])

  useEffect(() => {
    if (shouldVirtualize) {
      return undefined
    }

    const scrollContainer = scrollContainerRef.current

    if (!scrollContainer) {
      return undefined
    }

    const handleVisibilityChange = () => {
      evaluateActiveVisibility()
    }

    scrollContainer.addEventListener('scroll', handleVisibilityChange, { passive: true })
    window.addEventListener('resize', handleVisibilityChange)

    return () => {
      scrollContainer.removeEventListener('scroll', handleVisibilityChange)
      window.removeEventListener('resize', handleVisibilityChange)
    }
  }, [evaluateActiveVisibility, shouldVirtualize])

  const visibleSongs = useMemo(() => {
    if (displayedList.length === 0) {
      return []
    }

    if (!shouldVirtualize) {
      return displayedList.slice(0, NON_VIRTUALIZED_COVER_LIMIT)
    }

    if (groupByTime) {
      const start = Math.max(visibleRange.start - overscanCount, 0)
      const stop = Math.min(visibleRange.stop + overscanCount, groupedRows.length - 1)

      if (stop < start) {
        return displayedList.slice(0, Math.min(displayedList.length, NON_VIRTUALIZED_COVER_LIMIT))
      }

      return groupedRows
        .slice(start, stop + 1)
        .map((row) => row.type === 'song' ? row.file : null)
        .filter(Boolean)
    }

    const start = Math.max(visibleRange.start - overscanCount, 0)
    const stop = Math.min(visibleRange.stop + overscanCount, displayedList.length - 1)

    if (stop < start) {
      return displayedList.slice(0, Math.min(displayedList.length, NON_VIRTUALIZED_COVER_LIMIT))
    }

    return displayedList.slice(start, stop + 1)
  }, [
    displayedList,
    groupByTime,
    groupedRows,
    overscanCount,
    shouldVirtualize,
    visibleRange.start,
    visibleRange.stop
  ])

  useEffect(() => {
    let isMounted = true

    if (visibleSongs.length === 0) {
      setCoverUrls((currentCoverUrls) =>
        Object.keys(currentCoverUrls).length === 0 ? currentCoverUrls : {}
      )
      return () => {
        isMounted = false
      }
    }

    preloadVisibleSongCovers(visibleSongs, { variant: 'thumb' }).then((resolvedCovers) => {
      if (!isMounted) {
        return
      }

      setCoverUrls((currentCoverUrls) => {
        let hasChanges = false
        const nextVisibleKeys = new Set()
        const nextCoverUrls = {}

        resolvedCovers.forEach(({ filePath, url }) => {
          if (!filePath) {
            return
          }

          nextVisibleKeys.add(filePath)
          const previousUrl = currentCoverUrls[filePath]

          if (previousUrl !== url) {
            nextCoverUrls[filePath] = url
            hasChanges = true
            return
          }

          nextCoverUrls[filePath] = previousUrl
        })

        if (!hasChanges && Object.keys(currentCoverUrls).length === nextVisibleKeys.size) {
          const hasRemovedKeys = Object.keys(currentCoverUrls).some((filePath) => !nextVisibleKeys.has(filePath))

          if (!hasRemovedKeys) {
            return currentCoverUrls
          }
        }

        return nextCoverUrls
      })
    })

    return () => {
      isMounted = false
    }
  }, [preloadVisibleSongCovers, visibleSongs])

  const completeLongPress = useCallback((filePath, index) => {
    suppressClickRef.current = filePath
    setPinnedSongPath(filePath)
    setPinnedOriginalIndex(index)
    setPinnedSourceKey(sourceKey || name)
    longPressStateRef.current = {
      filePath,
      index,
      activated: true
    }
  }, [name, sourceKey])

  const onSongPointerDown = useCallback(
    (event, file, index) => {
      if (!isPinMoveEnabled || !file?.filePath || event.button !== 0) {
        return
      }

      cancelPendingLongPress()

      longPressStateRef.current = {
        filePath: file.filePath,
        index,
        startX: event.clientX,
        startY: event.clientY,
        activated: false
      }

      longPressTimerRef.current = window.setTimeout(() => {
        completeLongPress(file.filePath, index)
        clearTimer(longPressTimerRef)
      }, LONG_PRESS_DELAY_MS)
    },
    [cancelPendingLongPress, completeLongPress, isPinMoveEnabled]
  )

  const cancelLongPressIfPending = useCallback(() => {
    const state = longPressStateRef.current

    if (!state?.activated) {
      cancelPendingLongPress()
    }
  }, [cancelPendingLongPress])

  const onSongPointerUp = useCallback(() => {
    cancelLongPressIfPending()
  }, [cancelLongPressIfPending])

  const onSongPointerLeave = useCallback(() => {
    cancelLongPressIfPending()
  }, [cancelLongPressIfPending])

  const onSongPointerCancel = useCallback(() => {
    cancelLongPressIfPending()
  }, [cancelLongPressIfPending])

  useEffect(() => {
    if (!isPinMoveEnabled) {
      clearPinnedSong()
      cancelPendingLongPress()
      return
    }

    const handlePointerMove = (event) => {
      const state = longPressStateRef.current

      if (!state || state.activated) {
        return
      }

      const deltaX = Math.abs(event.clientX - state.startX)
      const deltaY = Math.abs(event.clientY - state.startY)

      if (deltaX > POINTER_CANCEL_DISTANCE || deltaY > POINTER_CANCEL_DISTANCE) {
        cancelPendingLongPress()
      }
    }

    window.addEventListener('pointermove', handlePointerMove)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
    }
  }, [cancelPendingLongPress, clearPinnedSong, isPinMoveEnabled])

  useEffect(() => {
    if (!shouldFillParentHeight(height)) {
      return undefined
    }

    const container = containerRef.current

    if (!container) {
      return undefined
    }

    const updateHeight = () => {
      const nextHeight = container.clientHeight || DEFAULT_MIN_HEIGHT
      setMeasuredHeight((currentHeight) => (currentHeight === nextHeight ? currentHeight : nextHeight))
    }

    updateHeight()

    if (typeof window.ResizeObserver !== 'function') {
      window.addEventListener('resize', updateHeight)
      return () => {
        window.removeEventListener('resize', updateHeight)
      }
    }

    const resizeObserver = new window.ResizeObserver(updateHeight)
    resizeObserver.observe(container)

    return () => {
      resizeObserver.disconnect()
    }
  }, [height])

  useEffect(() => {
    if (!shouldVirtualize) {
      return
    }

    virtualListRef.current?.resetAfterIndex?.(0, true)
  }, [effectiveRowHeight, shouldVirtualize])

  const itemData = useMemo(
    () => ({
      activeFilePath,
      coverUrls,
      enablePinMove: isPinMoveEnabled,
      groupedRows,
      insightMode,
      insightValueResolver,
      likesLookup,
      menuOptions,
      onMenuSelect,
      onPlay,
      onSongPointerCancel,
      onSongPointerDown,
      onSongPointerLeave,
      onSongPointerUp,
      onToggleLike,
      pinnedSongPath,
      songs: displayedList
    }),
    [
      activeFilePath,
      coverUrls,
      displayedList,
      groupedRows,
      isPinMoveEnabled,
      insightMode,
      insightValueResolver,
      likesLookup,
      menuOptions,
      onMenuSelect,
      onPlay,
      onSongPointerCancel,
      onSongPointerDown,
      onSongPointerLeave,
      onSongPointerUp,
      onToggleLike,
      pinnedSongPath
    ]
  )

  const fillsParentHeight = shouldFillParentHeight(height)
  const virtualItemCount = groupByTime ? groupedRows.length : displayedList.length
  const shouldRenderLoadingRow = hasMore && isLoading
  const itemCount = virtualItemCount + (shouldRenderLoadingRow ? 1 : 0)
  const listHeight = fillsParentHeight ? measuredHeight : resolveListHeight(height)
  const getGroupedRowHeight = useCallback(
    (index) => {
      const row = groupedRows[index]

      if (row?.type === 'date-header') {
        return DEFAULT_DATE_HEADER_HEIGHT
      }

      if (row?.type === 'hour-header') {
      return DEFAULT_HOUR_HEADER_HEIGHT
      }

      return effectiveRowHeight
    },
    [effectiveRowHeight, groupedRows]
  )
  const showScrollToActiveButtons = Boolean(activeFilePath) && !isActiveVisible

  return (
    <div
      ref={containerRef}
      className={shouldVirtualize ? 'Cola VirtualizedCola' : 'Cola'}
      data-pin-active={Boolean(pinnedSongPath)}
      data-pinned-index={pinnedOriginalIndex ?? ''}
      data-pinned-source={pinnedSourceKey ?? ''}
    >
      {itemCount > 0 ? (
        shouldVirtualize && groupByTime ? (
          <VariableSizeList
            ref={virtualListRef}
            outerRef={scrollContainerRef}
            className="VirtualizedCola__list VirtualizedCola__list--grouped"
            height={listHeight}
            itemCount={itemCount}
            itemData={itemData}
            itemKey={(index, data) => data.groupedRows[index]?.id || `loader-${index}`}
            itemSize={getGroupedRowHeight}
            onItemsRendered={handleItemsRendered}
            overscanCount={overscanCount}
            width="100%"
          >
            {TimeGroupedSongRow}
          </VariableSizeList>
        ) : shouldVirtualize ? (
          <FixedSizeList
            ref={virtualListRef}
            outerRef={scrollContainerRef}
            className="VirtualizedCola__list"
            height={listHeight}
            itemCount={itemCount}
            itemData={itemData}
            itemKey={(index, data) => data.songs[index]?.filePath || `loader-${index}`}
            itemSize={effectiveRowHeight}
            onItemsRendered={handleItemsRendered}
            overscanCount={overscanCount}
            width="100%"
          >
            {VirtualSongRow}
          </FixedSizeList>
        ) : (
          <ul
            ref={scrollContainerRef}
            className={fillsParentHeight ? 'Cola__list Cola__list--scrollable' : 'Cola__list'}
            style={fillsParentHeight ? undefined : typeof height === 'string' ? { minHeight: height } : undefined}
          >
            {displayedList.map((file, index) => {
              const isActive = file.filePath === activeFilePath

              return (
                <SongItem
                  key={file.filePath || `${name}-${index}`}
                  file={file}
                  index={index}
                  coverUrl={coverUrls[file.filePath] || DEFAULT_COVER}
                  isActive={isActive}
                  itemRef={isActive ? activeSongNodeRef : undefined}
                  isPinned={pinnedSongPath === file.filePath}
                  isPinEnabled={isPinMoveEnabled}
                  isLiked={getLikeValue(likesLookup, file)}
                  showInsightValue={insightMode}
                  insightValueLabel={insightValueResolver?.(file) || ''}
                  menuOptions={menuOptions}
                  onPlay={onPlay}
                  onToggleLike={onToggleLike}
                  onMenuSelect={onMenuSelect}
                  onPointerDown={onSongPointerDown}
                  onPointerUp={onSongPointerUp}
                  onPointerLeave={onSongPointerLeave}
                  onPointerCancel={onSongPointerCancel}
                />
              )
            })}
          </ul>
        )
      ) : (
        <LoadingCola isLoading={isLoading} />
      )}

      {showScrollToActiveButtons ? (
        <div className="Cola__active-track-fabs" aria-hidden="false">
          <button
            type="button"
            className="Cola__active-track-fab Cola__active-track-fab--top"
            onClick={scrollActiveItemToCenter}
            title="Center active track"
            aria-label="Center active track"
          >
            <RiFocus3Line />
          </button>
          <button
            type="button"
            className="Cola__active-track-fab Cola__active-track-fab--bottom"
            onClick={scrollActiveItemToCenter}
            title="Center active track"
            aria-label="Center active track"
          >
            <RiFocus3Line />
          </button>
        </div>
      ) : null}

      <PlaylistSaveModal
        isVisible={isSavePlaylistVisible}
        onClose={() => setIsSavePlaylistVisible(false)}
        tracks={displayedList}
        sourceName={name}
      />
    </div>
  )
}

function LoadingCola({ isLoading = false }) {
  if (!isLoading) {
    return <div className="VirtualizedCola__empty">No tracks found.</div>
  }

  return (
    <div className="Cola">
      <ul>
        <SongItem />
        <SongItem />
        <SongItem />
        <SongItem />
      </ul>
    </div>
  )
}

export default Cola
  const { t } = useI18n()
