export const validateLike = async (filePath, fileName, setCurrentLike) => {
  try {
    const { success, liked, error } = await window.electron.ipcRenderer.invoke(
      'is-song-liked',
      filePath,
      fileName
    )

    if (!success) {
      console.error('Error:', error)
      return
    }

    setCurrentLike(liked)
  } catch (error) {
    console.error('Error:', error)
  }
}
