import { useEffect, useRef, useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  LuAudioWaveform,
  LuChartColumnIncreasing,
  LuChevronDown,
  LuCopy,
  LuMinus,
  LuPanelLeftClose,
  LuPanelRightClose,
  LuPin,
  LuSearch,
  LuSlidersHorizontal
} from 'react-icons/lu'
import { RxCross2 } from 'react-icons/rx'
import { useGlobalSearch } from '../../Contexts/GlobalSearchContext'
import { useI18n } from '../../Contexts/I18nContext'
import { useSuper } from '../../Contexts/SupeContext'
import SearchOverlay from './SearchOverlay'
import { WindowPresetPicker } from './WindowPresetPicker'
import './StatusBar.scss'

const developerLinks = [
  { id: 'github', label: 'GitHub' },
  { id: 'portfolio', label: 'Portfolio' }
]

const compactHeaderNavItems = [
  {
    to: '/feed',
    title: 'Feed',
    icon: LuAudioWaveform,
    onClick: 'awaken'
  },
  {
    to: '/statistics',
    title: 'Statistics',
    icon: LuChartColumnIncreasing
  },
  {
    to: '/settings',
    title: 'Settings',
    icon: LuSlidersHorizontal
  }
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

function StatusBar({
  isCompactHeaderMode = false,
  isHeaderHidden,
  isQueueHidden,
  onToggleHeader,
  onToggleQueue
}) {
  const [avatarBroken, setAvatarBroken] = useState(false)
  const { handleAwaken } = useSuper()
  const { isOpen, toggleSearch } = useGlobalSearch()
  const { t } = useI18n()
  const [windowState, setWindowState] = useState({
    isMaximized: false,
    isMinimized: false,
    isAlwaysOnTop: false,
    platform: 'unknown'
  })
  const [isWindowPresetOpen, setIsWindowPresetOpen] = useState(false)
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
  const maximizeLabel = windowState.isMaximized
    ? t('actions.restoreWindow')
    : t('actions.maximizeWindow')
  const statusBarClassName = [
    'status-bar',
    isHeaderHidden && isQueueHidden ? 'status-bar--solid' : 'status-bar--transparent'
  ].join(' ')

  return (
    <header className={statusBarClassName}>
      <div className="left-buttons">
        {!isCompactHeaderMode ? (
          <StatusIconButton
            title={isHeaderHidden ? t('actions.showHeader') : t('actions.hideHeader')}
            isActive={isHeaderHidden}
            onClick={onToggleHeader}
          >
            <LuPanelLeftClose />
          </StatusIconButton>
        ) : null}
      </div>

      <div className="Center">
        {isCompactHeaderMode ? (
          <nav className="status-bar__compact-nav" aria-label={t('navigation.compactMain')}>
            {compactHeaderNavItems.map((item) => {
              const Icon = item.icon

              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    isActive
                      ? 'status-bar__compact-link status-bar__compact-link--active'
                      : 'status-bar__compact-link'
                  }
                  title={item.title}
                  aria-label={item.title}
                  onClick={() => {
                    if (item.onClick === 'awaken') {
                      handleAwaken(true)
                    }
                  }}
                >
                  <Icon />
                </NavLink>
              )
            })}
          </nav>
        ) : null}
        <button
          ref={(node) => {
            searchTriggerRef.current = node
          }}
          className={isOpen ? 'status-bar__search is-active' : 'status-bar__search'}
          type="button"
          aria-label={t('actions.openGlobalSearch')}
          title={t('actions.openGlobalSearch')}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          onClick={toggleSearch}
        >
          <LuSearch />
          <span className="status-bar__search-placeholder">
            {t('statusBar.searchPlaceholder')}
          </span>
        </button>
        <SearchOverlay triggerRef={searchTriggerRef} />
      </div>

      <div className="RightButtons">
        <StatusIconButton
          title={
            windowState.isAlwaysOnTop
              ? t('actions.disableAlwaysOnTop')
              : t('actions.enableAlwaysOnTop')
          }
          isActive={windowState.isAlwaysOnTop}
          onClick={() => void window.electron.windowControls.toggleAlwaysOnTop()}
        >
          <LuPin />
        </StatusIconButton>
        <StatusIconButton
          title={isQueueHidden ? t('actions.showQueuePanel') : t('actions.hideQueuePanel')}
          isActive={isQueueHidden}
          onClick={onToggleQueue}
        >
          <LuPanelRightClose />
        </StatusIconButton>

        <div className="status-bar__profile" aria-label={t('navigation.developerSocials')}>
          <button
            className="status-bar__profile-trigger"
            type="button"
            title={t('navigation.developerSocials')}
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

          <div
            className="status-bar__profile-menu"
            role="menu"
            aria-label={t('navigation.developerLinks')}
          >
            {developerLinks.map((link) => (
              <button key={link.id} className="status-bar__menu-item" type="button" role="menuitem">
                {link.label}
              </button>
            ))}
          </div>
        </div>

        {isWindows ? (
          <div className="status-bar__window-controls" aria-label={t('navigation.windowControls')}>
            <WindowPresetPicker
              isOpen={isWindowPresetOpen}
              onToggle={() => setIsWindowPresetOpen((current) => !current)}
              onClose={() => setIsWindowPresetOpen(false)}
            />
            <button
              className="status-bar__window-button"
              type="button"
              title={t('actions.minimizeWindow')}
              aria-label={t('actions.minimizeWindow')}
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
              title={t('actions.closeWindow')}
              aria-label={t('actions.closeWindow')}
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
