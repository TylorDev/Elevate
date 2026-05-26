import {
  useState,
  useRef,
  useEffect,
  memo,
  useCallback,
  forwardRef,
  useImperativeHandle
} from 'react'
import { createPortal } from 'react-dom'
import { HiChevronLeft, HiChevronRight, HiOutlineDotsVertical } from 'react-icons/hi'
import { LuCheck } from 'react-icons/lu'
import './OverflowMenu.scss'

function isSubmenuOption(option) {
  return option?.type === 'single-select' || option?.type === 'multi-select'
}

function isInputOption(option) {
  return option?.type === 'input'
}

export const OverflowMenu = memo(
  forwardRef(function OverflowMenu(
    {
      options,
      onSelect,
      className = '',
      showButton = true,
      anchorRef = null,
      menuClassName = '',
      onMenuMouseEnter,
      onMenuMouseLeave,
      onOpenChange,
      horizontalAlign = 'default',
      menuWidth = 240
    },
    ref
  ) {
    const [isOpen, setIsOpen] = useState(false)
    const [menuPos, setMenuPos] = useState({ top: 0, left: 0 })
    const [activeSubmenuId, setActiveSubmenuId] = useState(null)
    const menuRef = useRef(null)
    const btnRef = useRef(null)
    const activeSubmenu = options.find(
      (option) => option.id === activeSubmenuId && isSubmenuOption(option)
    )

    const closeMenu = useCallback(() => {
      if (activeSubmenu?.onClose) {
        activeSubmenu.onClose()
      }

      setActiveSubmenuId(null)
      setIsOpen(false)
      onOpenChange?.(false)
    }, [activeSubmenu, onOpenChange])

    const openMenu = useCallback(
      (e) => {
        if (e?.type === 'contextmenu') {
          e.preventDefault()
          e.stopPropagation()

          const menuHeight = options.length * 42 + 16
          const resolvedMenuWidth = Number(menuWidth) || 240

          let top = e.clientY
          let left = e.clientX

          if (top + menuHeight > window.innerHeight) {
            top = window.innerHeight - menuHeight - 10
          }
          if (left + resolvedMenuWidth > window.innerWidth) {
            left = window.innerWidth - resolvedMenuWidth - 10
          }

          setMenuPos({ top, left })
          setActiveSubmenuId(null)
          setIsOpen(true)
          onOpenChange?.(true)
          return
        }

        const anchorElement = anchorRef?.current || btnRef.current

        if (anchorElement) {
          const rect = anchorElement.getBoundingClientRect()
          const spaceBelow = window.innerHeight - rect.bottom
          const menuHeight = options.length * 42 + 16
          const resolvedMenuWidth = Number(menuWidth) || 240

          let top = rect.bottom + 5
          let left =
            horizontalAlign === 'end' ? rect.right - resolvedMenuWidth : rect.left - 190

          if (spaceBelow < menuHeight && rect.top > menuHeight) {
            top = rect.top - menuHeight - 5
          }

          if (left < 10) left = 10
          const rightBoundary = window.innerWidth - resolvedMenuWidth - 10
          if (left > rightBoundary) left = rightBoundary

          setMenuPos({ top, left })
          setActiveSubmenuId(null)
          setIsOpen(true)
          onOpenChange?.(true)
        }
      },
      [anchorRef, horizontalAlign, menuWidth, onOpenChange, options.length]
    )

    const toggleMenu = useCallback(
      (e) => {
        e.stopPropagation()
        if (!isOpen) {
          openMenu(e)
        } else {
          closeMenu()
        }
      },
      [closeMenu, isOpen, openMenu]
    )

    const handleSubmenuBack = useCallback(() => {
      if (activeSubmenu?.onClose) {
        activeSubmenu.onClose()
      }

      setActiveSubmenuId(null)
    }, [activeSubmenu])

    useImperativeHandle(ref, () => ({
      open: (e) => openMenu(e),
      close: () => closeMenu()
    }))

    useEffect(() => {
      const handleClickOutside = (event) => {
        const clickedAnchor = anchorRef?.current?.contains?.(event.target)

        if (menuRef.current && !menuRef.current.contains(event.target) && !clickedAnchor) {
          closeMenu()
        }
      }

      const handleViewportChange = () => {
        closeMenu()
      }

      if (isOpen) {
        document.addEventListener('mousedown', handleClickOutside)
        window.addEventListener('resize', handleViewportChange)
        window.addEventListener('scroll', handleViewportChange, true)
      }

      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
        window.removeEventListener('resize', handleViewportChange)
        window.removeEventListener('scroll', handleViewportChange, true)
      }
    }, [anchorRef, closeMenu, isOpen])

    const renderedOptions = activeSubmenu?.items || options

    return (
      <div className={`overflow-menu-container ${className}`}>
        {showButton && (
          <button
            className="overflow-menu-btn"
            onClick={toggleMenu}
            ref={btnRef}
            aria-haspopup="true"
            aria-expanded={isOpen}
          >
            <HiOutlineDotsVertical />
          </button>
        )}

        {isOpen &&
          createPortal(
            <div
              className={`overflow-dropdown ${activeSubmenu ? 'is-submenu' : ''} ${menuClassName}`.trim()}
              ref={menuRef}
              style={{
                position: 'fixed',
                top: `${menuPos.top}px`,
                left: `${menuPos.left}px`,
                zIndex: 9999
              }}
              onClick={(e) => e.stopPropagation()}
              onMouseEnter={onMenuMouseEnter}
              onMouseLeave={onMenuMouseLeave}
            >
              {activeSubmenu && (
                <div className="overflow-submenu-header">
                  <button className="overflow-back-btn" onClick={handleSubmenuBack} type="button">
                    <HiChevronLeft />
                    <span>{activeSubmenu.label}</span>
                  </button>
                </div>
              )}

              {renderedOptions.map((option, index) => {
                const key = option.id || index
                const hasSubmenu = isSubmenuOption(option)

                if (isInputOption(option)) {
                  return (
                    <div
                      key={key}
                      className="overflow-input-row"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <input
                        autoFocus={option.autoFocus ?? false}
                        className="overflow-input"
                        disabled={option.disabled}
                        onChange={(event) => option.onValueChange?.(event.target.value)}
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => {
                          event.stopPropagation()

                          if (event.key === 'Enter') {
                            event.preventDefault()
                            option.onSubmit?.()
                            return
                          }

                          if (event.key === 'Escape') {
                            event.preventDefault()
                            option.onEscape?.()
                          }
                        }}
                        placeholder={option.placeholder || ''}
                        type="text"
                        value={option.value || ''}
                      />
                    </div>
                  )
                }

                return (
                  <div
                    key={key}
                    className={option.disabled ? 'overflow-item is-disabled' : 'overflow-item'}
                    aria-disabled={option.disabled ? 'true' : undefined}
                    title={option.tooltip || ''}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (option.disabled) {
                        return
                      }

                      if (activeSubmenu) {
                        if (activeSubmenu.type === 'multi-select') {
                          activeSubmenu.onItemToggle?.(option.id)
                          return
                        }

                        activeSubmenu.onItemSelect?.(option.id)
                        const shouldCloseSubmenu =
                          option.closeOnSelect ?? activeSubmenu.closeOnSelect ?? true

                        if (shouldCloseSubmenu) {
                          closeMenu()
                        }
                        return
                      }

                      if (hasSubmenu) {
                        option.onOpen?.()
                        setActiveSubmenuId(option.id)
                        return
                      }

                      onSelect?.(option.id)
                      closeMenu()
                    }}
                  >
                    {option.icon && <span className="overflow-icon">{option.icon}</span>}
                    <span className="overflow-label">{option.label}</span>

                    {activeSubmenu ? (
                      <span className="overflow-trailing">
                        {option.checked ? <LuCheck /> : null}
                      </span>
                    ) : hasSubmenu ? (
                      <span className="overflow-trailing">
                        <HiChevronRight />
                      </span>
                    ) : option.checked ? (
                      <span className="overflow-trailing">
                        <LuCheck />
                      </span>
                    ) : null}
                  </div>
                )
              })}
            </div>,
            document.body
          )}
      </div>
    )
  })
)
