export const formatDuration = (seconds) => {
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  let duration = ''

  if (hrs > 0) {
    duration += `${hrs}h `
  }

  if (mins > 0 || hrs > 0) {
    // Mostrar minutos si hay horas o minutos
    duration += `${mins}m `
  }

  duration += `${secs}s`

  return duration.trim() // Elimina cualquier espacio en blanco al final
}

export function formatTimestamp(timestamp) {
  const date = new Date(timestamp)

  const options = { day: 'numeric', month: 'long', year: 'numeric' }
  return date.toLocaleDateString('en-US', options)
}
