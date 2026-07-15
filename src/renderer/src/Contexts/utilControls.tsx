export const toPlay = (mediaRef, isPlaying) => {
  if (mediaRef.current) {
    if (isPlaying) {
      mediaRef.current.pause()
    } else {
      mediaRef.current.play()
    }
  }
}

export const toMute = (mediaRef, muted, setMuted) => {
  if (mediaRef.current) {
    const newMuteState = !muted
    mediaRef.current.muted = newMuteState
    setMuted(newMuteState)
  }
}

export const toRepeat = (mediaRef, loop, setLoop) => {
  if (mediaRef.current) {
    const newLoopState = !loop
    mediaRef.current.loop = newLoopState
    setLoop(newLoopState)
    console.log(newLoopState)
  }
}
