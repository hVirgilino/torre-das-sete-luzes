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

/**
 * Trancas por andar (índice 0 = andar 1) — progressão crescente: o andar N tem N+1 trancas.
 * Para outra curva, basta trocar o array, ex.: [2, 4, 6, 8, 10, 12, 14].
 */
export const LOCKS_PER_FLOOR = [2, 3, 4, 5, 6, 7, 8];

/** Trancas que retornam ao usar a habilidade daquela vela */
export const LOCKS_RETURNED_ON_ABILITY = 1;

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

export const dificuldadePorId = (id: string): Difficulty | undefined =>
  DIFFICULTIES.find((d) => d.id === id);
