import { ToastContainer } from 'react-toastify'
import { AudioPlayer } from '../../Components/AudioPlayer/AudioPlayer'
import Header from '../../Components/Header/Header'
import Background from '../../Components/Background/Background'
import { VisualizerProvider } from '../../Contexts/VisualizerContext'
import StatusBar from '../../components/StatusBar/StatusBar'
import './Main.scss'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useCallback, useEffect, useRef, useState } from 'react'

import { useSuper } from '../../Contexts/SupeContext'
import QueueTabsPanel from '../../components/QueueTabsPanel/QueueTabsPanel'
import {
  useIsCollectionHorizontalViewport,
  useIsCollectionMovilEligibleViewport,
  useIsCompactHeaderViewport,
  useIsCompactViewportHeight
} from '../../utils/compactViewport'

const AUTO_HIDE_LAYOUT_BREAKPOINT = 950
const MOBILE_QUEUE_REDIRECT_BREAKPOINT = 700

function Main() {
  const { scrollRef } = useSuper()
  const navigate = useNavigate()
  const location = useLocation()
  const outletMeasureRef = useRef(null)
  const queueNavigationRedirectRef = useRef(false)
  const isCompactHeight = useIsCompactViewportHeight()
  const isCompactHeaderMode = useIsCompactHeaderViewport()
  const isCollectionHorizontalViewport = useIsCollectionHorizontalViewport()
  const isCollectionMovilEligibleViewport = useIsCollectionMovilEligibleViewport()
  const [outletDimensions, setOutletDimensions] = useState({
    width: 0,
    height: 0
  })
  const [headerHiddenPreference, setHeaderHiddenPreference] = useState(null)
  const [queueHiddenPreference, setQueueHiddenPreference] = useState(null)
  const [isMobileQueueRedirectViewport, setIsMobileQueueRedirectViewport] = useState(() => {
    if (typeof window === 'undefined') {
      return false
    }

    return window.innerWidth <= MOBILE_QUEUE_REDIRECT_BREAKPOINT
  })
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

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }

    const mediaQuery = window.matchMedia(`(max-width: ${MOBILE_QUEUE_REDIRECT_BREAKPOINT}px)`)

    const syncViewportState = (event) => {
      setIsMobileQueueRedirectViewport(event.matches)
    }

    syncViewportState(mediaQuery)

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', syncViewportState)

      return () => {
        mediaQuery.removeEventListener('change', syncViewportState)
      }
    }

    mediaQuery.addListener(syncViewportState)

    return () => {
      mediaQuery.removeListener(syncViewportState)
    }
  }, [])

  const updateOutletDimensions = useCallback(() => {
    const outletNode = outletMeasureRef.current

    if (!outletNode) {
      return
    }

    const nextDimensions = {
      width: Math.round(outletNode.clientWidth),
      height: Math.round(outletNode.clientHeight)
    }

    setOutletDimensions((currentDimensions) =>
      currentDimensions.width === nextDimensions.width &&
      currentDimensions.height === nextDimensions.height
        ? currentDimensions
        : nextDimensions
    )
  }, [])

  useEffect(() => {
    updateOutletDimensions()

    if (typeof window === 'undefined') {
      return undefined
    }

    const outletNode = outletMeasureRef.current

    if (!outletNode) {
      return undefined
    }

    if (typeof window.ResizeObserver !== 'function') {
      window.addEventListener('resize', updateOutletDimensions)

      return () => {
        window.removeEventListener('resize', updateOutletDimensions)
      }
    }

    const resizeObserver = new window.ResizeObserver(() => {
      updateOutletDimensions()
    })

    resizeObserver.observe(outletNode)

    return () => {
      resizeObserver.disconnect()
    }
  }, [updateOutletDimensions])

  const handleOutletRef = useCallback(
    (node) => {
      outletMeasureRef.current = node

      if (typeof scrollRef === 'function') {
        scrollRef(node)
        return
      }

      if (scrollRef && typeof scrollRef === 'object') {
        scrollRef.current = node
      }
    },
    [scrollRef]
  )

  const isHeaderCollapsed =
    isCompactHeaderMode ||
    (headerHiddenPreference === null ? shouldAutoHidePanels : headerHiddenPreference)
  const isQueueCollapsed =
    queueHiddenPreference === null ? shouldAutoHidePanels : queueHiddenPreference
  const shouldUseCollectionHorizontalMobileLayout = isCollectionHorizontalViewport
  const shouldUseCollectionMobileLayout =
    isCompactHeaderMode || (isCollectionMovilEligibleViewport && !isQueueCollapsed)

  const mainClassName = [
    'Main',
    isCompactHeight ? 'Main--compact-height' : '',
    isHeaderCollapsed ? 'Main--header-hidden' : '',
    isQueueCollapsed ? 'Main--queue-hidden' : 'Main--queue-visible'
  ]
    .filter(Boolean)
    .join(' ')

  const handleToggleQueue = useCallback(() => {
    const nextQueueHidden =
      queueHiddenPreference === null ? !shouldAutoHidePanels : !queueHiddenPreference

    setQueueHiddenPreference(nextQueueHidden)

    if (!nextQueueHidden && isMobileQueueRedirectViewport && location.pathname !== '/music') {
      queueNavigationRedirectRef.current = true
      navigate('/music')
    }
  }, [
    isMobileQueueRedirectViewport,
    location.pathname,
    navigate,
    queueHiddenPreference,
    shouldAutoHidePanels
  ])

  useEffect(() => {
    if (queueNavigationRedirectRef.current && location.pathname === '/music') {
      queueNavigationRedirectRef.current = false
      return
    }

    if (
      isMobileQueueRedirectViewport &&
      !isQueueCollapsed &&
      location.pathname !== '/music'
    ) {
      queueNavigationRedirectRef.current = false
      setQueueHiddenPreference(true)
    }
  }, [isMobileQueueRedirectViewport, isQueueCollapsed, location.pathname])

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
            onToggleQueue={handleToggleQueue}
          />
        </div>
        {!isHeaderCollapsed && !isCompactHeaderMode ? (
          <aside className="Main__header">
            <Header />
          </aside>
        ) : null}
        <main className="outlet" ref={handleOutletRef}>
          <Outlet
            context={{
              isHeaderHidden: isHeaderCollapsed,
              isQueueHidden: isQueueCollapsed,
              isCompactHeaderMode,
              shouldUseCollectionMobileLayout,
              shouldUseCollectionHorizontalMobileLayout
            }}
          />
        </main>
        <div className="Main__outlet-debug" aria-hidden="true">
          <span className="Main__outlet-debug-label">OUTLET WIDTH</span>
          <strong className="Main__outlet-debug-value">{outletDimensions.width}px</strong>
          <div className="Main__outlet-debug-divider" />
          <span className="Main__outlet-debug-label">OUTLET HEIGHT</span>
          <strong className="Main__outlet-debug-value">{outletDimensions.height}px</strong>
        </div>
        <div className="Main__player">
          <AudioPlayer
            isQueueHidden={isQueueCollapsed}
            onToggleQueue={handleToggleQueue}
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
