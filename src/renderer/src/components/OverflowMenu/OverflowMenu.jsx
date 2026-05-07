import { useState, useRef, useEffect, memo, useCallback, forwardRef, useImperativeHandle } from 'react'
import { createPortal } from 'react-dom'
import { HiOutlineDotsVertical } from 'react-icons/hi'
import './OverflowMenu.scss'

export const OverflowMenu = memo(forwardRef(function OverflowMenu({ options, onSelect, className = '', showButton = true }, ref) {
  const [isOpen, setIsOpen] = useState(false)
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 })
  const menuRef = useRef(null)
  const btnRef = useRef(null)

  const openMenu = useCallback((e) => {
    // If it's a context menu event (right click)
    if (e.type === 'contextmenu') {
      e.preventDefault()
      e.stopPropagation()
      
      const menuHeight = options.length * 42 + 16
      const menuWidth = 200
      
      let top = e.clientY
      let left = e.clientX

      // Adjust if it goes off screen
      if (top + menuHeight > window.innerHeight) {
        top = window.innerHeight - menuHeight - 10
      }
      if (left + menuWidth > window.innerWidth) {
        left = window.innerWidth - menuWidth - 10
      }

      setMenuPos({ top, left })
      setIsOpen(true)
    } else {
      // Logic for button trigger
      if (btnRef.current) {
        const rect = btnRef.current.getBoundingClientRect()
        const spaceBelow = window.innerHeight - rect.bottom
        const menuHeight = options.length * 42 + 16

        let top = rect.bottom + 5
        let left = rect.left - 150

        if (spaceBelow < menuHeight && rect.top > menuHeight) {
          top = rect.top - menuHeight - 5
        }

        if (left < 10) left = 10
        const rightBoundary = window.innerWidth - 190
        if (left > rightBoundary) left = rightBoundary

        setMenuPos({ top, left })
        setIsOpen(true)
      }
    }
  }, [options.length])

  const toggleMenu = useCallback((e) => {
    e.stopPropagation()
    if (!isOpen) {
      openMenu(e)
    } else {
      setIsOpen(false)
    }
  }, [isOpen, openMenu])

  useImperativeHandle(ref, () => ({
    open: (e) => openMenu(e),
    close: () => setIsOpen(false)
  }))

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      window.addEventListener('resize', () => setIsOpen(false))
      window.addEventListener('scroll', () => setIsOpen(false), true)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      window.removeEventListener('resize', () => setIsOpen(false))
      window.removeEventListener('scroll', () => setIsOpen(false), true)
    }
  }, [isOpen])

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

      {isOpen && createPortal(
        <div
          className="overflow-dropdown"
          ref={menuRef}
          style={{
            position: 'fixed',
            top: `${menuPos.top}px`,
            left: `${menuPos.left}px`,
            zIndex: 9999
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {options.map((option, index) => (
            <div
              key={option.id || index}
              className="overflow-item"
              onClick={(e) => {
                e.stopPropagation()
                onSelect(option.id)
                setIsOpen(false)
              }}
            >
              {option.icon && <span className="overflow-icon">{option.icon}</span>}
              <span className="overflow-label">{option.label}</span>
            </div>
          ))}
        </div>,
        document.body
      )}
    </div>
  )
}))
