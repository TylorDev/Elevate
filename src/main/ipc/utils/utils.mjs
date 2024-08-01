import axios from 'axios'
import { load } from 'cheerio'
import { parseFile } from 'music-metadata'
import path from 'path'
import fs from 'fs'

const fetchSongData = async (query) => {
  try {
    const response = await axios.get(
      `https://songdata.io/search?query=${encodeURIComponent(query)}`
    )
    const html = response.data

    // Usar cheerio para parsear el HTML
    const $ = load(html)

    // Obtener el primer <td> con clase "table_object"
    const firstTableObject = $('tbody .table_object').first()

    // Obtener nombre, artista y bpm
    const nameElement = firstTableObject.find('.table_name').first()
    const artistElement = firstTableObject.find('.table_artist').first()
    const trackBpm = firstTableObject.find('.table_bpm').first()

    // Extraer y devolver el texto
    return {
      Name: nameElement.text().trim() || 'No name found',
      Artist: artistElement.text().trim() || 'No artist found',
      BPM: trackBpm.text().trim() || 'No bpm found'
    }
  } catch (error) {
    console.error('Error fetching the data:', error)
    return {
      Name: 'Error',
      Artist: 'Error',
      BPM: 'Error'
    }
  }
}

export async function getFileInfoWithSongData(common) {
  try {
    const filePath = common.filePath
    const { format } = await parseFile(filePath)
    const fileName = path.basename(filePath, path.extname(filePath))
    const duration = format.duration || 0

    const query = (() => {
      if (common.title && common.artist) {
        return `${common.title}-${common.artist}`
      } else if (!common.title && common.artist) {
        return `${fileName}-${common.artist}`
      } else if (common.title && !common.artist) {
        return common.title
      } else {
        return fileName
      }
    })()

    // Obtener datos de la canción
    const songData = await fetchSongData(query)
    console.error(songData)

    return {
      fileName,
      duration,
      ...songData,
      ...common
    }
  } catch (error) {
    console.error(`Error processing file ${common.filePath}:`, error)
    return null
  }
}

export async function getFileInfos(filePaths) {
  return Promise.all(
    filePaths.map(async (filePath) => {
      try {
        const stats = fs.statSync(filePath)
        const { common, format } = await parseFile(filePath)
        const fileName = path.basename(filePath, path.extname(filePath))
        const duration = format.duration || 0

        return {
          filePath,
          fileName,
          size: stats.size,
          duration,
          ...common
        }
      } catch (error) {
        console.error(`Error processing file ${filePath}:`, error)
        return null
      }
    })
  ).then((fileInfos) => fileInfos.filter((info) => info !== null))
}

export async function processM3UFile(m3uFilePath, baseDir) {
  try {
    // Lee el contenido del archivo M3U
    const fileContent = await fs.promises.readFile(m3uFilePath, 'utf-8')
    const relativePaths = fileContent.split('\n').filter((line) => line.trim() !== '')

    // Convierte rutas relativas a rutas absolutas
    const absolutePaths = relativePaths.map((relPath) => path.resolve(baseDir, relPath.trim()))

    // Usa getFileInfos para obtener los metadatos de los archivos listados en el M3U
    return getFileInfos(absolutePaths)
  } catch (error) {
    console.error('Error processing M3U file:', error)
    return []
  }
}
const audioExtensions = ['.mp3', '.wav', '.flac']
export function getAllAudioFiles(dirPath) {
  let audioFiles = []

  function walkDirectory(currentPath) {
    const files = fs.readdirSync(currentPath)
    for (const file of files) {
      const fullPath = path.join(currentPath, file)
      const stats = fs.statSync(fullPath)

      if (stats.isDirectory()) {
        walkDirectory(fullPath)
      } else if (stats.isFile() && audioExtensions.includes(path.extname(fullPath))) {
        audioFiles.push(fullPath)
      }
    }
  }

  walkDirectory(dirPath)
  return audioFiles
}
