import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../_lib/db.js';
import { corpoJson, ErroHttp, exigirMetodo, json, rota } from '../_lib/http.js';
import { carregarCorrida, dificuldadeDa, todasAcesas, type Corrida } from '../_lib/corrida.js';
import { acertosMinimos } from '../../src/data/difficulty.js';



/**
 * Encerra a corrida e congela o tempo.
 *
 * O tempo é `now() - iniciada_em` calculado no banco, nunca um número enviado
 * pelo cliente. Além disso, só fecha se as sete velas estiverem acesas e se
 * houver acertos suficientes registrados — os dois checados contra linhas que
 * o servidor mesmo escreveu.
 */
export default rota(async (req: VercelRequest, res: VercelResponse) => {
  exigirMetodo(req, res, 'POST');
  const corpo = corpoJson(req);
  const corrida = await carregarCorrida(corpo);

  if (!todasAcesas(corrida.velas)) throw new ErroHttp(409, 'as sete luzes ainda não arderam');
  // mínimo de acertos se nunca se errar — varia com a dificuldade
  if (corrida.acertos < acertosMinimos(dificuldadeDa(corrida))) {
    throw new ErroHttp(409, 'a contagem de acertos não fecha com o desafio');
  }

  const linhas = (await sql`
    update run
       set status = 'concluida',
           concluida_em = now(),
           duracao_ms = greatest(1, (extract(epoch from (now() - iniciada_em)) * 1000)::int)
     where id = ${corrida.id} and status = 'ativa'
     returning id, nome, dificuldade, duracao_ms, acertos, erros
  `) as unknown as (Corrida & { duracao_ms: number })[];

  const fim = linhas[0];
  if (!fim) throw new ErroHttp(409, 'esta corrida já foi encerrada');

  json(res, 200, {
    duracaoMs: fim.duracao_ms,
    acertos: fim.acertos,
    erros: fim.erros,
    dificuldade: fim.dificuldade,
    estrelas: dificuldadeDa(corrida).estrelas,
    podeSubmeter: true
  });
});
