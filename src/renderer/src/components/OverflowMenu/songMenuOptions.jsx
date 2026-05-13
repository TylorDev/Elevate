import { FaListUl, FaPlusCircle, FaRegSave, FaTrash } from 'react-icons/fa'

export const SONG_MENU_IDS = {
  ADD_TO_QUEUE: 'add to queue',
  ADD_TO_PLAYLIST: 'add to playlist',
  SAVE_AS_PLAYLIST: 'save as playlist',
  REMOVE: 'remove'
}

const BASE_SONG_MENU_OPTIONS = [
  { id: SONG_MENU_IDS.ADD_TO_QUEUE, label: 'Add to queue', icon: <FaPlusCircle /> },
  { id: SONG_MENU_IDS.ADD_TO_PLAYLIST, label: 'Add to playlist', icon: <FaListUl /> },
  { id: SONG_MENU_IDS.SAVE_AS_PLAYLIST, label: 'Guardar como playlist', icon: <FaRegSave /> },
  { id: SONG_MENU_IDS.REMOVE, label: 'Eliminar', icon: <FaTrash /> }
]

export function createSongMenuOptions({ removeDisabled = false, extraOptions = [] } = {}) {
  const options = BASE_SONG_MENU_OPTIONS.map((option) => {
    if (option.id !== SONG_MENU_IDS.REMOVE) {
      return option
    }

    return {
      ...option,
      disabled: removeDisabled
    }
  })

  if (!Array.isArray(extraOptions) || extraOptions.length === 0) {
    return options
  }

  return options.concat(extraOptions)
}
