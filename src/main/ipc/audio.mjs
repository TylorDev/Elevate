import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
let audioMixer

export async function setBraveVolume(volume) {
  if (!audioMixer) {
    try {
      const packageName = 'node-audio-volume-' + 'mixer'
      audioMixer = require(packageName).NodeAudioVolumeMixer
    } catch {
      return
    }
  }

  // Obtener las sesiones de audio
  const sessions = audioMixer.getAudioSessionProcesses()

  // Buscar Brave y Google Chrome por sus nombres de proceso
  const braveSession = sessions.find((value) => value.name === 'brave.exe')
  const chromeSession = sessions.find((value) => value.name === 'Microsoft.Media.Player.exe')

  if (braveSession) {
    // Establecer el volumen de Brave
    await audioMixer.setAudioSessionVolumeLevelScalar(braveSession.pid, volume)
    console.log('El volumen de Brave se ha establecido al', volume * 100, '%')
  } else if (chromeSession) {
    // Establecer el volumen de Chrome
    await audioMixer.setAudioSessionVolumeLevelScalar(chromeSession.pid, volume)
    console.log('El volumen de Chrome se ha establecido al', volume * 100, '%')
  } else {
    console.log('Ni Brave ni Google Chrome están ejecutándose.')
  }
}
