/** Locally synthesized ambience; no network audio or autoplay. */
export class Ambience {
  private context: AudioContext | null = null
  private gain: GainNode | null = null
  private birdTimer: ReturnType<typeof setInterval> | null = null

  async start() {
    if (this.context) { await this.context.resume(); return }
    const context = new AudioContext()
    this.context = context
    const gain = context.createGain()
    gain.gain.value = 0.09
    gain.connect(context.destination)
    this.gain = gain
    const buffer = context.createBuffer(1, context.sampleRate * 3, context.sampleRate)
    const data = buffer.getChannelData(0)
    let brown = 0
    for (let i = 0; i < data.length; i++) { brown = (brown + (Math.random() * 2 - 1) * 0.02) / 1.02; data[i] = brown * 3 }
    const noise = context.createBufferSource()
    noise.buffer = buffer
    noise.loop = true
    const filter = context.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 720
    noise.connect(filter).connect(gain)
    noise.start()
    this.birdTimer = setInterval(() => {
      if (context.state !== 'running') return
      const oscillator = context.createOscillator()
      const envelope = context.createGain()
      const time = context.currentTime
      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(1800 + Math.random() * 400, time)
      oscillator.frequency.exponentialRampToValueAtTime(2900, time + 0.12)
      oscillator.frequency.exponentialRampToValueAtTime(1900, time + 0.3)
      envelope.gain.setValueAtTime(0, time)
      envelope.gain.linearRampToValueAtTime(0.065, time + 0.04)
      envelope.gain.linearRampToValueAtTime(0, time + 0.32)
      oscillator.connect(envelope).connect(gain)
      oscillator.start(time)
      oscillator.stop(time + 0.33)
      oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect() }
    }, 4700)
    await context.resume()
  }
  stop() { void this.context?.suspend() }
  dispose() {
    if (this.birdTimer) clearInterval(this.birdTimer)
    void this.context?.close()
    this.context = null
    this.gain = null
  }
}
