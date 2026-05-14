import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LuBell,
  LuChevronDown,
  LuCopy,
  LuMinus,
  LuPanelLeftClose,
  LuPanelRightClose,
  LuPin,
  LuRefreshCw,
  LuSearch,
  LuSlidersHorizontal
} from 'react-icons/lu'
import { RxCross2 } from 'react-icons/rx'
import { useGlobalSearch } from '../../Contexts/GlobalSearchContext'
import SearchOverlay from './SearchOverlay'
import './StatusBar.scss'

const developerLinks = [
  { id: 'github', label: 'GitHub' },
  { id: 'portfolio', label: 'Portfolio' }
]

function StatusIconButton({ title, isActive = false, onClick, children }) {
  return (
    <button
      className={isActive ? 'status-bar__icon-button is-active' : 'status-bar__icon-button'}
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={isActive}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

function StatusBar({ isHeaderHidden, isQueueHidden, onToggleHeader, onToggleQueue }) {
  const [avatarBroken, setAvatarBroken] = useState(false)
  const navigate = useNavigate()
  const { isOpen, toggleSearch } = useGlobalSearch()
  const [windowState, setWindowState] = useState({
    isMaximized: false,
    isMinimized: false,
    isAlwaysOnTop: false,
    platform: 'unknown'
  })
  const searchTriggerRef = useRef(null)

  useEffect(() => {
    let isMounted = true
    const windowControls = window.electron?.windowControls

    if (!windowControls) {
      return undefined
    }

    void windowControls.getState().then((state) => {
      if (isMounted && state) {
        setWindowState(state)
      }
    })

    const unsubscribe = windowControls.onStateChange((state) => {
      if (isMounted && state) {
        setWindowState(state)
      }
    })

    return () => {
      isMounted = false
      unsubscribe?.()
    }
  }, [])

  const isWindows = windowState.platform === 'win32'
  const maximizeLabel = windowState.isMaximized ? 'Restaurar ventana' : 'Maximizar ventana'
  const statusBarClassName = [
    'status-bar',
    isHeaderHidden && isQueueHidden ? 'status-bar--solid' : 'status-bar--transparent'
  ].join(' ')

  return (
    <header className={statusBarClassName}>
      <div className="status-bar__section status-bar__section--left">
        <StatusIconButton title="Settings" onClick={() => navigate('/settings')}>
          <LuSlidersHorizontal />
        </StatusIconButton>
        <StatusIconButton
          title={windowState.isAlwaysOnTop ? 'Disable always on top' : 'Enable always on top'}
          isActive={windowState.isAlwaysOnTop}
          onClick={() => void window.electron.windowControls.toggleAlwaysOnTop()}
        >
          <LuPin />
        </StatusIconButton>
      </div>

      <div className="status-bar__section status-bar__section--center">
        <button
          ref={(node) => {
            searchTriggerRef.current = node
          }}
          className={isOpen ? 'status-bar__search is-active' : 'status-bar__search'}
          type="button"
          aria-label="Abrir busqueda global"
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          onClick={toggleSearch}
        >
          <LuSearch />
          <span className="status-bar__search-placeholder">Search songs, playlists, directories...</span>
        </button>
        <SearchOverlay triggerRef={searchTriggerRef} />
      </div>

      <div className="status-bar__section status-bar__section--right">
        <StatusIconButton title="Actualizar o buscar actualizacion">
          <LuRefreshCw />
        </StatusIconButton>
        <StatusIconButton
          title={isHeaderHidden ? 'Mostrar header' : 'Ocultar header'}
          isActive={isHeaderHidden}
          onClick={onToggleHeader}
        >
          <LuPanelLeftClose />
        </StatusIconButton>
        <StatusIconButton
          title={isQueueHidden ? 'Mostrar queue panel' : 'Ocultar queue panel'}
          isActive={isQueueHidden}
          onClick={onToggleQueue}
        >
          <LuPanelRightClose />
        </StatusIconButton>
        <StatusIconButton title="Notificaciones y errores">
          <LuBell />
        </StatusIconButton>

        <div className="status-bar__profile" aria-label="Redes del desarrollador">
          <button
            className="status-bar__profile-trigger"
            type="button"
            title="Redes del desarrollador"
            aria-haspopup="true"
          >
            {avatarBroken ? (
              <span className="status-bar__avatar-fallback">TD</span>
            ) : (
              <img
                className="status-bar__avatar-image"
                src="https://github.com/TylorDev.png"
                alt="Developer avatar"
                onError={() => setAvatarBroken(true)}
              />
            )}
            <LuChevronDown />
          </button>

          <div className="status-bar__profile-menu" role="menu" aria-label="Enlaces del desarrollador">
            {developerLinks.map((link) => (
              <button key={link.id} className="status-bar__menu-item" type="button" role="menuitem">
                {link.label}
              </button>
            ))}
          </div>
        </div>

        {isWindows ? (
          <div className="status-bar__window-controls" aria-label="Controles de ventana">
            <button
              className="status-bar__window-button"
              type="button"
              title="Minimizar ventana"
              aria-label="Minimizar ventana"
              onClick={() => void window.electron.windowControls.minimize()}
            >
              <LuMinus />
            </button>
            <button
              className="status-bar__window-button"
              type="button"
              title={maximizeLabel}
              aria-label={maximizeLabel}
              onClick={() => void window.electron.windowControls.toggleMaximize()}
            >
              {windowState.isMaximized ? <LuCopy /> : <div className="status-bar__window-square" />}
            </button>
            <button
              className="status-bar__window-button status-bar__window-button--close"
              type="button"
              title="Cerrar ventana"
              aria-label="Cerrar ventana"
              onClick={() => void window.electron.windowControls.close()}
            >
              <RxCross2 />
            </button>
          </div>
        ) : null}
      </div>
    </header>
  )
}

export default StatusBar
