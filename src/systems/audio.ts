import { State } from './state';
import { TrackId } from '../data/config';
import { PERC_HAT, PERC_TICK, Track, Voice, trackById } from '../data/tracks';

/**
 * Áudio 100% procedural via WebAudio — zero assets, zero peso no bundle.
 * Música: sequenciador de 3 vozes com lookahead (faixas em data/tracks.ts).
 * SFX: sínteses curtas. Volumes de música e efeitos são independentes e persistidos.
 */
class AudioEngine {
  private ctx: AudioContext | null = null;
  private musicGain!: GainNode;
  private sfxGain!: GainNode;
  private ambientNodes: AudioNode[] = [];
  private step = 0;
  private playing = false;

  private ensure() {
    if (this.ctx) return;
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    this.ctx = new AC();
    this.musicGain = this.ctx.createGain();
    this.sfxGain = this.ctx.createGain();
    this.musicGain.connect(this.ctx.destination);
    this.sfxGain.connect(this.ctx.destination);
    this.applyVolumes();
  }

  /** navegadores exigem gesto do usuário para liberar áudio */
  unlock() {
    this.ensure();
    if (this.ctx!.state === 'suspended') this.ctx!.resume();
  }

  applyVolumes() {
    if (!this.ctx) return;
    this.musicGain.gain.value = State.settings.musicVolume * 0.35;
    this.sfxGain.gain.value = State.settings.sfxVolume * 0.9;
  }

  // ------------------------------ música ------------------------------
  private current: Track = trackById(State.settings.track);
  private nextNoteTime = 0;
  private schedulerTimer: number | null = null;
  private trackGain: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;

  get currentTrack(): Track {
    return this.current;
  }

  get isPlaying(): boolean {
    return this.playing;
  }

  startMusic(id?: TrackId) {
    this.ensure();
    if (id) this.current = trackById(id);
    if (this.playing) return;
    this.playing = true;
    this.step = 0;
    this.newTrackGain();
    this.nextNoteTime = this.ctx!.currentTime + 0.05;
    // lookahead: agenda com antecedência no relógio do AudioContext,
    // então o intervalo do JS pode oscilar sem afetar o ritmo
    this.schedulerTimer = window.setInterval(() => this.scheduleAhead(), 120);
    this.scheduleAhead();
  }

  stopMusic() {
    this.playing = false;
    if (this.schedulerTimer !== null) {
      clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }
    this.fadeOutTrackGain();
  }

  /** Troca a faixa em execução com um crossfade curto. */
  setTrack(id: TrackId) {
    this.ensure();
    this.current = trackById(id);
    if (!this.playing) return;
    this.fadeOutTrackGain();
    this.newTrackGain();
    this.step = 0;
    this.nextNoteTime = this.ctx!.currentTime + 0.2;
  }

  private newTrackGain() {
    this.trackGain = this.ctx!.createGain();
    this.trackGain.connect(this.musicGain);
  }

  /** Silencia o barramento atual em rampa — notas já agendadas morrem com ele. */
  private fadeOutTrackGain() {
    const old = this.trackGain;
    if (!old || !this.ctx) return;
    const t = this.ctx.currentTime;
    old.gain.setValueAtTime(old.gain.value, t);
    old.gain.linearRampToValueAtTime(0.0001, t + 0.2);
    window.setTimeout(() => old.disconnect(), 500);
    this.trackGain = null;
  }

  private scheduleAhead() {
    if (!this.playing || !this.ctx || !this.trackGain) return;
    const track = this.current;
    const stepDur = 60 / track.bpm / 2; // passo = colcheia
    while (this.nextNoteTime < this.ctx.currentTime + 0.25) {
      const s = this.step % track.steps;
      const swingDelay = track.swing && s % 2 === 1 ? stepDur * track.swing : 0;
      const when = this.nextNoteTime + swingDelay;
      for (const v of track.voices) {
        const cell = v.pattern[s % v.pattern.length];
        if (cell === null || cell === undefined) continue;
        if (v.wave === 'noise') this.percAt(when, cell, v);
        else this.pluckAt(when, this.degreeFreq(track, v, cell), v);
      }
      this.step++;
      this.nextNoteTime += stepDur;
    }
  }

  private degreeFreq(track: Track, v: Voice, deg: number): number {
    const len = track.scale.length;
    const semi = track.scale[deg % len] + 12 * Math.floor(deg / len);
    return track.root * Math.pow(2, semi / 12) * Math.pow(2, v.octave);
  }

  private pluckAt(when: number, freq: number, v: Voice) {
    const ctx = this.ctx!;
    const out = this.trackGain!;
    const env = ctx.createGain();
    env.gain.setValueAtTime(v.gain, when);
    env.gain.exponentialRampToValueAtTime(0.0001, when + v.decay);
    let head: AudioNode = env;
    if (v.lowpass) {
      const filt = ctx.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.value = v.lowpass;
      filt.connect(env);
      head = filt;
    }
    env.connect(out);
    const voices = v.detune ? [0, v.detune] : [0];
    for (const cents of voices) {
      const osc = ctx.createOscillator();
      osc.type = v.wave as OscillatorType;
      osc.frequency.value = freq;
      osc.detune.value = cents;
      osc.connect(head);
      osc.start(when);
      osc.stop(when + v.decay + 0.05);
    }
  }

  private ensureNoiseBuf(): AudioBuffer {
    if (!this.noiseBuf) {
      const ctx = this.ctx!;
      this.noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    return this.noiseBuf;
  }

  private percAt(when: number, code: number, v: Voice) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.ensureNoiseBuf();
    const filt = ctx.createBiquadFilter();
    let dur = v.decay;
    let vol = v.gain;
    if (code === PERC_TICK) {
      filt.type = 'bandpass';
      filt.frequency.value = 3000;
      filt.Q.value = 1.5;
      vol *= 0.8;
    } else if (code === PERC_HAT) {
      filt.type = 'highpass';
      filt.frequency.value = 6000;
      vol *= 0.7;
    } else {
      // PERC_LOW — grave surdo
      filt.type = 'lowpass';
      filt.frequency.value = 200;
      dur = Math.max(dur, 0.14);
    }
    const env = ctx.createGain();
    env.gain.setValueAtTime(vol, when);
    env.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    src.connect(filt).connect(env).connect(this.trackGain!);
    src.start(when, Math.random() * 0.5, dur + 0.05);
  }

  // ------------------------------ ambiente ------------------------------
  /**
   * Rumor grave contínuo com oscilação lenta — vento e eco de pedra da torre.
   * Roda fora do barramento de música para sobreviver às trocas de faixa.
   */
  ambientStart() {
    this.ensure();
    if (this.ambientNodes.length) return;
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.ensureNoiseBuf();
    src.loop = true;
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 240;
    const g = ctx.createGain();
    g.gain.value = 0.05;
    // respiração do vento: LFO bem lento modulando o ganho
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.08;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.025;
    lfo.connect(lfoGain).connect(g.gain);
    src.connect(filt).connect(g).connect(this.sfxGain);
    src.start();
    lfo.start();
    this.ambientNodes = [src, lfo, g];
  }

  ambientStop() {
    for (const n of this.ambientNodes) {
      if (n instanceof AudioBufferSourceNode || n instanceof OscillatorNode) {
        try {
          n.stop();
        } catch {
          /* já parado */
        }
      }
      n.disconnect();
    }
    this.ambientNodes = [];
  }

  // ------------------------------ sfx ------------------------------
  private tone(freq: number, dur: number, type: OscillatorType, vol: number, slideTo?: number) {
    this.ensure();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + dur);
  }

  private noise(dur: number, vol: number, lowpass = 800) {
    this.ensure();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = lowpass;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(filt).connect(g).connect(this.sfxGain);
    src.start(t);
  }

  select() { this.tone(660, 0.08, 'square', 0.15); }
  confirm() { this.tone(523, 0.1, 'triangle', 0.3); this.tone(784, 0.18, 'triangle', 0.3); }
  correct() { this.tone(659, 0.12, 'sine', 0.35); this.tone(880, 0.22, 'sine', 0.35); this.tone(1318, 0.3, 'sine', 0.25); }
  wrong() { this.tone(180, 0.35, 'sawtooth', 0.3, 90); }
  tick() { this.tone(1200, 0.05, 'square', 0.12); }
  unlockSfx() { this.tone(400, 0.08, 'square', 0.25); this.tone(600, 0.12, 'square', 0.2); this.noise(0.12, 0.15, 2000); }
  candleLight() { this.noise(0.3, 0.2, 1600); this.tone(880, 0.5, 'sine', 0.2, 1760); }
  candleOut() { this.noise(0.4, 0.25, 600); this.tone(500, 0.4, 'sine', 0.15, 200); }
  sword() { this.tone(2200, 0.15, 'triangle', 0.3, 3200); this.noise(0.08, 0.12, 6000); }
  explosion() { this.noise(1.2, 0.8, 400); this.tone(80, 1.0, 'sawtooth', 0.4, 30); }
  jump() { this.tone(300, 0.15, 'square', 0.12, 500); }
  footstep() { this.noise(0.04, 0.04 + Math.random() * 0.03, 700 + Math.random() * 500); }
  climb() { this.tone(200 + Math.random() * 60, 0.06, 'square', 0.06); this.noise(0.05, 0.05, 1200); }
  ability() { this.tone(700, 0.2, 'sine', 0.25, 1400); this.tone(1050, 0.35, 'sine', 0.2, 2100); }
  fanfare() {
    const notes = [523, 659, 784, 1046];
    notes.forEach((n, i) => setTimeout(() => this.tone(n, 0.5, 'triangle', 0.35), i * 180));
  }
}

export const Audio = new AudioEngine();
