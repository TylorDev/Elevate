const audioSources = new WeakMap();

export const getGlobalAudioContext = (audioElement) => {
  if (!audioElement) return { audioContext: null, sourceNode: null, analyser: null };

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return { audioContext: null, sourceNode: null, analyser: null };

  let record = audioSources.get(audioElement);
  if (!record) {
    const audioContext = new AudioContextClass();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.82;

    let sourceNode = null;
    try {
      sourceNode = audioContext.createMediaElementSource(audioElement);
      sourceNode.connect(analyser);
      sourceNode.connect(audioContext.destination);
    } catch (error) {
      console.warn("Could not create MediaElementSourceNode:", error);
    }

    record = { audioContext, sourceNode, analyser };
    audioSources.set(audioElement, record);
  }

  if (record.audioContext.state === 'suspended') {
    record.audioContext.resume().catch(console.error);
  }

  return record;
};
