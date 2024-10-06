import { useEffect } from 'react'

import './Directories.scss'
import { useMini } from '../../Contexts/MiniContext'

import { DirItem } from '../../Components/DirItem/DirItem'
import { Button } from './../../Components/Button/Button'

import { MdCreateNewFolder } from 'react-icons/md'
function Directories() {
  const { getDirectories, directories, addDirectory } = useMini()

  useEffect(() => {
    if (!directories || directories.length === 0) {
      getDirectories()
    }
  }, [])

  if (directories.length === 0) {
    return (
      <div className="div">
        <Button onClick={addDirectory}>
          <MdCreateNewFolder color="green" size={35} />
        </Button>
        <ul>
          <DirItem />
          <DirItem />
          <DirItem />
        </ul>
      </div>
    )
  }
  return (
    <div className="">
      <ul>
        <h1>Directories</h1>
        <Button onClick={addDirectory}>
          <MdCreateNewFolder color="green" size={35} />
        </Button>
        {directories.map((directory) => (
          <DirItem key={directory.id} directory={directory} />
        ))}
      </ul>
    </div>
  )
}
export default Directories
