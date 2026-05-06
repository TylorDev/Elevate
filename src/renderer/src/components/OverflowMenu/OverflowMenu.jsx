import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { HiOutlineDotsVertical } from 'react-icons/hi'
import './OverflowMenu.scss'

export function OverflowMenu({ options, onSelect, className = '' }) {
  const [isOpen, setIsOpen] = useState(false)
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 })
  const menuRef = useRef(null)
  const btnRef = useRef(null)

  const toggleMenu = (e) => {
    e.stopPropagation()
    if (!isOpen && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom

      let top = rect.bottom + 5
      let left = rect.left - 150

      if (spaceBelow < 200) {
        top = rect.top - (options.length * 40 + 20) // Estimación de altura
      }

      if (left < 10) left = 10
      if (left + 180 > window.innerWidth) left = window.innerWidth - 190

      setMenuPos({ top, left })
    }
    setIsOpen(!isOpen)
  }

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      window.addEventListener('scroll', () => setIsOpen(false), true)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      window.removeEventListener('scroll', () => setIsOpen(false), true)
    }
  }, [isOpen])

  return (
    <div className={`overflow-menu-container ${className}`}>
      <button
        className="overflow-menu-btn"
        onClick={toggleMenu}
        ref={btnRef}
      >
        <HiOutlineDotsVertical />
      </button>

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
              key={index}
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
}
