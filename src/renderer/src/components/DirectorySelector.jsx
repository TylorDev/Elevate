import { useState } from 'react'
import { remote } from 'electron'

const DirectorySelector = () => {
  const [files, setFiles] = useState([])

  const handleSelectDirectory = async () => {
    const { canceled, filePaths } = await remote.dialog.showOpenDialog({
      properties: ['openDirectory']
    })

    if (canceled) return

    const directoryPath = filePaths[0]
    const fs = remote.require('fs')
    const path = remote.require('path')

    fs.readdir(directoryPath, (err, fileNames) => {
      if (err) {
        console.error('Error reading directory:', err)
        return
      }

      const fileList = fileNames.map((fileName) => path.join(directoryPath, fileName))
      setFiles(fileList)
    })
  }

  return (
    <div>
      <button onClick={handleSelectDirectory}>Select Directory</button>
      <ul>
        {files.map((file, index) => (
          <li key={index}>{file}</li>
        ))}
      </ul>
    </div>
  )
}

export default DirectorySelector
