import { State } from './state';

/**
 * Áudio 100% procedural via WebAudio — zero assets, zero peso no bundle.
 * Música: arpejo modal medieval em loop. SFX: sínteses curtas.
 * Volumes de música e efeitos são independentes e persistidos.
 */
class AudioEngine {
  private ctx: AudioContext | null = null;
  private musicGain!: GainNode;
  private sfxGain!: GainNode;
  private musicTimer: number | null = null;
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
  /** Dó dórico, clima de salão de pedra */
  private scale = [130.81, 146.83, 155.56, 196.0, 220.0, 261.63, 293.66, 311.13];
  private pattern = [0, 4, 5, 4, 2, 5, 7, 5, 0, 4, 5, 4, 3, 5, 6, 5];

  startMusic() {
    this.ensure();
    if (this.playing) return;
    this.playing = true;
    this.step = 0;
    const tick = () => {
      if (!this.playing || !this.ctx) return;
      const idx = this.pattern[this.step % this.pattern.length];
      this.pluck(this.scale[idx], 0.9, this.musicGain);
      if (this.step % 8 === 0) this.pluck(this.scale[0] / 2, 2.4, this.musicGain, 'triangle', 0.5);
      this.step++;
      this.musicTimer = window.setTimeout(tick, 340);
    };
    tick();
  }

  stopMusic() {
    this.playing = false;
    if (this.musicTimer !== null) {
      clearTimeout(this.musicTimer);
      this.musicTimer = null;
    }
  }

  private pluck(freq: number, dur: number, out: GainNode, type: OscillatorType = 'sine', vol = 0.35) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(out);
    osc.start(t);
    osc.stop(t + dur);
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
  footstep() { this.noise(0.04, 0.05, 900); }
  ability() { this.tone(700, 0.2, 'sine', 0.25, 1400); this.tone(1050, 0.35, 'sine', 0.2, 2100); }
  fanfare() {
    const notes = [523, 659, 784, 1046];
    notes.forEach((n, i) => setTimeout(() => this.tone(n, 0.5, 'triangle', 0.35), i * 180));
  }
}

export const Audio = new AudioEngine();
