import { useEffect } from 'react'

import './Directories.scss'
import { useMini } from '../../Contexts/MiniContext'

import { DirItem } from '../../Components/DirItem/DirItem'
import { Button } from './../../Components/Button/Button'
import { usePlaylists } from '../../Contexts/PlaylistsContex'
import { MdCreateNewFolder } from 'react-icons/md'
function Directories() {
  const { getDirectories, directories } = useMini()
  const { selectFiles } = usePlaylists()
  useEffect(() => {
    if (directories) {
      getDirectories()
    }
  }, [])

  return (
    <div className="">
      <ul>
        <h1>Directories</h1>
        <Button onClick={selectFiles}>
          <MdCreateNewFolder />
        </Button>
        {directories.map((directory) => (
          <DirItem key={directory.id} directory={directory} />
        ))}
      </ul>
    </div>
  )
}
export default Directories
