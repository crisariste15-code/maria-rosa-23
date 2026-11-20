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
  private silentEl: HTMLAudioElement | null = null
  private fileUrl: string | null = null
  private target = 0.9

  subscribe = (l: Listener) => {
    this.listeners.add(l)
    return () => this.listeners.delete(l)
  }
  getSnapshot = () => this.playing
  private emit() {
    this.listeners.forEach((l) => l())
  }

  /**
   * IMPORTANTE: todo lo que el navegador exige "dentro del toque" (crear/reanudar el AudioContext,
   * activar la sesión de audio) se hace de forma SÍNCRONA, sin ningún `await` antes. En iPhone,
   * un `await` previo hace que el audio quede bloqueado y no suene nada.
   */
  start() {
    if (this.playing) return
    this.playing = true
    this.emit()
    this.unlockAudioSession()
    if (this.fileUrl) this.startFile(this.fileUrl)
    else this.startSynth()
    // Comprobación: si pasado un instante el contexto sigue sin sonar, se vuelve a intentar y, si no,
    // el botón vuelve a "Activar música" para que se pueda tocar otra vez.
    window.setTimeout(() => {
      if (!this.playing || !this.ctx) return
      if (this.ctx.state !== 'running') {
        void this.ctx.resume()
        window.setTimeout(() => {
          if (this.playing && this.ctx && this.ctx.state !== 'running') {
            this.playing = false
            this.emit()
          }
        }, 900)
      }
    }, 700)
  }

  /** Se llama al cargar la página: averigua en segundo plano si existe public/musica/fondo.mp3. */
  preload() {
    void this.probeFile().then((u) => {
      this.fileUrl = u
    })
    // Si la pantalla se apaga o la pestaña pasa a segundo plano, al volver se reanuda el audio.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.playing && this.ctx && this.ctx.state !== 'running') void this.ctx.resume()
    })
  }

  /** iPhone/iPad: el sonido de la web se silencia con el interruptor de silencio; esto lo evita. */
  private unlockAudioSession() {
    try {
      const nav = navigator as Navigator & { audioSession?: { type: string } }
      if (nav.audioSession) nav.audioSession.type = 'playback'
    } catch {
      /* no disponible */
    }
    if (!this.silentEl) {
      try {
        // Respaldo para iOS antiguos: un <audio> silencioso en bucle cambia la categoría de audio.
        const el = new Audio(silentWavUri())
        el.loop = true
        el.setAttribute('playsinline', '')
        this.silentEl = el
      } catch {
        /* sin respaldo */
      }
    }
    void this.silentEl?.play().catch(() => undefined)
  }

  stop() {
    if (!this.playing) return
    this.playing = false
    this.emit()
    this.silentEl?.pause()
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
    else this.start()
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
      comp.threshold.value = -14
      comp.knee.value = 14
      comp.ratio.value = 3.5
      comp.attack.value = 0.01
      comp.release.value = 0.3
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
    lp.frequency.value = 2600
    lp.Q.value = 0.4
    pad.connect(lp)
    lp.connect(this.bus!)
    // Una octava más arriba: los parlantes de celular casi no reproducen por debajo de ~200 Hz.
    const notes = chord.pad.map((f) => f * 2)
    notes.forEach((f, i) => {
      for (const det of [-6, 6]) {
        const o = ctx.createOscillator()
        o.type = i % 2 ? 'sine' : 'triangle'
        o.frequency.value = f
        o.detune.value = det
        const g = ctx.createGain()
        g.gain.value = 0.085
        o.connect(g)
        g.connect(pad)
        o.start(t)
        o.stop(t + dur + 3)
      }
    })
    const b = ctx.createOscillator()
    b.type = 'triangle' // el triángulo trae armónicos audibles incluso en parlantes pequeños
    b.frequency.value = chord.bass * 2
    const bg = ctx.createGain()
    bg.gain.setValueAtTime(0, t)
    bg.gain.linearRampToValueAtTime(0.2, t + 1.5)
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
    out.gain.linearRampToValueAtTime(peak * 3.4, t + 0.008)
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

/** WAV de 0,1 s en silencio, como data URI (sirve para "despertar" la sesión de audio en iOS). */
function silentWavUri(): string {
  const samples = 800
  const bytes = new Uint8Array(44 + samples)
  const dv = new DataView(bytes.buffer)
  const w = (o: number, s: string) => [...s].forEach((c, i) => dv.setUint8(o + i, c.charCodeAt(0)))
  w(0, 'RIFF')
  dv.setUint32(4, 36 + samples, true)
  w(8, 'WAVE')
  w(12, 'fmt ')
  dv.setUint32(16, 16, true)
  dv.setUint16(20, 1, true) // PCM
  dv.setUint16(22, 1, true) // mono
  dv.setUint32(24, 8000, true)
  dv.setUint32(28, 8000, true)
  dv.setUint16(32, 1, true)
  dv.setUint16(34, 8, true)
  w(36, 'data')
  dv.setUint32(40, samples, true)
  bytes.fill(128, 44) // 128 = silencio en WAV de 8 bits
  let bin = ''
  bytes.forEach((b) => (bin += String.fromCharCode(b)))
  return `data:audio/wav;base64,${btoa(bin)}`
}

export const music = new MusicEngine()
if (typeof window !== 'undefined') music.preload()
