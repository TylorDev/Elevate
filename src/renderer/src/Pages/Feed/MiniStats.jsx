import { FaHeart } from 'react-icons/fa'
import { Bubble } from '../../Components/Bubble/Bubble'
import { SuperLink } from './SuperLink'
import { useLikes } from '../../Contexts/LikeContext'
import { usePlaylists } from '../../Contexts/PlaylistsContex'
import { useEffect, useState } from 'react'

export function MiniStats() {
  const { likes, getLikes } = useLikes()
  const { metadata, playlists } = usePlaylists()

  const [numLikes, setNumLikes] = useState(0)
  const [numTracks, setNumTracks] = useState(0)
  const [numLists, setNumLists] = useState(0)
  useEffect(() => {
    if (likes && likes.fileInfos && metadata && playlists) {
      setNumLikes(likes.fileInfos.length)
      setNumTracks(metadata.length)
      setNumLists(playlists.length)
    } else {
      getLikes()
    }
  }, [likes, metadata, playlists])

  return (
    <div className="mini-stats">
      <SuperLink name={'stats'} desc={'explore stats'} url={'/search'} />

      <Bubble text={'likes'} number={numLikes} url={'/favourites'}>
        <FaHeart />
      </Bubble>

      <Bubble text={'Tracks'} number={numTracks} url={'/tracks'}>
        <FaHeart />
      </Bubble>

      <Bubble text={'Playlist'} number={numLists} url={'/playlists'}>
        <FaHeart />
      </Bubble>
    </div>
  )
}
