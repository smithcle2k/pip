let currentRecording: HTMLAudioElement | null = null

export function stopAudio() {
  if (currentRecording) {
    currentRecording.pause()
    currentRecording = null
  }
  if ('speechSynthesis' in window) window.speechSynthesis.cancel()
}

// A local recording can replace browser speech without changing the child flow.
export function playPrompt(text: string, recordingSrc?: string) {
  stopAudio()

  if (recordingSrc) {
    const recording = new Audio(recordingSrc)
    currentRecording = recording
    void recording.play().catch(() => {
      // Don't restart an old prompt after the child has moved on.
      if (currentRecording === recording) playPrompt(text)
    })
    return
  }

  if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) return

  try {
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'en-US'
    utterance.rate = 0.85
    // Prefer on-device speech; never send a child's name to a remote voice.
    const localVoice = window.speechSynthesis.getVoices().find(voice =>
      voice.localService && voice.lang.startsWith('en'),
    )
    if (!localVoice) return
    utterance.voice = localVoice
    window.speechSynthesis.speak(utterance)
  } catch (error) {
    // Audio is optional: a device without speech must still allow selection.
    if (import.meta.env.DEV) console.debug('Pip audio is unavailable.', error)
  }
}
