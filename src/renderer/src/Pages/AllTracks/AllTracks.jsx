import './AllTracks.scss'

import { usePlaylists } from '../../Contexts/PlaylistsContex'
import { Cola } from './../../Components/Cola/Cola'
import { useParams } from 'react-router-dom'
import { useSuper } from '../../Contexts/SupeContext'
import { PlaylistActions } from './../../Components/PlaylistActions/PlaylistActions'
import { useEffect } from 'react'

function AllTracks() {
  const { getAllSongs, metadata } = usePlaylists()
  const { dir } = useParams()
  const { handleResume } = useSuper()

  useEffect(() => {
    if (!metadata || metadata.length === 0) {
      getAllSongs()
    }
  }, [metadata])

  useEffect(() => {
    if (dir === 'resume' && metadata?.length > 0) {
      // console.log('lista cargada!')
      handleResume(metadata, 'tracks')
    }
  }, [metadata, dir])
  return (
    <>
      <PlaylistActions />
      <Cola list={metadata} name={'tracks'} />
    </>
  )
}
export default AllTracks
