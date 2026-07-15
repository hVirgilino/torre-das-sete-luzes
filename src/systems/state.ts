import {
  DifficultyId,
  DIFFICULTIES,
  Difficulty,
  LOCKS_PER_FLOOR,
  ResolutionId,
  TrackId,
  UI_SCALES
} from '../data/config';
import { resetQuestionHistory } from './questions';

const SAVE_KEY = 'cerimonia-da-luz:save:v1';
const SETTINGS_KEY = 'cerimonia-da-luz:settings:v1';

export interface CandleState {
  /** trancas restantes neste andar */
  locks: number;
  /** vela acesa (habilidade disponível) */
  lit: boolean;
}

export interface SaveData {
  playerName: string;
  difficulty: DifficultyId;
  candles: CandleState[]; // índice 0 = vela/andar 1
  /** andar atual do jogador (1–8) */
  floor: number;
  /** buff da vela 5 pendente */
  protectionActive: boolean;
  finished: boolean;
  updatedAt: number;
}

export interface Settings {
  musicVolume: number; // 0–1
  sfxVolume: number; // 0–1
  difficulty: DifficultyId;
  /** faixa da vitrola */
  track: TrackId;
  /** resolução de renderização (aplicada ao recarregar) */
  resolutionId: ResolutionId;
  /** escala da interface (um dos degraus de UI_SCALES) */
  uiScale: number;
}

const defaultSettings: Settings = {
  musicVolume: 0.6,
  sfxVolume: 0.8,
  difficulty: 'escudeiro',
  track: 'festiva',
  resolutionId: '540',
  uiScale: 1
};

const TRACK_IDS: TrackId[] = ['festiva', 'epica', 'taverna'];
const RESOLUTION_IDS: ResolutionId[] = ['540', '720', '1080', '1440'];

const isDifficultyId = (v: unknown): v is DifficultyId => DIFFICULTIES.some((d) => d.id === v);

const clamp01 = (v: unknown, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : fallback;

/** Aceita qualquer JSON vindo do storage e devolve settings sempre válidos. */
function sanitizeSettings(raw: unknown): Settings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    musicVolume: clamp01(r.musicVolume, defaultSettings.musicVolume),
    sfxVolume: clamp01(r.sfxVolume, defaultSettings.sfxVolume),
    difficulty: isDifficultyId(r.difficulty) ? r.difficulty : defaultSettings.difficulty,
    track: TRACK_IDS.includes(r.track as TrackId) ? (r.track as TrackId) : defaultSettings.track,
    resolutionId: RESOLUTION_IDS.includes(r.resolutionId as ResolutionId)
      ? (r.resolutionId as ResolutionId)
      : defaultSettings.resolutionId,
    uiScale: UI_SCALES.includes(r.uiScale as (typeof UI_SCALES)[number])
      ? (r.uiScale as number)
      : defaultSettings.uiScale
  };
}

/**
 * Valida um save vindo do storage. Estrutura irrecuperável → null (tratado como
 * "sem save"); valores fora de faixa são corrigidos em vez de derrubar o jogo.
 */
function sanitizeSave(raw: unknown): SaveData | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (!Array.isArray(r.candles)) return null;

  const candles: CandleState[] = LOCKS_PER_FLOOR.map((max, i) => {
    const c = (r.candles as unknown[])[i];
    const cc = (c && typeof c === 'object' ? c : {}) as Record<string, unknown>;
    const locks =
      typeof cc.locks === 'number' && Number.isFinite(cc.locks)
        ? Math.min(max, Math.max(0, Math.round(cc.locks)))
        : max;
    return { locks, lit: cc.lit === true };
  });

  const floor =
    typeof r.floor === 'number' && Number.isFinite(r.floor)
      ? Math.min(LOCKS_PER_FLOOR.length + 1, Math.max(1, Math.round(r.floor)))
      : 1;

  return {
    playerName: (typeof r.playerName === 'string' ? r.playerName.trim().slice(0, 24) : '') || 'Galahad',
    difficulty: isDifficultyId(r.difficulty) ? r.difficulty : 'escudeiro',
    candles,
    floor,
    protectionActive: r.protectionActive === true,
    finished: r.finished === true,
    updatedAt: typeof r.updatedAt === 'number' && Number.isFinite(r.updatedAt) ? r.updatedAt : Date.now()
  };
}

class GameStateManager {
  save: SaveData | null = null;
  settings: Settings = { ...defaultSettings };

  constructor() {
    this.loadSettings();
    this.loadSave();
  }

  // ---------- settings ----------
  loadSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) this.settings = sanitizeSettings(JSON.parse(raw));
    } catch {
      /* storage indisponível — segue com padrão em memória */
    }
  }

  persistSettings() {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
    } catch {
      /* noop */
    }
  }

  get difficulty(): Difficulty {
    return DIFFICULTIES.find((d) => d.id === (this.save?.difficulty ?? this.settings.difficulty)) ?? DIFFICULTIES[0];
  }

  // ---------- save ----------
  loadSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      this.save = raw ? sanitizeSave(JSON.parse(raw)) : null;
    } catch {
      this.save = null;
    }
  }

  get hasSave(): boolean {
    return !!this.save && !this.save.finished;
  }

  newGame(playerName: string) {
    this.save = {
      playerName: playerName.trim() || 'Galahad',
      difficulty: this.settings.difficulty,
      candles: LOCKS_PER_FLOOR.map((locks) => ({ locks, lit: false })),
      floor: 1,
      protectionActive: false,
      finished: false,
      updatedAt: Date.now()
    };
    resetQuestionHistory();
    this.persistSave();
  }

  persistSave() {
    if (!this.save) return;
    this.save.updatedAt = Date.now();
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.save));
    } catch {
      /* noop */
    }
  }

  clearSave() {
    this.save = null;
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {
      /* noop */
    }
  }

  // ---------- regras ----------
  candle(vela: number): CandleState {
    return this.save!.candles[vela - 1];
  }

  /** todas as velas acesas → portão do 8º andar abre */
  get allLit(): boolean {
    return !!this.save && this.save.candles.every((c) => c.lit && c.locks === 0);
  }

  removeLock(vela: number) {
    const c = this.candle(vela);
    if (c.locks > 0) c.locks--;
    this.persistSave();
  }

  resetLocks(vela: number) {
    this.candle(vela).locks = LOCKS_PER_FLOOR[vela - 1];
    this.persistSave();
  }

  lightCandle(vela: number) {
    const c = this.candle(vela);
    if (c.locks === 0) c.lit = true;
    this.persistSave();
  }

  /** custo de usar uma habilidade: a vela apaga e trancas retornam */
  extinguishForAbility(vela: number, locksReturned: number) {
    if (this.save!.protectionActive) {
      this.save!.protectionActive = false;
      this.persistSave();
      return false; // protegida — não apagou
    }
    const c = this.candle(vela);
    c.lit = false;
    c.locks = Math.min(LOCKS_PER_FLOOR[vela - 1], c.locks + locksReturned);
    this.persistSave();
    return true;
  }
}

export const State = new GameStateManager();
