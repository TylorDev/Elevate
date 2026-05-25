import { ToastContainer } from 'react-toastify'
import { AudioPlayer } from '../../Components/AudioPlayer/AudioPlayer'
import Header from '../../Components/Header/Header'
import Background from '../../Components/Background/Background'
import { VisualizerProvider } from '../../Contexts/VisualizerContext'
import StatusBar from '../../components/StatusBar/StatusBar'
import './Main.scss'
import { Outlet } from 'react-router-dom'
import { useEffect, useState } from 'react'

import { useSuper } from '../../Contexts/SupeContext'
import QueueTabsPanel from '../../components/QueueTabsPanel/QueueTabsPanel'
import {
  useIsCompactHeaderViewport,
  useIsCompactViewportHeight
} from '../../utils/compactViewport'

const AUTO_HIDE_LAYOUT_BREAKPOINT = 950

function Main() {
  const { scrollRef } = useSuper()
  const isCompactHeight = useIsCompactViewportHeight()
  const isCompactHeaderMode = useIsCompactHeaderViewport()
  const [headerHiddenPreference, setHeaderHiddenPreference] = useState(null)
  const [queueHiddenPreference, setQueueHiddenPreference] = useState(null)
  const [shouldAutoHidePanels, setShouldAutoHidePanels] = useState(() => {
    if (typeof window === 'undefined') {
      return false
    }

    return window.innerWidth < AUTO_HIDE_LAYOUT_BREAKPOINT
  })

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }

    const mediaQuery = window.matchMedia(`(max-width: ${AUTO_HIDE_LAYOUT_BREAKPOINT - 1}px)`)

    const syncAutoHideState = (event) => {
      setShouldAutoHidePanels(event.matches)
    }

    syncAutoHideState(mediaQuery)

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', syncAutoHideState)

      return () => {
        mediaQuery.removeEventListener('change', syncAutoHideState)
      }
    }

    mediaQuery.addListener(syncAutoHideState)

    return () => {
      mediaQuery.removeListener(syncAutoHideState)
    }
  }, [])

  const isHeaderCollapsed =
    isCompactHeaderMode ||
    (headerHiddenPreference === null ? shouldAutoHidePanels : headerHiddenPreference)
  const isQueueCollapsed =
    queueHiddenPreference === null ? shouldAutoHidePanels : queueHiddenPreference

  const mainClassName = [
    'Main',
    isCompactHeight ? 'Main--compact-height' : '',
    isHeaderCollapsed ? 'Main--header-hidden' : '',
    isQueueCollapsed ? 'Main--queue-hidden' : 'Main--queue-visible'
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={mainClassName}>
      <VisualizerProvider>
        <Background />
        <div className="Main__status">
          <StatusBar
            isCompactHeaderMode={isCompactHeaderMode}
            isHeaderHidden={isHeaderCollapsed}
            isQueueHidden={isQueueCollapsed}
            onToggleHeader={() =>
              setHeaderHiddenPreference((current) =>
                current === null ? !shouldAutoHidePanels : !current
              )
            }
            onToggleQueue={() =>
              setQueueHiddenPreference((current) =>
                current === null ? !shouldAutoHidePanels : !current
              )
            }
          />
        </div>
        {!isHeaderCollapsed && !isCompactHeaderMode ? (
          <aside className="Main__header">
            <Header />
          </aside>
        ) : null}
        <main className="outlet" ref={scrollRef}>
          <Outlet />
        </main>
        <div className="Main__player">
          <AudioPlayer
            isQueueHidden={isQueueCollapsed}
            onToggleQueue={() =>
              setQueueHiddenPreference((current) =>
                current === null ? !shouldAutoHidePanels : !current
              )
            }
          />
        </div>
        <aside className="Main__queue">
          <QueueTabsPanel />
        </aside>
      </VisualizerProvider>
      <ToastContainer />
    </div>
  )
}
export default Main
