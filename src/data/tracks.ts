import { TrackId } from './config';

/**
 * As três faixas da vitrola, 100% sintetizadas (ver systems/audio.ts).
 * Cada faixa é um loop de `steps` colcheias com 3 vozes: melodia, baixo e percussão.
 */

export type Wave = OscillatorType | 'noise';

/** Códigos de percussão (voz com wave 'noise') */
export const PERC_LOW = 1; // grave surdo — tímpano, pisada
export const PERC_TICK = 2; // estalo agudo — pandeiro
export const PERC_HAT = 3; // chiado curto — chimbal, palma

export interface Voice {
  wave: Wave;
  /** grau da escala por passo (null = pausa). Em vozes 'noise', o código de percussão. */
  pattern: (number | null)[];
  /** deslocamento de oitava (freq × 2^octave) — ignorado na percussão */
  octave: number;
  /** volume da voz, 0–1 */
  gain: number;
  /** duração do envelope de cada nota, em segundos */
  decay: number;
  /** segunda oscilação levemente desafinada (cents) — timbre de alaúde/coro */
  detune?: number;
  /** filtro passa-baixa opcional da voz (Hz) */
  lowpass?: number;
}

export interface Track {
  id: TrackId;
  /** nome exibido na vitrola */
  nome: string;
  bpm: number;
  /** frequência da tônica (Hz) */
  root: number;
  /** escala em semitons a partir da tônica; graus além do fim sobem de oitava */
  scale: number[];
  /** comprimento do loop, em colcheias */
  steps: number;
  /** 0–0.33 — atraso dos passos ímpares (balanço) */
  swing?: number;
  voices: Voice[];
}

const _ = null;

const DORIAN = [0, 2, 3, 5, 7, 9, 10, 12];
const MAJOR = [0, 2, 4, 5, 7, 9, 11, 12];
const MIXOLYDIAN = [0, 2, 4, 5, 7, 9, 10, 12];

/** Dança medieval saltitante (estampie) — ré dórico */
const festiva: Track = {
  id: 'festiva',
  nome: 'Dança do Salão',
  bpm: 140,
  root: 146.83, // ré3
  scale: DORIAN,
  steps: 32,
  voices: [
    {
      wave: 'triangle',
      octave: 1,
      gain: 0.42,
      decay: 0.4,
      detune: 8,
      pattern: [
        0, _, 2, _, 4, _, 2, _,
        5, 4, 5, _, 4, _, 2, _,
        0, _, 2, _, 4, _, 7, _,
        5, _, 4, 2, 1, _, 0, _
      ]
    },
    {
      // bordão de tônica e quinta
      wave: 'sine',
      octave: 0,
      gain: 0.5,
      decay: 0.7,
      pattern: [
        0, _, _, _, 4, _, _, _,
        0, _, _, _, 4, _, _, _,
        3, _, _, _, 4, _, _, _,
        0, _, _, _, 4, _, 4, _
      ]
    },
    {
      // pandeiro nos contratempos
      wave: 'noise',
      octave: 0,
      gain: 0.3,
      decay: 0.05,
      pattern: [
        PERC_LOW, _, PERC_TICK, _, _, PERC_TICK, _, PERC_TICK,
        PERC_LOW, _, PERC_TICK, _, _, PERC_TICK, PERC_TICK, PERC_TICK,
        PERC_LOW, _, PERC_TICK, _, _, PERC_TICK, _, PERC_TICK,
        PERC_LOW, _, PERC_TICK, _, PERC_LOW, PERC_TICK, PERC_TICK, PERC_TICK
      ]
    }
  ]
};

/** Canção heroica solene — dó maior, movimento IV–V–I */
const epica: Track = {
  id: 'epica',
  nome: 'Canção Heroica',
  bpm: 104,
  root: 130.81, // dó3
  scale: MAJOR,
  steps: 32,
  voices: [
    {
      wave: 'sawtooth',
      octave: 1,
      gain: 0.3,
      decay: 0.55,
      lowpass: 1800,
      pattern: [
        0, _, _, 4, _, _, 5, 4,
        2, _, 0, _, 2, _, 4, _,
        3, _, _, 5, _, _, 4, 2,
        1, _, 2, _, 0, _, _, _
      ]
    },
    {
      wave: 'triangle',
      octave: 0,
      gain: 0.55,
      decay: 1.1,
      pattern: [
        0, _, _, _, 0, _, _, _,
        0, _, _, _, 4, _, _, _,
        3, _, _, _, 3, _, _, _,
        4, _, _, _, 0, _, _, _
      ]
    },
    {
      // tímpano nos tempos fortes + rufo no fim do ciclo
      wave: 'noise',
      octave: 0,
      gain: 0.4,
      decay: 0.16,
      pattern: [
        PERC_LOW, _, _, _, PERC_LOW, _, _, _,
        PERC_LOW, _, _, _, PERC_LOW, _, _, _,
        PERC_LOW, _, _, _, PERC_LOW, _, _, _,
        PERC_LOW, _, _, _, PERC_LOW, _, PERC_LOW, PERC_LOW
      ]
    }
  ]
};

/** Noite animada de taverna — sol mixolídio com balanço */
const taverna: Track = {
  id: 'taverna',
  nome: 'Noite na Taverna',
  bpm: 152,
  root: 196.0, // sol3
  scale: MIXOLYDIAN,
  steps: 32,
  swing: 0.25,
  voices: [
    {
      wave: 'square',
      octave: 1,
      gain: 0.16,
      decay: 0.16,
      pattern: [
        0, 2, 4, 2, 5, 4, 2, 0,
        3, _, 3, 5, 4, _, 2, _,
        0, 2, 4, 2, 5, 4, 7, _,
        6, 5, 4, 2, 0, _, 0, _
      ]
    },
    {
      // walking bass
      wave: 'triangle',
      octave: 0,
      gain: 0.5,
      decay: 0.3,
      pattern: [
        0, _, 2, _, 4, _, 2, _,
        3, _, 2, _, 4, _, 4, _,
        0, _, 2, _, 4, _, 5, _,
        6, _, 4, _, 0, _, 4, _
      ]
    },
    {
      // pisadas e palmas
      wave: 'noise',
      octave: 0,
      gain: 0.32,
      decay: 0.07,
      pattern: [
        PERC_LOW, _, PERC_HAT, _, PERC_LOW, _, PERC_HAT, PERC_HAT,
        PERC_LOW, _, PERC_HAT, _, PERC_LOW, _, PERC_HAT, _,
        PERC_LOW, _, PERC_HAT, _, PERC_LOW, _, PERC_HAT, PERC_HAT,
        PERC_LOW, _, PERC_HAT, _, PERC_LOW, PERC_HAT, PERC_HAT, _
      ]
    }
  ]
};

export const TRACKS: Track[] = [festiva, epica, taverna];

export const trackById = (id: TrackId): Track => TRACKS.find((t) => t.id === id) ?? TRACKS[0];

export const nextTrack = (id: TrackId): Track =>
  TRACKS[(TRACKS.findIndex((t) => t.id === id) + 1) % TRACKS.length];
