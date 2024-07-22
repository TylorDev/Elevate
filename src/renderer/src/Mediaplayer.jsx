import { useRef, useEffect } from 'react'

const MediaPlayer = () => {
  const audioRef = useRef(null)

  useEffect(() => {
    const audio = audioRef.current

    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: 'Sample Audio',
        artist: 'Sample Artist',
        album: 'Sample Album',
        artwork: [
          {
            src: 'https://i.pinimg.com/236x/e0/b3/d5/e0b3d588dd3b4c8a4de4dcb9045349a3.jpg',
            sizes: '300x300',
            type: 'image/jpeg'
          }
        ]
      })

      navigator.mediaSession.setActionHandler('play', () => {
        audio.play()
      })

      navigator.mediaSession.setActionHandler('pause', () => {
        audio.pause()
      })

      navigator.mediaSession.setActionHandler('seekbackward', (details) => {
        audio.currentTime = Math.max(audio.currentTime - (details.seekOffset || 10), 0)
      })

      navigator.mediaSession.setActionHandler('seekforward', (details) => {
        audio.currentTime = Math.min(audio.currentTime + (details.seekOffset || 10), audio.duration)
      })

      navigator.mediaSession.setActionHandler('previoustrack', () => {
        // Implement your logic for the previous track
      })

      navigator.mediaSession.setActionHandler('nexttrack', () => {
        // Implement your logic for the next track
      })
    }
  }, [])

  return (
    <div>
      <h1>Media Session API Example</h1>
      <img
        src="https://i.pinimg.com/236x/e0/b3/d5/e0b3d588dd3b4c8a4de4dcb9045349a3.jpg"
        alt="Cover"
        width="300"
      />
      <audio ref={audioRef} controls>
        <source
          src="G:\Disco D\MediaServer\musica 111111\NIVELES\NIVEL -  (5)\FIRST OF THE YEAR (EQUINOX) - SKRILLEX.mp3"
          type="audio/mpeg"
        />
        Your browser does not support the audio element.
      </audio>
    </div>
  )
}

export default MediaPlayer
