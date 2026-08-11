import {
  DifficultyId,
  DIFFICULTIES,
  Difficulty,
  TOTAL_VELAS,
  dificuldadePorId,
  trancasDe,
  ResolutionId,
  TrackId,
  UI_SCALES,
  isTouchDevice
} from '../data/config';
import { resetQuestionHistory } from './questions';

const SAVE_KEY = 'cerimonia-da-luz:save:v1';
const SETTINGS_KEY = 'cerimonia-da-luz:settings:v1';
/** troféus ficam fora do save: recomeçar o jogo não apaga estrela conquistada */
const TROPHIES_KEY = 'cerimonia-da-luz:trophies:v1';

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
  /** cronômetro do desafio de Merlin, em ms — só corre com o jogo em foco */
  elapsedMs: number;
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
  // no celular a interface nasce um degrau maior: a área visível deitada tem
  // ~330px de altura contra as 540 do mundo lógico, então tudo já chega ao olho
  // reduzido a ~60%. Quem preferir o tamanho antigo troca nas opções.
  uiScale: isTouchDevice() ? 1.15 : 1
};

/** Dificuldades já vencidas alguma vez. As estrelas e os recordes saem daqui. */
export interface Trophies {
  cleared: DifficultyId[];
  /** melhor tempo em ms por dificuldade — o PR de quem faz speedrun */
  records: Partial<Record<DifficultyId, number>>;
}

/** "12 minutos e 34 segundos" — texto por extenso, como o Rei falaria. */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const min = Math.floor(total / 60);
  const sec = total % 60;
  const m = `${min} ${min === 1 ? 'minuto' : 'minutos'}`;
  const s = `${sec} ${sec === 1 ? 'segundo' : 'segundos'}`;
  if (min === 0) return s;
  return sec === 0 ? m : `${m} e ${s}`;
}

/** "12:34" — versão curta para a lista de recordes do menu. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

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

  // a dificuldade decide quantas trancas cada vela tem, então ela é lida
  // antes de sanear as velas
  const dif = isDifficultyId(r.difficulty) ? r.difficulty : 'escudeiro';
  const tabela = dificuldadePorId(dif)!.trancas;

  const candles: CandleState[] = tabela.map((max: number, i: number) => {
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
      ? Math.min(TOTAL_VELAS + 1, Math.max(1, Math.round(r.floor)))
      : 1;

  return {
    playerName: (typeof r.playerName === 'string' ? r.playerName.trim().slice(0, 24) : '') || 'Galahad',
    difficulty: dif,
    candles,
    floor,
    protectionActive: r.protectionActive === true,
    finished: r.finished === true,
    elapsedMs:
      typeof r.elapsedMs === 'number' && Number.isFinite(r.elapsedMs) ? Math.max(0, r.elapsedMs) : 0,
    updatedAt: typeof r.updatedAt === 'number' && Number.isFinite(r.updatedAt) ? r.updatedAt : Date.now()
  };
}

class GameStateManager {
  save: SaveData | null = null;
  settings: Settings = { ...defaultSettings };
  trophies: Trophies = { cleared: [], records: {} };
  /** último instante contabilizado pelo cronômetro; null = parado */
  private lastTick: number | null = null;

  constructor() {
    this.loadSettings();
    this.loadSave();
    this.loadTrophies();
  }

  // ---------- troféus ----------
  loadTrophies() {
    try {
      const raw = localStorage.getItem(TROPHIES_KEY);
      const parsed = (raw ? JSON.parse(raw) : null) as
        | { cleared?: unknown; records?: unknown }
        | null;
      const list = parsed?.cleared;
      const recs = (parsed?.records ?? {}) as Record<string, unknown>;
      const records: Partial<Record<DifficultyId, number>> = {};
      for (const d of DIFFICULTIES) {
        const v = recs[d.id];
        if (typeof v === 'number' && Number.isFinite(v) && v > 0) records[d.id] = v;
      }
      this.trophies = {
        cleared: Array.isArray(list) ? list.filter(isDifficultyId) : [],
        records
      };
    } catch {
      this.trophies = { cleared: [], records: {} };
    }
  }

  persistTrophies() {
    try {
      localStorage.setItem(TROPHIES_KEY, JSON.stringify(this.trophies));
    } catch {
      /* noop */
    }
  }

  /**
   * Estrelas conquistadas: a maior recompensa entre as dificuldades vencidas.
   * Vencer no DeMolay vale 2 mesmo sem ter passado pelo Iniciático — como no
   * Five Nights at Freddy's, o modo mais duro já entrega os anteriores.
   */
  get stars(): number {
    return this.trophies.cleared.reduce((max, id) => {
      const d = DIFFICULTIES.find((x) => x.id === id);
      return d ? Math.max(max, d.estrelas) : max;
    }, 0);
  }

  /**
   * Registra a conclusão de uma dificuldade e o tempo gasto. Devolve quantas
   * estrelas havia antes e depois (para a tela final animar só as novas) e se
   * o tempo bateu o recorde anterior daquela dificuldade.
   */
  recordClear(
    id: DifficultyId,
    timeMs: number
  ): { before: number; after: number; previousBest?: number; isRecord: boolean } {
    const before = this.stars;
    const previousBest = this.trophies.records[id];
    const isRecord = timeMs > 0 && (previousBest === undefined || timeMs < previousBest);

    if (!this.trophies.cleared.includes(id)) this.trophies.cleared.push(id);
    if (isRecord) this.trophies.records[id] = timeMs;
    this.persistTrophies();

    return { before, after: this.stars, previousBest, isRecord };
  }

  // ---------- cronômetro do desafio ----------
  /**
   * Retoma a contagem. Chamado ao entrar na Torre e no Quiz — o tempo corre
   * durante o desafio inteiro e só para na cutscene final com o Rei.
   */
  timerResume() {
    if (this.save && !this.save.finished) this.lastTick = Date.now();
  }

  /** Acumula o intervalo desde o último tick. Chamar uma vez por frame. */
  timerTick() {
    if (!this.save || this.lastTick === null) return;
    const now = Date.now();
    const dt = now - this.lastTick;
    this.lastTick = now;
    // salto grande = aba em segundo plano ou aparelho bloqueado; não conta,
    // senão bastava deixar o jogo aberto para arruinar o próprio tempo
    if (dt > 0 && dt < 2000) this.save.elapsedMs += dt;
  }

  /** Para a contagem e devolve o tempo total do desafio, em ms. */
  timerStop(): number {
    this.timerTick();
    this.lastTick = null;
    const total = this.save?.elapsedMs ?? 0;
    this.persistSave();
    return total;
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
    // zera antes de montar: um save antigo não pode sobreviver a um Novo Jogo
    // nem por engano nem por um campo que se esqueça de redefinir aqui
    this.clearSave();
    this.save = {
      playerName: playerName.trim() || 'Galahad',
      difficulty: this.settings.difficulty,
      candles: dificuldadePorId(this.settings.difficulty)!.trancas.map((locks: number) => ({
        locks,
        lit: false
      })),
      floor: 1,
      protectionActive: false,
      finished: false,
      elapsedMs: 0,
      updatedAt: Date.now()
    };
    this.lastTick = null;
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

  /** Apaga o save do storage e da memória. Os troféus não são tocados. */
  clearSave() {
    this.save = null;
    this.lastTick = null;
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
    this.candle(vela).locks = trancasDe(this.difficulty, vela);
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
    c.locks = Math.min(trancasDe(this.difficulty, vela), c.locks + locksReturned);
    this.persistSave();
    return true;
  }
}

export const State = new GameStateManager();
