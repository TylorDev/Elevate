import { ipcMain, dialog } from 'electron'
import fs from 'fs'
import path from 'path'

export function setupImageSourceHandlers() {
  ipcMain.handle('image-source:validate-remote', async (_, { url }) => {
    try {
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return { success: false, errorCode: 'invalid_url', errorMessage: 'La URL debe empezar con http:// o https://' }
      }

      const response = await fetch(url)
      if (!response.ok) {
        return { success: false, errorCode: 'http_error', errorMessage: `El servidor respondió con estado ${response.status}` }
      }

      const contentType = response.headers.get('content-type')
      if (contentType && contentType.includes('text/html')) {
        return { success: false, errorCode: 'html_response', errorMessage: 'La URL devolvió una página HTML en lugar de una imagen.' }
      }

      if (!contentType || !contentType.startsWith('image/')) {
        return { success: false, errorCode: 'unsupported_content_type', errorMessage: 'El recurso no es una imagen compatible.' }
      }

      const buffer = await response.arrayBuffer()
      const base64 = Buffer.from(buffer).toString('base64')
      const dataUrl = `data:${contentType};base64,${base64}`

      return { success: true, resolvedUrl: dataUrl, mimeType: contentType }
    } catch (error) {
      console.error('Error validating remote image:', error)
      return { success: false, errorCode: 'network_error', errorMessage: 'No se pudo conectar con el servidor de la imagen.' }
    }
  })

  ipcMain.handle('image-source:pick-local', async (event) => {
    const { BrowserWindow } = await import('electron')
    const win = BrowserWindow.fromWebContents(event.sender)
    
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      filters: [
        { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] }
      ]
    })

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, errorCode: 'canceled', errorMessage: 'Operación cancelada' }
    }

    const filePath = result.filePaths[0]
    try {
      const buffer = fs.readFileSync(filePath)
      let ext = path.extname(filePath).toLowerCase().substring(1)
      if (ext === 'jpg') ext = 'jpeg'
      const mimeType = `image/${ext}`
      const base64 = buffer.toString('base64')
      const dataUrl = `data:${mimeType};base64,${base64}`

      return { success: true, resolvedUrl: dataUrl, mimeType, filePath }
    } catch (error) {
      console.error('Error reading local file:', error)
      return { success: false, errorCode: 'read_failed', errorMessage: 'No se pudo leer la imagen seleccionada.' }
    }
  })
}
