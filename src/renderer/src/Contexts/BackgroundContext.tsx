import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const BackgroundContext = createContext(null)

export const BackgroundProvider = ({ children }) => {
  const [currentBackground, setCurrentBackground] = useState(null)
  const [backgroundHistory, setBackgroundHistory] = useState([])
  const [backgroundLoading, setBackgroundLoading] = useState(true)

  const applyBackgroundState = useCallback((state) => {
    const items = Array.isArray(state?.items) ? state.items : []
    const current =
      state?.current && typeof state.current === 'object'
        ? state.current
        : items.find((item) => item?.id && item.id === state?.currentBackgroundId) || null

    setCurrentBackground(current || null)
    setBackgroundHistory(items)
  }, [])

  const refreshBackgroundHistory = useCallback(async () => {
    setBackgroundLoading(true)

    try {
      const state = await window.electron.backgroundImages.list()
      applyBackgroundState(state)
      return state
    } catch (error) {
      console.error('Error loading background history:', error)
      return null
    } finally {
      setBackgroundLoading(false)
    }
  }, [applyBackgroundState])

  useEffect(() => {
    let alive = true

    const initializeBackgroundHistory = async () => {
      setBackgroundLoading(true)

      try {
        const legacyBackground = localStorage.getItem('backgroundImageUrl')
        let state = null

        if (legacyBackground) {
          const migrationResult =
            await window.electron.backgroundImages.migrateLegacy(legacyBackground)
          if (migrationResult?.success !== false) {
            localStorage.removeItem('backgroundImageUrl')
            state = migrationResult
          }
        }

        if (!state) {
          state = await window.electron.backgroundImages.list()
        }

        if (alive) {
          applyBackgroundState(state)
        }
      } catch (error) {
        console.error('Error initializing background history:', error)
      } finally {
        if (alive) {
          setBackgroundLoading(false)
        }
      }
    }

    void initializeBackgroundHistory()

    return () => {
      alive = false
    }
  }, [applyBackgroundState])

  const applyRemoteBackground = useCallback(
    async (url) => {
      setBackgroundLoading(true)

      try {
        const result = await window.electron.backgroundImages.applyRemote(url)
        if (result?.success) {
          applyBackgroundState(result)
        }

        return result
      } catch (error) {
        console.error('Error applying remote background:', error)
        return {
          success: false,
          errorCode: 'unknown_error',
          errorMessage: 'Error al aplicar la imagen remota.'
        }
      } finally {
        setBackgroundLoading(false)
      }
    },
    [applyBackgroundState]
  )

  const pickLocalBackground = useCallback(async () => {
    setBackgroundLoading(true)

    try {
      const result = await window.electron.backgroundImages.applyLocal()
      if (result?.success) {
        applyBackgroundState(result)
      }

      return result
    } catch (error) {
      console.error('Error applying local background:', error)
      return {
        success: false,
        errorCode: 'unknown_error',
        errorMessage: 'Error al seleccionar la imagen local.'
      }
    } finally {
      setBackgroundLoading(false)
    }
  }, [applyBackgroundState])

  const selectBackgroundFromHistory = useCallback(
    async (id) => {
      setBackgroundLoading(true)

      try {
        const result = await window.electron.backgroundImages.select(id)
        if (result?.success) {
          applyBackgroundState(result)
        }

        return result
      } catch (error) {
        console.error('Error selecting background history item:', error)
        return {
          success: false,
          errorCode: 'unknown_error',
          errorMessage: 'Error al reutilizar la imagen del historial.'
        }
      } finally {
        setBackgroundLoading(false)
      }
    },
    [applyBackgroundState]
  )

  const removeBackgroundHistoryItem = useCallback(
    async (id) => {
      setBackgroundLoading(true)

      try {
        const result = await window.electron.backgroundImages.remove(id)
        if (result?.success) {
          applyBackgroundState(result)
        }

        return result
      } catch (error) {
        console.error('Error removing background history item:', error)
        return {
          success: false,
          errorCode: 'unknown_error',
          errorMessage: 'Error al eliminar la imagen del historial.'
        }
      } finally {
        setBackgroundLoading(false)
      }
    },
    [applyBackgroundState]
  )

  const clearBackground = useCallback(async () => {
    setBackgroundLoading(true)

    try {
      const result = await window.electron.backgroundImages.clearCurrent()
      if (result?.success) {
        applyBackgroundState(result)
      }

      return result
    } catch (error) {
      console.error('Error clearing background:', error)
      return {
        success: false,
        errorCode: 'unknown_error',
        errorMessage: 'Error al limpiar el fondo.'
      }
    } finally {
      setBackgroundLoading(false)
    }
  }, [applyBackgroundState])

  const backgroundImageUrl = currentBackground?.resolvedUrl || ''

  const contextValue = useMemo(
    () => ({
      currentBackground,
      backgroundImageUrl,
      backgroundHistory,
      backgroundLoading,
      applyRemoteBackground,
      pickLocalBackground,
      selectBackgroundFromHistory,
      removeBackgroundHistoryItem,
      clearBackground,
      refreshBackgroundHistory
    }),
    [
      applyRemoteBackground,
      backgroundHistory,
      backgroundImageUrl,
      backgroundLoading,
      clearBackground,
      currentBackground,
      pickLocalBackground,
      refreshBackgroundHistory,
      removeBackgroundHistoryItem,
      selectBackgroundFromHistory
    ]
  )

  return <BackgroundContext.Provider value={contextValue}>{children}</BackgroundContext.Provider>
}

export const useBackground = () => {
  const context = useContext(BackgroundContext)

  if (!context) {
    throw new Error('useBackground must be used within a BackgroundProvider')
  }

  return context
}
