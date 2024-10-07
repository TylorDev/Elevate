import { useParams, useSearchParams } from 'react-router-dom'
import './DirPage.scss'
import { useEffect, useState } from 'react'
import { useMini } from '../../Contexts/MiniContext'
import { Cola } from './../../Components/Cola/Cola'
import DropdownMenu from '../../Components/DropMenu/DropMenu'
import { FaPlay } from 'react-icons/fa'
import { Button } from './../../Components/Button/Button'
import { GoPencil } from 'react-icons/go'
import { formatDuration } from '../../../timeUtils'
import { useSuper } from '../../Contexts/SupeContext'

function DirPage() {
  const { directory, play } = useParams()
  const { PlayQueue } = useSuper()
  const { getDirFiles, getDirectoryData } = useMini()

  const [currentDir, setCurrentDir] = useState([])
  const folderPath = directory

  const [folderData, setFolderData] = useState()
  const [searchParams] = useSearchParams() // Hook para obtener los query params

  const songName = searchParams.get('song') // Obtener el valor del parámetro 'name'

  useEffect(() => {
    if (!folderData) {
      getDirectoryData(setFolderData, folderPath)
    }
  }, [folderData, folderPath]) // Dependencias del efecto

  const handleSelect = (option) => {
    console.log(`Selected option: ${option}`)
  }

  // const { dir } = useParams()
  useEffect(() => {
    getDirFiles(setCurrentDir, folderPath)
  }, [])

  useEffect(() => {
    if (play === 'true' && currentDir) {
      PlayQueue(currentDir, 'tracks')
    }
  }, [currentDir, play])

  // useEffect(() => {
  //   if (dir === 'resume' && currentDir) {
  //     handleResume(currentDir, 'Directory')
  //   }
  // }, [currentDir, dir])

  const getLastPart = (path) => {
    // Divide la cadena por el separador de directorios y toma la última parte
    const parts = path.split('\\')
    return parts[parts.length - 1]
  }
  if (folderData)
    return (
      <div className="PlaylistPage">
        <div className="plg-controls">
          <div className="plg">
            <div className="plg-cover">
              <img
                src="https://i.pinimg.com/736x/d5/db/17/d5db1719cc626f12e9fdae3ac8a829ea.jpg"
                alt=""
              />
            </div>
            <div className="pgl-name">{getLastPart(folderPath)}</div>

            <div className="pgl-time">{'00-00-0000'}</div>
            <div className="pgl-data">
              <span> Folder •</span>
              <span> {folderData.totalTracks} tracks •</span>
              <span> {formatDuration(folderData.totalDuration)} </span>
            </div>
            <div className="pgl-buttton">
              <Button>
                <GoPencil />{' '}
              </Button>
              <Button
                onClick={() => {
                  PlayQueue(currentDir, 'tracks')
                  console.log('primera cancion:', currentDir[0])
                  console.log('lista completa', currentDir)
                }}
              >
                <FaPlay />
              </Button>
              <DropdownMenu options={[]} onSelect={handleSelect} />
            </div>
          </div>
        </div>

        <div className="plg-cola">
          <Cola list={currentDir} name={`folder:${folderPath}`} />
        </div>
      </div>
    )
}
export default DirPage
