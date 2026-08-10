import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../_lib/db.js';
import { corpoJson, ErroHttp, exigirMetodo, ipDoPedido, json, rota } from '../_lib/http.js';
import { hashIp } from '../_lib/cripto.js';
import { exigirAdmin } from '../_lib/sessao.js';
import {
  ErroEntrada,
  LIMITE_MOTIVO,
  LIMITE_NOME,
  textoOpcional,
  uuid
} from '../_lib/validar.js';

const ACOES = ['ocultar', 'restaurar', 'censurar'] as const;
type Acao = (typeof ACOES)[number];

/**
 * Modera uma linha do ranking.
 *
 * Nada é apagado de verdade: ocultar é uma coluna, e censurar sobrepõe o nome
 * exibido sem perder o original. Assim dá para desfazer, e dá para responder
 * "por que meu nome sumiu?" com o registro na mão.
 */
export default rota(async (req: VercelRequest, res: VercelResponse) => {
  exigirMetodo(req, res, 'POST');
  exigirAdmin(req);

  const corpo = corpoJson(req);
  const id = uuid(corpo.id, 'id');
  const acao = corpo.acao as Acao;
  if (!ACOES.includes(acao)) throw new ErroEntrada('ação inválida');

  const motivo = textoOpcional(corpo.motivo, LIMITE_MOTIVO);
  const nomeExibicao = textoOpcional(corpo.nomeExibicao, LIMITE_NOME);

  let alteradas: { id: string }[];
  if (acao === 'ocultar') {
    alteradas = (await sql`
      update ranking set oculto = true, motivo = ${motivo}, moderado_em = now()
       where id = ${id} returning id
    `) as unknown as { id: string }[];
  } else if (acao === 'restaurar') {
    alteradas = (await sql`
      update ranking set oculto = false, motivo = null, nome_exibicao = null,
                         moderado_em = now()
       where id = ${id} returning id
    `) as unknown as { id: string }[];
  } else {
    alteradas = (await sql`
      update ranking set nome_exibicao = ${nomeExibicao ?? 'Cavaleiro anônimo'},
                         motivo = ${motivo}, moderado_em = now()
       where id = ${id} returning id
    `) as unknown as { id: string }[];
  }

  if (!alteradas.length) throw new ErroHttp(404, 'entrada não encontrada');

  await sql`
    insert into admin_log (acao, ranking_id, detalhe, ip_hash)
    values (${acao}, ${id},
            ${JSON.stringify({ motivo, nomeExibicao })}::jsonb,
            ${hashIp(ipDoPedido(req))})
  `;

  json(res, 200, { ok: true, acao, id });
});
