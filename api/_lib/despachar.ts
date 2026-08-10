import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ErroHttp, json, rota } from './http.js';

type Handler = (req: VercelRequest, res: VercelResponse) => Promise<void> | void;

/**
 * Um arquivo de rota dinâmica por pasta, em vez de um por endpoint.
 *
 * O plano Hobby da Vercel permite 12 functions por implantação, e a API tinha
 * 13 — o build passava e o deploy falhava na hora de publicar as saídas. Com
 * `[acao].ts` cada pasta vira uma function só, e as URLs continuam idênticas:
 * /api/run/start, /api/run/answer e companhia seguem funcionando.
 */
export function despachar(mapa: Record<string, Handler>) {
  return rota(async (req: VercelRequest, res: VercelResponse) => {
    const bruto = req.query.acao;
    const acao = Array.isArray(bruto) ? bruto[0] : bruto;
    const handler = acao ? mapa[acao] : undefined;
    // allowlist: só as ações declaradas no mapa existem
    if (!handler) throw new ErroHttp(404, 'rota não encontrada');
    await handler(req, res);
  });
}

export { json };
