/** Configuração central de game design. Ajuste aqui, o jogo inteiro obedece. */

/** Altura lógica — fixa. Todo o design vertical (andares, HUD) depende dela. */
export const GAME_HEIGHT = 540;

/** Largura do design original; nenhuma tela recebe menos mundo que isto. */
const DESIGN_WIDTH = 960;
/** Teto para telas ultralargas, senão o cenário se espalha demais. */
const MAX_WIDTH = 1280;

export const isTouchDevice = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches === true;

/**
 * Largura lógica do mundo, deduzida da proporção real da tela.
 *
 * Um celular alto como o S24 é 19,5:9 — com a largura fixa em 960 (16:9) o
 * jogo aparecia encaixado no meio com tarjas pretas grossas dos dois lados.
 * Esticando a largura lógica até a proporção do aparelho, o cenário ocupa a
 * tela inteira sem deformar nada: o mundo é mais largo, não esticado.
 *
 * Telas mais "quadradas" que 16:9 continuam em 960 com letterbox, como antes.
 */
/**
 * Medidas da tela em CSS px. No celular vale `screen`, não `innerWidth`: a
 * barra de endereço do Android come dezenas de pixels da altura e voltaria
 * uma proporção diferente a cada carregamento da página.
 */
export function screenSize(): { w: number; h: number } {
  if (!isTouchDevice() || !window.screen?.width || !window.screen?.height) {
    return { w: window.innerWidth, h: window.innerHeight };
  }
  return { w: window.screen.width, h: window.screen.height };
}

function logicalWidth(): number {
  if (typeof window === 'undefined') return DESIGN_WIDTH;
  const { w, h } = screenSize();
  if (!w || !h) return DESIGN_WIDTH;
  // no celular o jogo é sempre jogado deitado, então vale a proporção em
  // paisagem mesmo se a página abrir em pé (aí o overlay pede para girar)
  const aspect = isTouchDevice() ? Math.max(w, h) / Math.min(w, h) : w / h;
  const wanted = GAME_HEIGHT * aspect;
  const clamped = Math.min(Math.max(wanted, DESIGN_WIDTH), MAX_WIDTH);
  return Math.round(clamped / 2) * 2; // par, para não gerar meio pixel
}

export const GAME_WIDTH = logicalWidth();

/**
 * Deslocamento para centralizar composições desenhadas no design de 960.
 * Os fundos são pintados em canvas: o que precisa alcançar as bordas (céu,
 * chão, montanhas) usa GAME_WIDTH; o que é uma cena fechada (o castelo, o
 * trono) continua em coordenadas de 960 e só anda para o meio por aqui.
 */
export const DESIGN_DX = (GAME_WIDTH - DESIGN_WIDTH) / 2;

/** Faixas da vitrola (definidas em data/tracks.ts) */
export type TrackId = 'festiva' | 'epica' | 'taverna';

/** Resoluções de renderização 16:9 (definidas em systems/display.ts) */
export type ResolutionId = '540' | '720' | '1080' | '1440';

/** Degraus de escala da interface */
export const UI_SCALES = [0.8, 1, 1.15, 1.3] as const;

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
  /** estrelas que concluir esta dificuldade garante (Escudeiro não dá nenhuma) */
  estrelas: number;
  /** o que o Rei diz na tela de fim de jogo neste modo */
  mensagemFinal: string;
}

/** Total de estrelas possíveis — a vitrine do menu tem sempre este tamanho. */
export const MAX_ESTRELAS = 3;

export const DIFFICULTIES: Difficulty[] = [
  {
    id: 'escudeiro',
    nome: 'Escudeiro',
    descricao: '20s · 2 opções · poucas palavras',
    tempo: 20,
    opcoes: 2,
    lacuna: 'palavra',
    banco: ['vela'],
    estrelas: 0,
    mensagemFinal:
      'Parabéns, Sir! As sete luzes arderam sob vossa guarda. Mas o Escudeiro ainda ' +
      'não conhece o peso da armadura — que tal enfrentar a Torre no modo Iniciático?'
  },
  {
    id: 'iniciatico',
    nome: 'Iniciático',
    descricao: '15s · 3 opções · mais palavras',
    tempo: 15,
    opcoes: 3,
    lacuna: 'palavras',
    banco: ['vela', 'abertura'],
    estrelas: 1,
    mensagemFinal:
      'Vossa primeira estrela, Sir. O Iniciático já não tropeça nas palavras da ' +
      'Cerimônia — mas o grau de DeMolay exige recitá-la de cor. Ousais?'
  },
  {
    id: 'demolay',
    nome: 'DeMolay',
    descricao: '10s · 4 opções · frases inteiras',
    tempo: 10,
    opcoes: 4,
    lacuna: 'frase',
    banco: ['vela', 'abertura', 'encerramento'],
    estrelas: 2,
    mensagemFinal:
      'Duas estrelas, Sir. Recitastes a Cerimônia inteira sem hesitar — poucos ' +
      'chegam aqui. Resta a prova do Cavaleiro: as mesmas palavras, metade do tempo.'
  },
  {
    id: 'cavaleiro',
    nome: 'Cavaleiro',
    descricao: '5s · 4 opções · frases inteiras',
    tempo: 5,
    opcoes: 4,
    lacuna: 'frase',
    banco: ['vela', 'abertura', 'encerramento'],
    estrelas: 3,
    mensagemFinal:
      'Sois digno deste grau, Sir. Vencestes a Torre na maior dificuldade, com o ' +
      'tempo correndo contra vós a cada palavra. As três estrelas são vossas — ' +
      'nada mais há nesta Torre que possa vos ensinar.'
  }
];

/**
 * Trancas por andar (índice 0 = andar 1) — progressão crescente: o andar N tem N+1 trancas.
 * Para outra curva, basta trocar o array, ex.: [2, 4, 6, 8, 10, 12, 14].
 */
export const LOCKS_PER_FLOOR = [2, 3, 4, 5, 6, 7, 8];

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
