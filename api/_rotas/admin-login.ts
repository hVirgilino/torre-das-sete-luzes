import type { VercelRequest, VercelResponse } from '@vercel/node';
import { corpoJson, ErroHttp, exigirMetodo, ipDoPedido, json, rota } from '../_lib/http';
import { criarSessao, hashIp, senhaConfere } from '../_lib/cripto';
import { limitar } from '../_lib/limite';
import { COOKIE_SESSAO } from '../_lib/sessao';

/**
 * Login do painel de moderação.
 *
 * A senha só existe como scrypt em variável de ambiente — não há tabela de
 * admin, então vazar o banco não dá acesso ao painel. O rate limit é o que
 * torna a senha viável na prática: sem ele, uma senha memorizável por humano
 * cai em brute force.
 */
export default rota(async (req: VercelRequest, res: VercelResponse) => {
  exigirMetodo(req, res, 'POST');

  const ip = hashIp(ipDoPedido(req));
  await limitar(`admin:login:${ip ?? 'sem-ip'}`, 5, 900);

  const guardado = process.env.ADMIN_PASSWORD_HASH;
  if (!guardado) throw new ErroHttp(503, 'painel não configurado');

  const senha = corpoJson(req).senha;
  // resposta idêntica para senha errada e campo ausente: nada distingue os casos
  if (typeof senha !== 'string' || !(await senhaConfere(senha, guardado))) {
    throw new ErroHttp(401, 'senha incorreta');
  }

  res.setHeader(
    'Set-Cookie',
    // HttpOnly: script de página não lê. SameSite=Strict: não viaja em pedido
    // vindo de outro site, o que fecha CSRF nas rotas de moderação.
    `${COOKIE_SESSAO}=${criarSessao()}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=7200`
  );
  json(res, 200, { ok: true });
});
