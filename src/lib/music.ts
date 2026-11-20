// Música instrumental generada en el navegador con Web Audio.
// Es 100 % original (no hay archivo de audio con licencia que cuidar) y solo suena
// después de un clic o toque del usuario.
//
// Si prefieres una canción propia con licencia adecuada, copia un MP3 en
//   public/musica/fondo.mp3
// y se usará automáticamente en lugar de la melodía generada.

type Listener = () => void

// Progresión en Re mayor: Dmaj7 – Bm7 – Gmaj7 – Aadd9
const CHORDS = [
  { bass: 73.42, pad: [146.83, 220.0, 277.18, 369.99], arp: [587.33, 739.99, 880.0, 1108.73] },
  { bass: 61.74, pad: [123.47, 185.0, 246.94, 293.66], arp: [493.88, 587.33, 739.99, 880.0] },
  { bass: 98.0, pad: [196.0, 246.94, 293.66, 369.99], arp: [493.88, 587.33, 739.99, 783.99] },
  { bass: 55.0, pad: [110.0, 220.0, 277.18, 329.63], arp: [554.37, 659.25, 880.0, 987.77] },
]
const CHORD_SECONDS = 6.4
const NOTE_SECONDS = 0.8
const PATTERN = [0, 2, 1, 3, 2, 1, 3, 2, 0, 1, 2, 3]

class MusicEngine {
  playing = false
  private listeners = new Set<Listener>()
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private bus: GainNode | null = null
  private timer: number | null = null
  private startTime = 0
  private nextChordTime = 0
  private nextNoteTime = 0
  private chordCounter = 0
  private noteCounter = 0
  private fileEl: HTMLAudioElement | null = null
  private target = 0.5

  subscribe = (l: Listener) => {
    this.listeners.add(l)
    return () => this.listeners.delete(l)
  }
  getSnapshot = () => this.playing
  private emit() {
    this.listeners.forEach((l) => l())
  }

  async start() {
    if (this.playing) return
    this.playing = true
    this.emit()
    const url = await this.probeFile()
    if (url) this.startFile(url)
    else this.startSynth()
  }

  stop() {
    if (!this.playing) return
    this.playing = false
    this.emit()
    if (this.fileEl) {
      const el = this.fileEl
      this.fadeFile(el, 0, () => el.pause())
    }
    if (this.ctx && this.master) {
      const now = this.ctx.currentTime
      this.master.gain.cancelScheduledValues(now)
      this.master.gain.setValueAtTime(this.master.gain.value, now)
      this.master.gain.linearRampToValueAtTime(0, now + 1.2)
      if (this.timer) window.clearInterval(this.timer)
      this.timer = null
      window.setTimeout(() => {
        if (!this.playing) void this.ctx?.suspend()
      }, 1500)
    }
  }

  toggle() {
    if (this.playing) this.stop()
    else void this.start()
  }

  // ---------- archivo opcional ----------
  private async probeFile(): Promise<string | null> {
    try {
      const url = `${import.meta.env.BASE_URL}musica/fondo.mp3`
      const r = await fetch(url, { method: 'HEAD' })
      const ct = r.headers.get('content-type') ?? ''
      if (r.ok && ct.startsWith('audio')) return url
    } catch {
      /* sin archivo: se usa la melodía generada */
    }
    return null
  }
  private startFile(url: string) {
    if (!this.fileEl) {
      this.fileEl = new Audio(url)
      this.fileEl.loop = true
    }
    this.fileEl.volume = 0
    void this.fileEl.play().catch(() => {
      this.playing = false
      this.emit()
    })
    this.fadeFile(this.fileEl, this.target)
  }
  private fadeFile(el: HTMLAudioElement, to: number, done?: () => void) {
    const from = el.volume
    const t0 = performance.now()
    const step = () => {
      const k = Math.min(1, (performance.now() - t0) / 1200)
      el.volume = from + (to - from) * k
      if (k < 1) requestAnimationFrame(step)
      else done?.()
    }
    step()
  }

  // ---------- melodía generada ----------
  private startSynth() {
    const AC: typeof AudioContext =
      window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AC) return
    if (!this.ctx) {
      const ctx = new AC()
      this.ctx = ctx
      const comp = ctx.createDynamicsCompressor()
      comp.threshold.value = -18
      comp.ratio.value = 3
      comp.connect(ctx.destination)
      const master = ctx.createGain()
      master.gain.value = 0
      master.connect(comp)
      this.master = master
      const bus = ctx.createGain()
      bus.connect(master)
      const conv = ctx.createConvolver()
      conv.buffer = this.makeImpulse(ctx, 3.4, 3.0)
      const wet = ctx.createGain()
      wet.gain.value = 0.7
      bus.connect(conv)
      conv.connect(wet)
      wet.connect(master)
      this.bus = bus
    }
    const ctx = this.ctx
    void ctx.resume()
    const now = ctx.currentTime
    this.master!.gain.cancelScheduledValues(now)
    this.master!.gain.setValueAtTime(this.master!.gain.value, now)
    this.master!.gain.linearRampToValueAtTime(this.target, now + 3)
    this.startTime = now + 0.1
    this.nextChordTime = this.startTime
    this.nextNoteTime = this.startTime + 0.9
    this.chordCounter = 0
    this.noteCounter = 0
    if (this.timer) window.clearInterval(this.timer)
    this.timer = window.setInterval(() => this.schedule(), 120)
    this.schedule()
  }

  private makeImpulse(ctx: AudioContext, seconds: number, decay: number) {
    const len = Math.floor(ctx.sampleRate * seconds)
    const buf = ctx.createBuffer(2, len, ctx.sampleRate)
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c)
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay)
    }
    return buf
  }

  private schedule() {
    const ctx = this.ctx
    if (!ctx || !this.playing) return
    const horizon = ctx.currentTime + 0.5
    while (this.nextChordTime < horizon) {
      this.playChord(CHORDS[this.chordCounter % CHORDS.length], this.nextChordTime)
      this.chordCounter++
      this.nextChordTime += CHORD_SECONDS
    }
    while (this.nextNoteTime < horizon) {
      const idx = Math.floor((this.nextNoteTime - this.startTime) / CHORD_SECONDS) % CHORDS.length
      const chord = CHORDS[Math.max(0, idx)]
      const step = PATTERN[this.noteCounter % PATTERN.length]
      const rest = (this.noteCounter * 7 + 3) % 9 === 0
      if (!rest) {
        const octave = this.noteCounter % 11 === 0 ? 2 : 1
        this.playBell(chord.arp[step] * octave, this.nextNoteTime, 0.045 + (step === 3 ? 0.012 : 0))
      }
      this.noteCounter++
      this.nextNoteTime += NOTE_SECONDS
    }
  }

  private playChord(chord: (typeof CHORDS)[number], t: number) {
    const ctx = this.ctx!
    const dur = CHORD_SECONDS
    const pad = ctx.createGain()
    pad.gain.setValueAtTime(0, t)
    pad.gain.linearRampToValueAtTime(0.5, t + 2.4)
    pad.gain.setValueAtTime(0.5, t + dur - 0.2)
    pad.gain.linearRampToValueAtTime(0, t + dur + 2.6)
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 1100
    lp.Q.value = 0.4
    pad.connect(lp)
    lp.connect(this.bus!)
    const notes = [...chord.pad]
    notes.forEach((f, i) => {
      for (const det of [-6, 6]) {
        const o = ctx.createOscillator()
        o.type = i % 2 ? 'sine' : 'triangle'
        o.frequency.value = f
        o.detune.value = det
        const g = ctx.createGain()
        g.gain.value = 0.07
        o.connect(g)
        g.connect(pad)
        o.start(t)
        o.stop(t + dur + 3)
      }
    })
    const b = ctx.createOscillator()
    b.type = 'sine'
    b.frequency.value = chord.bass
    const bg = ctx.createGain()
    bg.gain.setValueAtTime(0, t)
    bg.gain.linearRampToValueAtTime(0.16, t + 1.5)
    bg.gain.linearRampToValueAtTime(0, t + dur + 1.5)
    b.connect(bg)
    bg.connect(this.bus!)
    b.start(t)
    b.stop(t + dur + 2)
  }

  private playBell(freq: number, t: number, peak: number) {
    const ctx = this.ctx!
    const out = ctx.createGain()
    out.gain.setValueAtTime(0.0001, t)
    out.gain.linearRampToValueAtTime(peak, t + 0.008)
    out.gain.exponentialRampToValueAtTime(0.0001, t + 2.8)
    const pan = ctx.createStereoPanner()
    pan.pan.value = ((this.noteCounter * 37) % 100) / 100 - 0.5
    out.connect(pan)
    pan.connect(this.bus!)
    for (const [mult, gain, len] of [
      [1, 1, 2.8],
      [2.01, 0.28, 1.2],
      [3.99, 0.08, 0.5],
    ] as const) {
      const o = ctx.createOscillator()
      o.type = 'sine'
      o.frequency.value = freq * mult
      const g = ctx.createGain()
      g.gain.value = gain
      o.connect(g)
      g.connect(out)
      o.start(t)
      o.stop(t + len + 0.1)
    }
  }
}

export const music = new MusicEngine()
