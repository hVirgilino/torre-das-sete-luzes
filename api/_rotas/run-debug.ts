import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../_lib/db.js';
import { corpoJson, exigirMetodo, json, rota } from '../_lib/http.js';
import { exigirAdmin } from '../_lib/sessao.js';
import {
  carregarCorrida,
  dificuldadeDa,
  estadoPublico,
  type Vela
} from '../_lib/corrida.js';
import { acertosMinimos } from '../../src/data/difficulty.js';

/**
 * Conclui uma corrida ranqueada sem jogar — para testar o fluxo do ranking.
 *
 * Exige sessão de moderação. Não dá para deixar isso no cliente: ele nunca
 * conhece as respostas, então "acender tudo" localmente só produziria uma tela
 * mentindo, e o `finish` recusaria depois por contagem de acertos.
 *
 * Quem tem a senha do painel pode, portanto, forjar uma linha de ranking. É o
 * preço de existir um atalho de teste — e a mesma pessoa já podia ocultar e
 * censurar linhas. Se um dia o ranking virar competição séria, apague esta
 * rota e o botão que a chama.
 */
export default rota(async (req: VercelRequest, res: VercelResponse) => {
  exigirMetodo(req, res, 'POST');
  exigirAdmin(req);

  const corrida = await carregarCorrida(corpoJson(req));
  const dif = dificuldadeDa(corrida);

  const velas: Vela[] = dif.trancas.map(() => ({ locks: 0, lit: true }));

  await sql`
    update run
       set velas = ${JSON.stringify(velas)}::jsonb,
           acertos = ${acertosMinimos(dif)},
           vista_em = now()
     where id = ${corrida.id} and status = 'ativa'
  `;

  json(res, 200, { ...estadoPublico(corrida, velas), debug: true });
});
