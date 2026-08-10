import { sql } from './db.js';
import { ErroHttp } from './http.js';
import { tokenValido } from './cripto.js';
import { uuid, inteiro } from './validar.js';
import {
  LOCKS_RETURNED_ON_ABILITY,
  TOTAL_VELAS as VELAS_DA_TORRE,
  dificuldadePorId,
  trancasDe,
  type Difficulty
} from '../../src/data/difficulty.js';
import type { QuestionHistory } from '../../src/systems/questions.js';

export interface Vela {
  locks: number;
  lit: boolean;
}

export interface Corrida {
  id: string;
  nome: string;
  dificuldade: string;
  status: string;
  velas: Vela[];
  protecao_ativa: boolean;
  historico: QuestionHistory;
  acertos: number;
  erros: number;
  iniciada_em: string;
  concluida_em: string | null;
  duracao_ms: number | null;
}

export const TOTAL_VELAS = VELAS_DA_TORRE;

/**
 * Folga de rede somada ao prazo da questão. Sem ela, quem joga em 4G perderia
 * questões por latência, não por não saber a resposta. Um segundo e meio é
 * generoso o bastante para o pior caso e curto demais para virar vantagem.
 */
export const FOLGA_REDE_MS = 1500;

/** Tempo sem interação que faz uma corrida ser considerada abandonada. */
export const OCIOSA_MS = 30 * 60 * 1000;

export const velasIniciais = (d: Difficulty): Vela[] =>
  d.trancas.map((locks) => ({ locks, lit: false }));

export const todasAcesas = (velas: Vela[]) =>
  velas.length === TOTAL_VELAS && velas.every((v) => v.lit && v.locks === 0);

/**
 * Carrega a corrida provando posse pelo token assinado. É o portão de todas as
 * rotas de partida: sem isto, bastaria adivinhar um uuid para mexer na corrida
 * de outra pessoa.
 */
export async function carregarCorrida(
  corpo: Record<string, unknown>,
  opcoes: { exigirAtiva?: boolean } = {}
): Promise<Corrida> {
  const id = uuid(corpo.runId, 'runId');
  if (!tokenValido(id, corpo.token)) throw new ErroHttp(403, 'corrida não autorizada');

  const linhas = (await sql`
    select id, nome, dificuldade, status, velas, protecao_ativa, historico,
           acertos, erros, iniciada_em, concluida_em, duracao_ms
      from run where id = ${id}
  `) as unknown as Corrida[];

  const corrida = linhas[0];
  if (!corrida) throw new ErroHttp(404, 'corrida não encontrada');

  if (opcoes.exigirAtiva !== false) {
    if (corrida.status !== 'ativa') throw new ErroHttp(409, 'esta corrida já foi encerrada');
    const ocioso = Date.now() - new Date(corrida.iniciada_em).getTime();
    if (ocioso > OCIOSA_MS + 4 * 60 * 60 * 1000) {
      await sql`update run set status = 'abandonada' where id = ${id}`;
      throw new ErroHttp(409, 'esta corrida expirou');
    }
  }
  return corrida;
}

export function dificuldadeDa(corrida: Corrida): Difficulty {
  const d = dificuldadePorId(corrida.dificuldade);
  if (!d) throw new ErroHttp(500, 'dificuldade inconsistente');
  return d;
}

export function velaValida(valor: unknown): number {
  return inteiro(valor, 1, TOTAL_VELAS, 'vela');
}

// ------------------------------------------------------ regras das trancas
// Espelham src/systems/state.ts. Quem mudar as regras lá precisa mudar aqui,
// senão o modo ranqueado passa a divergir do casual.

export function removerTranca(velas: Vela[], vela: number) {
  const v = velas[vela - 1];
  if (v.locks > 0) v.locks--;
}

export function reporTrancas(velas: Vela[], vela: number, d: Difficulty) {
  velas[vela - 1].locks = trancasDe(d, vela);
}

export function acenderVela(velas: Vela[], vela: number): boolean {
  const v = velas[vela - 1];
  if (v.locks !== 0) return false;
  v.lit = true;
  return true;
}

/** Custo da habilidade: apaga a vela e devolve trancas, salvo proteção ativa. */
export function apagarPorHabilidade(
  velas: Vela[],
  vela: number,
  protecaoAtiva: boolean,
  d: Difficulty
): { apagou: boolean; protecaoAtiva: boolean } {
  if (protecaoAtiva) return { apagou: false, protecaoAtiva: false };
  const v = velas[vela - 1];
  v.lit = false;
  v.locks = Math.min(trancasDe(d, vela), v.locks + LOCKS_RETURNED_ON_ABILITY);
  return { apagou: true, protecaoAtiva };
}

/** Estado que o cliente pode conhecer — nunca inclui resposta de pergunta. */
export function estadoPublico(corrida: Corrida, velas = corrida.velas) {
  return {
    velas,
    protecaoAtiva: corrida.protecao_ativa,
    acertos: corrida.acertos,
    erros: corrida.erros,
    completa: todasAcesas(velas)
  };
}
