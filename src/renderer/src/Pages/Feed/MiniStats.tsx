import { FaHeart } from 'react-icons/fa'
import { Bubble } from '../../Components/Bubble/Bubble'

import './MiniStats.scss'
import { Section } from './Section'
import { TfiLayoutListThumbAlt } from 'react-icons/tfi'
import { MdQueueMusic } from 'react-icons/md'
import { useEffect, useState } from 'react'
import { useSuper } from '../../Contexts/SupeContext'
import { useMini } from '../../Contexts/MiniContext'

export function MiniStats() {
  const [likes, setLikes] = useState()
  const [playlists, setPlaylists] = useState()
  const [tracks, setTracks] = useState()
  const { getTotalTracks, getTotalLikes, getTotalLists } = useMini()

  useEffect(() => {
    getTotalTracks(setTracks), getTotalLikes(setLikes), getTotalLists(setPlaylists)
  }, [])

  return (
    <Section name={'Stats'} to={'/search'}>
      <Bubble text={'likes'} number={likes} url={'/favourites'}>
        <FaHeart />
      </Bubble>

      <Bubble text={'Tracks'} number={tracks} url={'/tracks'}>
        <TfiLayoutListThumbAlt />
      </Bubble>

      <Bubble text={'Playlist'} number={playlists} url={'/playlists'}>
        <MdQueueMusic />
      </Bubble>
    </Section>
  )
}
