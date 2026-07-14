import { DifficultyId, DIFFICULTIES, Difficulty, LOCKS_PER_FLOOR } from '../data/config';

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
}

const defaultSettings: Settings = {
  musicVolume: 0.6,
  sfxVolume: 0.8,
  difficulty: 'escudeiro'
};

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
      if (raw) this.settings = { ...defaultSettings, ...JSON.parse(raw) };
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
      this.save = raw ? (JSON.parse(raw) as SaveData) : null;
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
