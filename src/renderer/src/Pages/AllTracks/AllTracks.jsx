import './AllTracks.scss'

import { usePlaylists } from '../../Contexts/PlaylistsContex'
import { Cola } from './../../Components/Cola/Cola'
import { useParams } from 'react-router-dom'
import { useSuper } from '../../Contexts/SupeContext'

import { useEffect } from 'react'

function AllTracks() {
  const { getAllSongs, allSongs } = usePlaylists()
  const { dir } = useParams()
  const { handleResume } = useSuper()

  useEffect(() => {
    getAllSongs(1)
  }, [])

  useEffect(() => {
    if (dir === 'resume' && allSongs.length > 0) {
      // console.log('lista cargada!')
      handleResume(allSongs, 'tracks')
    }
  }, [allSongs, dir])
  return (
    <>
      {/* <PlaylistActions /> */}
      <Cola list={allSongs} name={'tracks'} />
    </>
  )
}
export default AllTracks
