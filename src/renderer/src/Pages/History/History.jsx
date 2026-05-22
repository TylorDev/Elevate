import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMini } from '../../Contexts/MiniContext'
import { Cola } from '../../components/Cola/Cola'
import { LuHistory, LuRefreshCw } from 'react-icons/lu'
import './History.scss'

const HISTORY_PAGE_SIZE = 10

function History() {
  const { getHistory } = useMini()
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const loadingPageRef = useRef(null)
  const loadedPagesRef = useRef(new Set())
  const hasLoadedInitialPageRef = useRef(false)

  const loadHistoryPage = useCallback(
    async (nextPage, { force = false } = {}) => {
      if (
        (!force && loadingPageRef.current === nextPage) ||
        (!force && loadedPagesRef.current.has(nextPage)) ||
        (!force && !hasMore && nextPage !== 1)
      ) {
        return
      }

      loadingPageRef.current = nextPage
      setIsLoading(true)

      try {
        const nextHistory = await getHistory({ page: nextPage, pageSize: HISTORY_PAGE_SIZE })
        const nextItems = Array.isArray(nextHistory?.fileInfos) ? nextHistory.fileInfos : []

        loadedPagesRef.current.add(nextPage)
        setPage(nextHistory?.page || nextPage)
        setHasMore(Boolean(nextHistory?.hasMore))
        setItems((currentItems) => {
          if (nextPage === 1) {
            return nextItems
          }

          const seenFilePaths = new Set(currentItems.map((file) => file?.filePath).filter(Boolean))
          const uniqueNextItems = nextItems.filter((file) => {
            if (!file?.filePath) {
              return true
            }

            if (seenFilePaths.has(file.filePath)) {
              return false
            }

            seenFilePaths.add(file.filePath)
            return true
          })

          return [...currentItems, ...uniqueNextItems]
        })
      } finally {
        loadingPageRef.current = null
        setIsLoading(false)
      }
    },
    [getHistory, hasMore]
  )

  useEffect(() => {
    if (hasLoadedInitialPageRef.current) {
      return
    }

    hasLoadedInitialPageRef.current = true
    void loadHistoryPage(1)
  }, [loadHistoryPage])

  const handleLoadMore = useCallback(() => {
    if (!isLoading && hasMore) {
      void loadHistoryPage(page + 1)
    }
  }, [hasMore, isLoading, loadHistoryPage, page])

  const handleRefreshHistory = useCallback(() => {
    if (isLoading) {
      return
    }

    setItems([])
    setPage(0)
    setHasMore(true)
    loadedPagesRef.current.clear()
    hasLoadedInitialPageRef.current = false
    void loadHistoryPage(1, { force: true })
  }, [isLoading, loadHistoryPage])

  const handleOpenSongHistory = useCallback(
    (file) => {
      if (!file?.filePath) {
        return
      }

      navigate(`/history/song/${encodeURIComponent(file.filePath)}`)
    },
    [navigate]
  )

  return (
    <div className="HistoryPage">
      <header className="history-header">
        <div className="history-header__top">
          <div className="title-group">
            <LuHistory className="history-icon" />
            <h1>Listening History</h1>
          </div>

          <button
            type="button"
            className="history-refresh-btn"
            onClick={handleRefreshHistory}
            disabled={isLoading}
            title="Refrescar historial"
            aria-label="Refrescar historial"
          >
            <LuRefreshCw />
          </button>
        </div>
      </header>

      <div className="history-content">
        <Cola
          list={items}
          name="history"
          height="100%"
          preserveOrder
          virtualized
          groupByTime
          hasMore={hasMore}
          isLoading={isLoading}
          onLoadMore={handleLoadMore}
          onPlayOverride={handleOpenSongHistory}
          playbackMode="single"
        />
      </div>
    </div>
  )
}

export default History
