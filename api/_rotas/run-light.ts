import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../_lib/db.js';
import { corpoJson, ErroHttp, exigirMetodo, json, rota } from '../_lib/http.js';
import {
  acenderVela,
  carregarCorrida,
  estadoPublico,
  velaValida,
  type Vela
} from '../_lib/corrida.js';

/** Acende uma vela cujas trancas já caíram — o servidor confere que caíram. */
export default rota(async (req: VercelRequest, res: VercelResponse) => {
  exigirMetodo(req, res, 'POST');
  const corpo = corpoJson(req);
  const corrida = await carregarCorrida(corpo);
  const vela = velaValida(corpo.vela);

  const velas: Vela[] = corrida.velas;
  if (velas[vela - 1].lit) throw new ErroHttp(409, 'esta vela já está acesa');
  if (!acenderVela(velas, vela)) throw new ErroHttp(409, 'ainda há trancas nesta vela');

  await sql`
    update run set velas = ${JSON.stringify(velas)}::jsonb, vista_em = now()
     where id = ${corrida.id}
  `;

  json(res, 200, { vela, ...estadoPublico(corrida, velas) });
});
