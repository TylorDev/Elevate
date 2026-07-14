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
import { OverflowMenu } from '../OverflowMenu/OverflowMenu'
import { useGlobalSearch } from '../../Contexts/GlobalSearchContext'
import { useI18n } from '../../Contexts/I18nContext'
import { useSuper } from '../../Contexts/SupeContext'
import SearchOverlay from './SearchOverlay'
import { WindowPresetPicker } from './WindowPresetPicker'
import './StatusBar.scss'

const developerLinks = [
  { id: 'github', label: 'GitHub', url: 'https://github.com/TylorDev' },
  { id: 'updates', label: 'Updates', url: 'https://github.com/TylorDev/Elevate/releases' }
]
const PROFILE_MENU_CLOSE_DELAY_MS = 3000

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
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false)
  const searchTriggerRef = useRef(null)
  const profileMenuRef = useRef(null)
  const profileContainerRef = useRef(null)
  const profileTriggerRef = useRef(null)
  const profileMenuCloseTimeoutRef = useRef(null)
  const profileMenuModeRef = useRef(null)
  const isProfileMenuOpenRef = useRef(false)

  const clearProfileMenuCloseTimer = () => {
    if (profileMenuCloseTimeoutRef.current) {
      clearTimeout(profileMenuCloseTimeoutRef.current)
      profileMenuCloseTimeoutRef.current = null
    }
  }

  const syncProfileMenuOpenState = (nextOpen) => {
    isProfileMenuOpenRef.current = nextOpen
    setIsProfileMenuOpen(nextOpen)

    if (!nextOpen) {
      profileMenuModeRef.current = null
      clearProfileMenuCloseTimer()
    }
  }

  const openProfileMenu = (mode, event) => {
    clearProfileMenuCloseTimer()
    profileMenuModeRef.current = mode

    if (!isProfileMenuOpenRef.current) {
      profileMenuRef.current?.open(event)
      return
    }

    syncProfileMenuOpenState(true)
  }

  const closeProfileMenu = () => {
    clearProfileMenuCloseTimer()
    profileMenuModeRef.current = null
    profileMenuRef.current?.close()
    syncProfileMenuOpenState(false)
  }

  const scheduleProfileMenuClose = () => {
    if (!isProfileMenuOpenRef.current || profileMenuModeRef.current !== 'hover') {
      return
    }

    clearProfileMenuCloseTimer()
    profileMenuCloseTimeoutRef.current = setTimeout(() => {
      closeProfileMenu()
    }, PROFILE_MENU_CLOSE_DELAY_MS)
  }

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

  useEffect(() => () => clearProfileMenuCloseTimer(), [])

  const isWindows = windowState.platform === 'win32'
  const maximizeLabel = windowState.isMaximized
    ? t('actions.restoreWindow')
    : t('actions.maximizeWindow')
  const profileMenuOptions = developerLinks.map((link) => ({
    id: link.id,
    label: link.label
  }))
  const handleProfileMenuSelect = (selectedId) => {
    const selectedLink = developerLinks.find((link) => link.id === selectedId)

    if (!selectedLink?.url) {
      return
    }

    void window.electron?.windowControls?.openExternal?.(selectedLink.url)
  }
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

        <div
          ref={profileContainerRef}
          className="status-bar__profile"
          aria-label={t('navigation.developerSocials')}
          onMouseEnter={() => {
            clearProfileMenuCloseTimer()

            if (profileMenuModeRef.current === 'click') {
              return
            }

            openProfileMenu('hover')
          }}
          onMouseLeave={scheduleProfileMenuClose}
        >
          <button
            ref={profileTriggerRef}
            className={isProfileMenuOpen ? 'status-bar__profile-trigger is-open' : 'status-bar__profile-trigger'}
            type="button"
            title={t('navigation.developerSocials')}
            aria-haspopup="menu"
            aria-expanded={isProfileMenuOpen}
            onClick={(event) => {
              event.stopPropagation()

              if (isProfileMenuOpenRef.current && profileMenuModeRef.current === 'click') {
                closeProfileMenu()
                return
              }

              openProfileMenu('click', event)
            }}
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

          <OverflowMenu
            ref={profileMenuRef}
            anchorRef={profileContainerRef}
            options={profileMenuOptions}
            onSelect={handleProfileMenuSelect}
            showButton={false}
            horizontalAlign="end"
            menuWidth={176}
            menuClassName="status-bar__profile-overflow"
            onMenuMouseEnter={clearProfileMenuCloseTimer}
            onMenuMouseLeave={scheduleProfileMenuClose}
            onOpenChange={syncProfileMenuOpenState}
          />
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
