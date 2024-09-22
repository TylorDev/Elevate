import { useEffect, useRef } from 'react'
import butterchurn from 'butterchurn'
import butterchurnPresets from 'butterchurn-presets'

const Visualizer = ({ audioSrc }) => {
  const canvasRef = useRef(null)
  const audioRef = useRef(null)
  const audioContextRef = useRef(null) // Para almacenar el AudioContext

  useEffect(() => {
    const canvas = canvasRef.current
    const audio = audioRef.current

    if (!canvas || !audio) return

    // Crear el AudioContext solo una vez
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)()
    }

    const audioContext = audioContextRef.current
    let audioNode

    try {
      // Asegúrate de que el audio no esté conectado previamente
      audioNode = audioContext.createMediaElementSource(audio)
    } catch (e) {
      console.error('Audio element ya está conectado a un contexto:', e)
      return
    }

    // Crear visualizador
    const visualizer = butterchurn.createVisualizer(audioContext, canvas, {
      width: 800,
      height: 600
    })

    // Conectar el audioNode al visualizador
    visualizer.connectAudio(audioNode)
    audioNode.connect(audioContext.destination) // Conectar el audio al destino (altavoces)

    // Cargar preset
    const presets = butterchurnPresets.getPresets()
    const preset = presets['Flexi, martin + geiss - dedicated to the sherwin maxawow']
    visualizer.loadPreset(preset, 0.0)

    // Cambiar tamaño del visualizador
    visualizer.setRendererSize(1600, 1200)

    // Renderizar frames
    const renderFrame = () => {
      visualizer.render()
      requestAnimationFrame(renderFrame)
    }

    renderFrame()

    // Cleanup al desmontar
    return () => {
      visualizer.destroy()
      audioNode.disconnect()
    }
  }, [audioSrc])

  return (
    <div>
      <audio ref={audioRef} src={audioSrc} controls />
      <canvas ref={canvasRef} width={800} height={600}></canvas>
    </div>
  )
}

export default Visualizer
