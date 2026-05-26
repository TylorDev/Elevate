import { useCallback, useEffect, useRef } from 'react'
import { LuLayoutGrid } from 'react-icons/lu'
import './WindowPresetPicker.scss'

const GRID_CELLS = [
  { id: 'top-left', area: 'tl', label: 'Top left' },
  { id: 'top-right', area: 'tr', label: 'Top right' },
  { id: 'bottom-left', area: 'bl', label: 'Bottom left' },
  { id: 'bottom-right', area: 'br', label: 'Bottom right' }
]

const HALF_PRESETS = [
  { id: 'top', area: 'top', cells: ['top-left', 'top-right'], label: 'Top' },
  { id: 'left', area: 'left', cells: ['top-left', 'bottom-left'], label: 'Left' },
  { id: 'right', area: 'right', cells: ['top-right', 'bottom-right'], label: 'Right' },
  { id: 'bottom', area: 'bottom', cells: ['bottom-left', 'bottom-right'], label: 'Bottom' }
]

export function WindowPresetPicker({ isOpen, onToggle, onClose }) {
  const rootRef = useRef(null)

  const closePicker = useCallback(() => {
    onClose?.()
  }, [onClose])

  useEffect(() => {
    if (!isOpen) {
      return undefined
    }

    const handleClickOutside = (event) => {
      if (rootRef.current?.contains(event.target)) {
        return
      }

      closePicker()
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        closePicker()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [closePicker, isOpen])

  const applyPreset = useCallback(
    async (cells) => {
      const result = await window.electron.windowControls.applyGridPreset({ cells })

      if (result?.success) {
        closePicker()
      }
    },
    [closePicker]
  )

  const triggerClassName = [
    'status-bar__icon-button',
    'status-bar__window-preset-trigger',
    isOpen ? 'is-active' : ''
  ].join(' ')

  return (
    <div className="window-preset-picker" ref={rootRef}>
      <button
        className={triggerClassName}
        type="button"
        title="Areas"
        aria-label="Areas"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={onToggle}
      >
        <LuLayoutGrid />
      </button>

      {isOpen ? (
        <div
          className="window-preset-picker__panel"
          role="dialog"
          aria-label="Window area picker"
        >
          <div className="window-preset-picker__layout">
            {HALF_PRESETS.map((preset) => (
              <button
                key={preset.id}
                className="window-preset-picker__half"
                style={{ gridArea: preset.area }}
                type="button"
                title={preset.label}
                onClick={() => applyPreset(preset.cells)}
              />
            ))}

            {GRID_CELLS.map((cell) => (
              <button
                key={cell.id}
                className="window-preset-picker__cell"
                style={{ gridArea: cell.area }}
                type="button"
                title={cell.label}
                onClick={() => applyPreset([cell.id])}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
