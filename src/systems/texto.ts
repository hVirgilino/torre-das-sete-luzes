/**
 * Utilidades de sorteio e de manuseio de palavras, compartilhadas por
 * `questions.ts` e `distratores.ts`.
 *
 * Módulo puro de propósito: as functions da API importam a geração de questões
 * e não podem esbarrar em nada que leia `window` (mesmo motivo de
 * `data/difficulty.ts` existir separado de `data/config.ts`).
 */

import { STOPWORDS } from '../data/lexicon.js';

export const rand = (n: number): number => Math.floor(Math.random() * n);

export const pick = <T,>(arr: T[]): T => arr[rand(arr.length)];

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Palavra sem pontuação e em minúsculas, para comparar e para indexar o léxico. */
export const limpar = (p: string): string => p.replace(/[.,;:!?"“”()]/g, '').toLowerCase();

/** Forma canônica de um trecho — é por ela que duas alternativas são "iguais". */
export const normalizar = (s: string): string => limpar(s).replace(/\s+/g, ' ').trim();

/** Palavra com peso semântico: nem stopword, nem curta demais para virar lacuna. */
export function significativa(palavra: string): boolean {
  const c = limpar(palavra);
  return c.length >= 4 && !STOPWORDS.has(c);
}

/**
 * Palavra partida em pontuação de abertura, núcleo e pontuação de fechamento.
 *
 * Trocar palavra sem isto arrancaria a vírgula junto — e a alternativa que
 * perde a pontuação do texto original se denuncia sozinha.
 */
export interface Pedaco {
  pre: string;
  nucleo: string;
  pos: string;
}

const FATIAS = /^([^\p{L}\p{N}]*)([\p{L}\p{N}'’-]*)([^\p{L}\p{N}]*)$/u;

export function fatiar(palavra: string): Pedaco {
  const m = FATIAS.exec(palavra);
  if (!m) return { pre: '', nucleo: palavra, pos: '' };
  return { pre: m[1], nucleo: m[2], pos: m[3] };
}

export const juntar = (p: Pedaco): string => `${p.pre}${p.nucleo}${p.pos}`;

/** Copia a caixa do modelo para a palavra nova — "Cortesia" não vira "gentileza". */
export function comCaixa(modelo: string, nova: string): string {
  if (!modelo || !nova) return nova;
  const inicial = modelo[0];
  if (inicial !== inicial.toLowerCase()) return nova[0].toUpperCase() + nova.slice(1);
  return nova;
}
