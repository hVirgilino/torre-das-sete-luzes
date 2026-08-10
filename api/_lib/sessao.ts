import type { VercelRequest } from '@vercel/node';
import { ErroHttp, lerCookie } from './http.js';
import { sessaoValida } from './cripto.js';

export const COOKIE_SESSAO = 'torre_admin';

/** Porta de todas as rotas de moderação. Sem sessão válida, 401 e ponto. */
export function exigirAdmin(req: VercelRequest): void {
  if (!sessaoValida(lerCookie(req, COOKIE_SESSAO))) {
    throw new ErroHttp(401, 'sessão ausente ou expirada');
  }
}
