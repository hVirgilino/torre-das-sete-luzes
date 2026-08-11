import type { VercelRequest, VercelResponse } from '@vercel/node';
import { corpoJson, ErroHttp, exigirMetodo, ipDoPedido, json, rota } from '../_lib/http.js';
import { hashIp, iguais, senhaConfere } from '../_lib/cripto.js';
import { limitar } from '../_lib/limite.js';

/**
 * Código do cofre desenhado na tela de manutenção, quando MANUTENCAO_CODIGO não
 * está definida. Ter padrão é o ponto: o cofre precisa abrir num deploy limpo,
 * sem ninguém configurar variável nenhuma.
 */
const CODIGO_PADRAO = '199';

/**
 * Libera a tela de manutenção mediante código do cofre ou senha.
 *
 * Existe como rota, e não como uma comparação no cliente, por um motivo só: o
 * segredo (ou o hash dele) não pode ir no bundle. Qualquer pessoa abriria o
 * devtools, leria o valor e — como é a mesma senha do painel de moderação —
 * levaria o painel junto.
 *
 * Dois caminhos, conferidos nesta ordem:
 *
 * 1. MANUTENCAO_CODIGO (padrão '199') — os três dígitos do cofre. Três dígitos
 *    dão 1000 combinações, então o que segura a força bruta é o rate limit
 *    abaixo, não o tamanho do segredo. E não deveria segurar mais que isso:
 *    atravessar a manutenção não dá poder nenhum sobre o jogo nem sobre o
 *    banco — é uma tranca social, e a própria tela diz isso. Fronteira de
 *    segurança de verdade é a sessão do painel de moderação, que esta rota não
 *    toca.
 * 2. MANUTENCAO_HASH ou ADMIN_PASSWORD_HASH — a senha antiga, via scrypt, que
 *    continua valendo para quem já a usava.
 *
 * MANUTENCAO_CODIGO='' (string vazia) desliga o caminho do código e deixa só o
 * hash — daí a escolha de `??` e não `||` ao ler a variável.
 */
export default rota(async (req: VercelRequest, res: VercelResponse) => {
  exigirMetodo(req, res, 'POST');

  // mesmo teto do login do painel: sem isso, o código cairia em força bruta
  await limitar(`manutencao:${hashIp(ipDoPedido(req)) ?? 'sem-ip'}`, 5, 900);

  const codigo = process.env.MANUTENCAO_CODIGO ?? CODIGO_PADRAO;
  const guardado = process.env.MANUTENCAO_HASH || process.env.ADMIN_PASSWORD_HASH;
  // 503 só quando não sobrou caminho nenhum: com o padrão do código, isto agora
  // exige que alguém tenha desligado o cofre de propósito
  if (!codigo && !guardado) throw new ErroHttp(503, 'liberação não configurada');

  const senha = corpoJson(req).senha;
  if (typeof senha === 'string') {
    // tempo constante: comparar com === vazaria o código dígito a dígito
    if (codigo && iguais(senha, codigo)) return json(res, 200, { ok: true });
    if (guardado && (await senhaConfere(senha, guardado))) return json(res, 200, { ok: true });
  }

  throw new ErroHttp(401, 'código incorreto');
});
