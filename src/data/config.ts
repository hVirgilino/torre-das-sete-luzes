/** Configuração central de game design. Ajuste aqui, o jogo inteiro obedece. */

export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 540;

export type DifficultyId = 'escudeiro' | 'iniciatico' | 'demolay' | 'cavaleiro';

export interface Difficulty {
  id: DifficultyId;
  nome: string;
  descricao: string;
  /** segundos por questão */
  tempo: number;
  /** número de alternativas exibidas */
  opcoes: number;
  /** quantas palavras somem por lacuna: 'palavra' | 'palavras' | 'frase' */
  lacuna: 'palavra' | 'palavras' | 'frase';
  /** quais partes do texto entram no banco de questões */
  banco: Array<'vela' | 'abertura' | 'encerramento'>;
}

export const DIFFICULTIES: Difficulty[] = [
  {
    id: 'escudeiro',
    nome: 'Escudeiro',
    descricao: '10s · 2 opções · poucas palavras',
    tempo: 10,
    opcoes: 2,
    lacuna: 'palavra',
    banco: ['vela']
  },
  {
    id: 'iniciatico',
    nome: 'Iniciático',
    descricao: '10s · 3 opções · mais palavras',
    tempo: 10,
    opcoes: 3,
    lacuna: 'palavras',
    banco: ['vela', 'abertura']
  },
  {
    id: 'demolay',
    nome: 'DeMolay',
    descricao: '10s · 4 opções · frases inteiras',
    tempo: 10,
    opcoes: 4,
    lacuna: 'frase',
    banco: ['vela', 'abertura', 'encerramento']
  },
  {
    id: 'cavaleiro',
    nome: 'Cavaleiro',
    descricao: '5s · 4 opções · frases inteiras',
    tempo: 5,
    opcoes: 4,
    lacuna: 'frase',
    banco: ['vela', 'abertura', 'encerramento']
  }
];

/**
 * Trancas por andar (índice 0 = andar 1).
 * Definido pelo design: 2 trancas por nível.
 * Para escalar por andar, troque por, ex.: [2, 4, 6, 8, 10, 12, 14].
 */
export const LOCKS_PER_FLOOR = [2, 2, 2, 2, 2, 2, 2];

/** Trancas que retornam ao usar a habilidade daquela vela */
export const LOCKS_RETURNED_ON_ABILITY = 1;

export type AbilityId =
  | 'eliminarFalsa'
  | 'preencherLacuna'
  | 'congelarTempo'
  | 'impedirReset'
  | 'protegerVela'
  | 'eliminarTranca'
  | 'luzPlena';

export interface Ability {
  id: AbilityId;
  /** vela (1–7) que concede a habilidade — ordenadas por vantagem crescente */
  vela: number;
  nome: string;
  descricao: string;
  /** utilizável dentro do quiz */
  emQuiz: boolean;
}

export const ABILITIES: Ability[] = [
  {
    id: 'eliminarFalsa',
    vela: 1,
    nome: 'Olhar do Ágape',
    descricao: 'Elimina uma alternativa falsa da questão atual.',
    emQuiz: true
  },
  {
    id: 'preencherLacuna',
    vela: 2,
    nome: 'Sopro da Fé',
    descricao: 'Revela parte da resposta e encurta uma alternativa falsa.',
    emQuiz: true
  },
  {
    id: 'congelarTempo',
    vela: 3,
    nome: 'Gentileza do Tempo',
    descricao: 'Congela o tempo na questão atual.',
    emQuiz: true
  },
  {
    id: 'impedirReset',
    vela: 4,
    nome: 'Elo dos Irmãos',
    descricao: 'Se errar esta questão, as trancas não voltam.',
    emQuiz: true
  },
  {
    id: 'protegerVela',
    vela: 5,
    nome: 'Voto de Fidelidade',
    descricao: 'A próxima habilidade usada não apaga sua vela.',
    emQuiz: true
  },
  {
    id: 'eliminarTranca',
    vela: 6,
    nome: 'Pensamento Puro',
    descricao: 'Destrói uma tranca instantaneamente.',
    emQuiz: true
  },
  {
    id: 'luzPlena',
    vela: 7,
    nome: 'Luz Plena',
    descricao: 'Revela e responde corretamente a questão atual.',
    emQuiz: true
  }
];

export const abilityByVela = (vela: number): Ability =>
  ABILITIES.find((a) => a.vela === vela)!;

/** Paleta — noite medieval iluminada por velas */
export const PALETTE = {
  night: 0x0b1026,
  nightDeep: 0x060a1c,
  stoneDark: 0x2a2f45,
  stone: 0x3d4463,
  stoneLight: 0x565e85,
  wood: 0x5b3a1e,
  woodLight: 0x7a5227,
  flame: 0xffc24d,
  flameHot: 0xfff0b8,
  ember: 0xff8a3c,
  parchment: 0xf3e6c4,
  parchmentDark: 0xdcc494,
  ink: 0x2c1c08,
  crimson: 0x7a1f1f,
  crimsonLight: 0xa53434,
  royal: 0x27408b,
  gold: 0xd9a441,
  moon: 0xe8ecff
} as const;

export const FONTS = {
  display: '"Cinzel", serif',
  body: '"IM Fell English", serif'
} as const;
