import { NodeAudioVolumeMixer } from 'node-audio-volume-mixer'

export async function setBraveVolume(volume) {
  // Obtener las sesiones de audio
  const sessions = NodeAudioVolumeMixer.getAudioSessionProcesses()

  // Buscar Google Chrome por su nombre de proceso
  const session = sessions.find((value) => value.name === 'brave.exe')

  if (session) {
    // Establecer el volumen de Google Chrome al 50%
    await NodeAudioVolumeMixer.setAudioSessionVolumeLevelScalar(session.pid, volume)
    // console.log('El volumen de Brave se ha establecido al ', volume * 100, '%')
  } else {
    console.log('Google Chrome no se está ejecutando.')
  }
}
