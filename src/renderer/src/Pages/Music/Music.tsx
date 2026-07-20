import { useEffect, useRef } from 'react'
import { ElevateViz } from '@elevate-viz'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { useQueue } from '../../Contexts/QueueContext'
import styles from './Music.module.scss'

export default function Music() {
  const navigate = useNavigate()
  const { currentFile } = useQueue()
  const outletContext = useOutletContext() || {}
  const { isPictureInPictureMode = false, onExitPictureInPicture = () => {} } = outletContext
  const wasAlwaysOnTopRef = useRef(false)

  useEffect(() => {
    let isMounted = true
    const windowControls = window.electron?.windowControls
    if (!windowControls) return

    const syncWindowMode = async () => {
      try {
        const state = await windowControls.getState()
        if (!isMounted) return

        if (isPictureInPictureMode) {
          await windowControls.setMinimumSize(450, 253)
          wasAlwaysOnTopRef.current = state.isAlwaysOnTop
          if (!state.isAlwaysOnTop) await windowControls.toggleAlwaysOnTop()
          return
        }

        await windowControls.setMinimumSize(500, 400)
        if (state.isAlwaysOnTop && !wasAlwaysOnTopRef.current) {
          await windowControls.toggleAlwaysOnTop()
        }
      } catch (error) {
        console.error('Error syncing visualizer window mode:', error)
      }
    }

    void syncWindowMode()
    return () => {
      isMounted = false
    }
  }, [isPictureInPictureMode])

  return (
    <div className={styles.root}>
      <ElevateViz
        view="stage"
        isPictureInPictureMode={isPictureInPictureMode}
        onExitPictureInPicture={onExitPictureInPicture}
        onNavigatePresets={() => navigate('/visualizer-presets')}
        onOpenTrackHistory={() => {
          if (currentFile?.filePath) {
            navigate(`/history/song/${encodeURIComponent(currentFile.filePath)}`)
          }
        }}
      />
    </div>
  )
}
