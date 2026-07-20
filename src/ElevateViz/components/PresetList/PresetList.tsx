/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react'
import { FixedSizeList } from 'react-window'
import PresetItem from '../PresetItem/PresetItem'
import './PresetList.module.scss'

function PresetList({
  activePresetName = '',
  height,
  indexMuted = false,
  itemHeight,
  itemKey,
  items,
  onSelectPreset,
  renderActions
}: any) {
  return (
    <FixedSizeList
      height={height}
      itemCount={items.length}
      itemSize={itemHeight}
      itemKey={(index) => itemKey(items[index], index)}
      overscanCount={8}
      width="100%"
      className="preset-list"
    >
      {({ index, style }) => {
        const preset = items[index]

        if (!preset) {
          return null
        }

        return (
          <PresetItem
            active={activePresetName === preset.name}
            actions={renderActions?.(preset)}
            cover={preset.Cover}
            index={index}
            indexMuted={indexMuted}
            name={preset.name}
            onClick={() => onSelectPreset?.(preset.name)}
            style={style}
          />
        )
      }}
    </FixedSizeList>
  )
}

export default PresetList
