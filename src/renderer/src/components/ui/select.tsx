import React from 'react'
import { Select as BaseSelect } from '@base-ui/react/select'
import './select.scss'

const cx = (...classes) => classes.filter(Boolean).join(' ')

const Select = ({ children, ...props }) => (
  <BaseSelect.Root {...props}>{children}</BaseSelect.Root>
)

const SelectTrigger = React.forwardRef(function SelectTrigger(
  { children, className, ...props },
  ref
) {
  return (
    <BaseSelect.Trigger className={cx('ui-select__trigger', className)} ref={ref} {...props}>
      {children}
      <BaseSelect.Icon className="ui-select__icon" aria-hidden="true">
        <svg viewBox="0 0 16 16" fill="none">
          <path d="M4 6L8 10L12 6" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
        </svg>
      </BaseSelect.Icon>
    </BaseSelect.Trigger>
  )
})

const SelectValue = React.forwardRef(function SelectValue({ className, ...props }, ref) {
  return <BaseSelect.Value className={cx('ui-select__value', className)} ref={ref} {...props} />
})

const SelectContent = React.forwardRef(function SelectContent(
  { children, className, alignItemWithTrigger = false, sideOffset = 8, ...props },
  ref
) {
  return (
    <BaseSelect.Portal>
      <BaseSelect.Positioner
        alignItemWithTrigger={alignItemWithTrigger}
        className="ui-select__positioner"
        sideOffset={sideOffset}
      >
        <BaseSelect.Popup className={cx('ui-select__content', className)} ref={ref} {...props}>
          <BaseSelect.List className="ui-select__list">{children}</BaseSelect.List>
        </BaseSelect.Popup>
      </BaseSelect.Positioner>
    </BaseSelect.Portal>
  )
})

const SelectGroup = ({ children, className, ...props }) => (
  <BaseSelect.Group className={cx('ui-select__group', className)} {...props}>
    {children}
  </BaseSelect.Group>
)

const SelectItem = React.forwardRef(function SelectItem({ children, className, ...props }, ref) {
  return (
    <BaseSelect.Item className={cx('ui-select__item', className)} ref={ref} {...props}>
      <BaseSelect.ItemText className="ui-select__item-text">{children}</BaseSelect.ItemText>
      <BaseSelect.ItemIndicator className="ui-select__item-indicator" aria-hidden="true">
        <svg viewBox="0 0 16 16" fill="none">
          <path
            d="M3.5 8.5L6.5 11.5L12.5 4.5"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
          />
        </svg>
      </BaseSelect.ItemIndicator>
    </BaseSelect.Item>
  )
})

export { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue }
