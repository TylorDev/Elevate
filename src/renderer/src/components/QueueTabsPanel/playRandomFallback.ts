import { Bounce, toast } from 'react-toastify'
import { dedupedInvoke } from '../../Contexts/utils'

export async function playRandomPlaylistOrDirectory({ addPlaylisthistory, playQueueShuffled, t }) {
  try {
    const randomPlaylist = await dedupedInvoke('get-random-playlist')

    if (randomPlaylist?.path) {
      const playlistData = await dedupedInvoke('get-list', randomPlaylist.path)
      const tracks = playlistData?.processedData || []

      if (tracks.length > 0) {
        playQueueShuffled(tracks, randomPlaylist.path)
        addPlaylisthistory?.(randomPlaylist.path)
        return true
      }
    }

    const randomDirectory = await dedupedInvoke('get-random-directory')

    if (randomDirectory?.path) {
      const tracks = await dedupedInvoke('get-audio-in-directory', randomDirectory.path)

      if (Array.isArray(tracks) && tracks.length > 0) {
        playQueueShuffled(tracks, `folder:${randomDirectory.path}`)
        return true
      }
    }

    return false
  } catch (error) {
    console.error('Error playing random fallback source:', error)
    toast.error(error?.message || t('queue.randomFallbackError'), {
      position: 'bottom-right',
      autoClose: 3000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
      progress: undefined,
      theme: 'dark',
      transition: Bounce
    })
    return false
  }
}
