// Mic capture -> 16kHz PCM16 base64 chunks, and playback of 24kHz PCM16 base64 chunks.

export function base64ToArrayBuffer(base64) {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

function arrayBufferToBase64(buffer) {
  let binary = ''
  const bytes = new Uint8Array(buffer)
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

function floatTo16BitPCM(float32Array) {
  const buffer = new ArrayBuffer(float32Array.length * 2)
  const view = new DataView(buffer)
  let offset = 0
  for (let i = 0; i < float32Array.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, float32Array[i]))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }
  return buffer
}

export class MicStreamer {
  constructor(onChunk) {
    this.onChunk = onChunk
    this.audioContext = null
    this.stream = null
    this.source = null
    this.processor = null
    this.muted = false
  }

  // Gate outgoing audio while the model's reply is playing so the mic doesn't
  // pick the speaker output back up and feed it back as "new" user speech.
  setMuted(muted) {
    this.muted = muted
  }

  async start() {
    console.log('[mic] requesting getUserMedia...')
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    })
    console.log('[mic] mic access granted, track:', this.stream.getAudioTracks()[0]?.label)
    this.audioContext = new AudioContext({ sampleRate: 16000 })
    console.log('[mic] AudioContext sampleRate:', this.audioContext.sampleRate)
    this.source = this.audioContext.createMediaStreamSource(this.stream)
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1)
    this.processor.onaudioprocess = (e) => {
      if (this.muted) return
      const input = e.inputBuffer.getChannelData(0)
      const pcm = floatTo16BitPCM(input)
      this.onChunk(arrayBufferToBase64(pcm))
    }
    this.source.connect(this.processor)
    this.processor.connect(this.audioContext.destination)
    console.log('[mic] streaming started')
  }

  stop() {
    this.processor?.disconnect()
    this.source?.disconnect()
    this.stream?.getTracks().forEach((t) => t.stop())
    this.audioContext?.close()
    this.processor = null
    this.source = null
    this.stream = null
    this.audioContext = null
  }
}

export class AudioPlayer {
  constructor() {
    this.audioContext = new AudioContext({ sampleRate: 24000 })
    this.nextStartTime = 0
  }

  playChunk(base64) {
    const buffer = base64ToArrayBuffer(base64)
    const int16 = new Int16Array(buffer)
    const float32 = new Float32Array(int16.length)
    for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768
    const audioBuffer = this.audioContext.createBuffer(1, float32.length, 24000)
    audioBuffer.getChannelData(0).set(float32)
    const source = this.audioContext.createBufferSource()
    source.buffer = audioBuffer
    source.connect(this.audioContext.destination)
    const now = this.audioContext.currentTime
    const startAt = Math.max(now, this.nextStartTime)
    source.start(startAt)
    this.nextStartTime = startAt + audioBuffer.duration
  }

  reset() {
    this.nextStartTime = 0
  }

  close() {
    this.audioContext?.close()
  }
}
