/**
 * Definições de dificuldade, separadas de `config.ts` de propósito.
 *
 * As functions da API precisam destes dados para sortear e validar perguntas,
 * e `config.ts` lê `window` para deduzir a largura da tela — importar aquele
 * arquivo no servidor funcionaria hoje por causa das guardas, mas quebraria no
 * dia em que alguém acrescentasse uma linha de browser lá. Aqui não há esse
 * risco: este módulo é puro.
 */

export type DifficultyId = 'escudeiro' | 'iniciatico' | 'demolay' | 'cavaleiro';

export interface Difficulty {
  id: DifficultyId;
  nome: string;
  descricao: string;
  /** segundos por questão */
  tempo: number;
  /** número de alternativas exibidas */
  opcoes: number;
  /** quantas palavras somem por lacuna: [mínimo, máximo] */
  palavras: [number, number];
  /**
   * De onde vêm as alternativas falsas:
   * - `texto`: recortes de outros trechos da Cerimônia (o assunto errado entrega);
   * - `misto`: uma variação da própria resposta, o resto de outros trechos;
   * - `proximo`: todas variações da resposta, a uma palavra de distância.
   */
  distratores: 'texto' | 'misto' | 'proximo';
  /**
   * Chance de a questão sair da vela do andar em que se está. O resto vem do
   * banco liberado — quanto menor, mais o jogador precisa conhecer a Cerimônia
   * inteira, e não só o trecho que acabou de ler na porta.
   */
  focoVela: number;
  /**
   * Se as **outras** velas também podem cair como pergunta. Nos modos brandos
   * não: o jogador ainda está lendo o texto de cada vela ao chegar nela, e ser
   * arguido sobre um andar que não visitou seria injusto. Do DeMolay para cima
   * a Cerimônia se cobra inteira, em qualquer ordem.
   */
  todasAsVelas: boolean;
  /** quais partes do texto entram no banco de questões */
  banco: Array<'vela' | 'abertura' | 'encerramento'>;
  /** estrelas que concluir esta dificuldade garante (Escudeiro não dá nenhuma) */
  estrelas: number;
  /** o que o Rei diz na tela de fim de jogo neste modo */
  mensagemFinal: string;
  /** trancas de cada vela (índice 0 = vela/andar 1) */
  trancas: number[];
}

/** Total de estrelas possíveis — a vitrine do menu tem sempre este tamanho. */
export const MAX_ESTRELAS = 3;

/**
 * Trancas por vela, por dificuldade — a curva de esforço de cada modo.
 *
 * O Cavaleiro já subiu até 14 trancas na última vela e a conta não fechava: 56
 * acertos com o mesmo tipo de pergunta viram repetição, não desafio. Ele agora
 * usa a mesma escada do DeMolay (1 a 7) e cobra o preço em outro lugar — cinco
 * segundos, questões de qualquer ponto da Cerimônia e quatro alternativas que
 * diferem por uma palavra (ver `distratores` e `focoVela`).
 */
const TRANCAS = {
  escudeiro: [1, 1, 1, 1, 1, 1, 1],
  iniciatico: [2, 2, 2, 4, 4, 4, 4],
  demolay: [1, 2, 3, 4, 5, 6, 7],
  cavaleiro: [1, 2, 3, 4, 5, 6, 7]
} as const;

/** Número de velas da Torre — a contagem não muda com a dificuldade. */
export const TOTAL_VELAS = 7;

/** Trancas de uma vela na dificuldade dada. */
export const trancasDe = (d: Difficulty, vela: number): number => d.trancas[vela - 1];

/** Total de respostas certas para vencer sem errar nenhuma. */
export const acertosMinimos = (d: Difficulty): number =>
  d.trancas.reduce((s, n) => s + n, 0);

/** Trancas que retornam ao usar a habilidade daquela vela */
export const LOCKS_RETURNED_ON_ABILITY = 1;

export const DIFFICULTIES: Difficulty[] = [
  {
    id: 'escudeiro',
    trancas: [...TRANCAS.escudeiro],
    nome: 'Escudeiro',
    descricao: '20s · 2 opções · uma palavra',
    tempo: 20,
    opcoes: 2,
    palavras: [1, 1],
    distratores: 'texto',
    focoVela: 1,
    todasAsVelas: false,
    banco: ['vela'],
    estrelas: 0,
    mensagemFinal:
      'Parabéns, Sir! As sete luzes arderam sob vossa guarda. Mas o Escudeiro ainda ' +
      'não conhece o peso da armadura — que tal enfrentar a Torre no modo Iniciático?'
  },
  {
    id: 'iniciatico',
    trancas: [...TRANCAS.iniciatico],
    nome: 'Iniciático',
    descricao: '15s · 3 opções · duas ou três palavras',
    tempo: 15,
    opcoes: 3,
    palavras: [2, 3],
    distratores: 'texto',
    focoVela: 0.7,
    todasAsVelas: false,
    banco: ['vela', 'abertura'],
    estrelas: 1,
    mensagemFinal:
      'Vossa primeira estrela, Sir. O Iniciático já não tropeça nas palavras da ' +
      'Cerimônia — mas o grau de DeMolay exige recitá-la de cor. Ousais?'
  },
  {
    id: 'demolay',
    trancas: [...TRANCAS.demolay],
    nome: 'DeMolay',
    descricao: '10s · 4 opções · frases inteiras · uma pegadinha por questão',
    tempo: 10,
    opcoes: 4,
    palavras: [4, 6],
    distratores: 'misto',
    focoVela: 0.6,
    todasAsVelas: true,
    banco: ['vela', 'abertura', 'encerramento'],
    estrelas: 2,
    mensagemFinal:
      'Duas estrelas, Sir. Recitastes a Cerimônia inteira sem hesitar — poucos ' +
      'chegam aqui. Resta a prova do Cavaleiro: as mesmas trancas, metade do ' +
      'tempo e quatro alternativas separadas por uma única palavra.'
  },
  {
    id: 'cavaleiro',
    trancas: [...TRANCAS.cavaleiro],
    nome: 'Cavaleiro',
    descricao: '5s · 4 opções quase idênticas · Cerimônia inteira',
    tempo: 5,
    opcoes: 4,
    palavras: [5, 7],
    distratores: 'proximo',
    // 45%: no Cavaleiro a vela do andar quase não protege — a maioria das
    // questões vem da abertura e do encerramento, as partes que ninguém decora
    focoVela: 0.45,
    todasAsVelas: true,
    banco: ['vela', 'abertura', 'encerramento'],
    estrelas: 3,
    mensagemFinal:
      'Sois digno deste grau, Sir. Vencestes a Torre onde as quatro alternativas ' +
      'se distinguem por uma palavra só, e ainda assim escolhestes a da ' +
      'Cerimônia. As três estrelas são vossas — nada mais há nesta Torre que ' +
      'possa vos ensinar.'
  }
];

export const dificuldadePorId = (id: string): Difficulty | undefined =>
  DIFFICULTIES.find((d) => d.id === id);
