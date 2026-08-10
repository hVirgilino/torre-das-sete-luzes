import type { VercelRequest, VercelResponse } from '@vercel/node';
import { corpoJson, ErroHttp, exigirMetodo, ipDoPedido, json, rota } from './_lib/http';
import { hashIp, senhaConfere } from './_lib/cripto';
import { limitar } from './_lib/limite';

/**
 * Libera a tela de manutenção mediante senha.
 *
 * Existe como rota, e não como uma comparação no cliente, por um motivo só: a
 * senha (ou o hash dela) não pode ir no bundle. Qualquer pessoa abriria o
 * devtools, leria o valor e — como é a mesma senha do painel de moderação —
 * levaria o painel junto.
 *
 * Use MANUTENCAO_HASH para desacoplar as duas: se essa variável existir, ela
 * manda; senão vale a senha do painel.
 */
export default rota(async (req: VercelRequest, res: VercelResponse) => {
  exigirMetodo(req, res, 'POST');

  // mesmo teto do login do painel: sem isso, a senha cairia em força bruta
  await limitar(`manutencao:${hashIp(ipDoPedido(req)) ?? 'sem-ip'}`, 5, 900);

  const guardado = process.env.MANUTENCAO_HASH || process.env.ADMIN_PASSWORD_HASH;
  if (!guardado) throw new ErroHttp(503, 'liberação não configurada');

  const senha = corpoJson(req).senha;
  if (typeof senha !== 'string' || !(await senhaConfere(senha, guardado))) {
    throw new ErroHttp(401, 'sequência incorreta');
  }

  json(res, 200, { ok: true });
});
