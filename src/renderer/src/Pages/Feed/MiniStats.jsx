import { FaHeart } from 'react-icons/fa'
import { Bubble } from '../../Components/Bubble/Bubble'

import { useLikes } from '../../Contexts/LikeContext'
import { usePlaylists } from '../../Contexts/PlaylistsContex'
import { useEffect, useState } from 'react'
import './MiniStats.scss'
import { Section } from './Section'
import { TfiLayoutListThumbAlt } from 'react-icons/tfi'
import { MdQueueMusic } from 'react-icons/md'

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
    <Section name={'Stats'} to={'/search'}>
      <Bubble text={'likes'} number={numLikes} url={'/favourites'}>
        <FaHeart />
      </Bubble>

      <Bubble text={'Tracks'} number={numTracks} url={'/tracks'}>
        <TfiLayoutListThumbAlt />
      </Bubble>

      <Bubble text={'Playlist'} number={numLists} url={'/playlists'}>
        <MdQueueMusic />
      </Bubble>
    </Section>
  )
}
