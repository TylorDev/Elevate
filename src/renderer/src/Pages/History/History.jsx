import { useEffect, useState } from 'react'
import { useMini } from '../../Contexts/MiniContext'
import { Cola } from '../../components/Cola/Cola'
import { LuHistory, LuChevronLeft, LuChevronRight } from 'react-icons/lu'
import './History.scss'

function History() {
  const { getHistory, history } = useMini()
  const [page, setPage] = useState(1)

  useEffect(() => {
    getHistory(page)
  }, [page])

  const handlePrevPage = () => {
    if (page > 1) setPage(page - 1)
  }

  const handleNextPage = () => {
    if (page < (history?.maxPages || 1)) setPage(page + 1)
  }

  return (
    <div className="HistoryPage">
      <header className="history-header">
        <div className="title-group">
          <LuHistory className="history-icon" />
          <h1>Listening History</h1>
        </div>
        <p className="history-subtitle">
          Your recently played tracks and favorites.
        </p>
      </header>

      <div className="history-content">
        <Cola list={history?.fileInfos} name="history" />
      </div>

      {history?.maxPages > 1 && (
        <footer className="history-footer">
          <div className="pagination-container">
            <button 
              className="pagination-btn" 
              onClick={handlePrevPage}
              disabled={page === 1}
            >
              <LuChevronLeft />
              <span>Previous</span>
            </button>
            
            <div className="pagination-info">
              <span className="current">{page}</span>
              <span className="separator">/</span>
              <span className="total">{history.maxPages}</span>
            </div>

            <button 
              className="pagination-btn" 
              onClick={handleNextPage}
              disabled={page === history.maxPages}
            >
              <span>Next</span>
              <LuChevronRight />
            </button>
          </div>
        </footer>
      )}
    </div>
  )
}

export default History
