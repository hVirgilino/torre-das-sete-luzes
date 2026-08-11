/** Configuração central de game design. Ajuste aqui, o jogo inteiro obedece. */

/** Altura lógica — fixa. Todo o design vertical (andares, HUD) depende dela. */
export const GAME_HEIGHT = 540;

/** Largura do design original; nenhuma tela recebe menos mundo que isto. */
const DESIGN_WIDTH = 960;
/**
 * Teto para telas ultralargas, senão o cenário se espalha demais.
 *
 * Já foi tentado subir isto no celular deitado, para acabar com as tarjas
 * pretas das laterais. Não compensa: alargar o mundo não aumenta nada na tela
 * (a altura lógica é fixa em 540 e é ela que manda na escala), só põe mais
 * chão para o cavaleiro atravessar a pé — e o ranking é por tempo, então quem
 * jogasse num aparelho mais largo correria mais metros pela mesma partida.
 */
const MAX_WIDTH = 1280;

export const isTouchDevice = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches === true;

/** Área realmente visível em CSS px — o que sobra depois da barra do navegador. */
export function viewportSize(): { w: number; h: number } {
  const vv = typeof window !== 'undefined' ? window.visualViewport : null;
  return {
    w: Math.round(vv?.width || window.innerWidth),
    h: Math.round(vv?.height || window.innerHeight)
  };
}

/**
 * Medidas que definem a proporção do mundo.
 *
 * No celular **deitado** vale a área visível: ela já desconta a barra do
 * navegador, que é justamente o que torna a tela útil mais larga que a do
 * aparelho. Em pé ela não serve de nada (o jogo ainda vai ser girado, e a
 * proporção de pé é o inverso da que interessa), então aí vale `screen` — e é
 * também por isso que não se usa `innerHeight` no Android, onde a barra de
 * endereço aparece e some e devolveria uma proporção diferente a cada carga.
 */
export function screenSize(): { w: number; h: number } {
  const visivel = viewportSize();
  if (!isTouchDevice() || !window.screen?.width || !window.screen?.height) return visivel;
  if (visivel.w > visivel.h && visivel.w > 0 && visivel.h > 0) return visivel;
  return { w: window.screen.width, h: window.screen.height };
}

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

// dificuldades, trancas e estrelas vivem em ./difficulty (módulo puro, usado
// também pelas functions da API); reexportados aqui para não quebrar imports
export * from './difficulty';

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
