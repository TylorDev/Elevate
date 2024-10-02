import { NodeAudioVolumeMixer } from 'node-audio-volume-mixer'

export async function setBraveVolume(volume) {
  // Obtener las sesiones de audio
  const sessions = NodeAudioVolumeMixer.getAudioSessionProcesses()

  // Buscar Brave y Google Chrome por sus nombres de proceso
  const braveSession = sessions.find((value) => value.name === 'brave.exe')
  const chromeSession = sessions.find((value) => value.name === 'Microsoft.Media.Player.exe')

  if (braveSession) {
    // Establecer el volumen de Brave
    await NodeAudioVolumeMixer.setAudioSessionVolumeLevelScalar(braveSession.pid, volume)
    console.log('El volumen de Brave se ha establecido al', volume * 100, '%')
  } else if (chromeSession) {
    // Establecer el volumen de Chrome
    await NodeAudioVolumeMixer.setAudioSessionVolumeLevelScalar(chromeSession.pid, volume)
    console.log('El volumen de Chrome se ha establecido al', volume * 100, '%')
  } else {
    console.log('Ni Brave ni Google Chrome están ejecutándose.')
  }
}
