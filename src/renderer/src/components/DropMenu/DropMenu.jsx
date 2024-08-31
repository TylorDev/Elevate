import { useState, useEffect, useRef } from 'react'
import './DropMenu.scss'
import { HiOutlineDotsVertical } from 'react-icons/hi'
import { Button } from './../Button/Button'

const DropdownMenu = ({ options, onSelect }) => {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef(null)

  const toggleMenu = (event) => {
    event.stopPropagation() // Evita que el clic se propague y cierre el menú
    setIsOpen(!isOpen)
  }

  const handleClickOutside = (event) => {
    if (menuRef.current && !menuRef.current.contains(event.target)) {
      setIsOpen(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    } else {
      document.removeEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  return (
    <div className="dropdown" ref={menuRef}>
      <Button className="dropdown__button" onClick={toggleMenu}>
        <HiOutlineDotsVertical />
      </Button>
      {isOpen && (
        <ul className="dropdown__menu">
          {options.map((option, index) => (
            <li
              key={index}
              className="dropdown__item"
              onClick={(event) => {
                event.stopPropagation() // Evita que el clic cierre el menú
                onSelect(option)
                setIsOpen(false)
              }}
            >
              {option}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default DropdownMenu
