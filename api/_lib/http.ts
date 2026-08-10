import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ErroEntrada } from './validar';

/** Erro com código HTTP próprio — mensagem segura para mostrar ao jogador. */
export class ErroHttp extends Error {
  constructor(readonly status: number, mensagem: string) {
    super(mensagem);
    this.name = 'ErroHttp';
  }
}

export function json(res: VercelResponse, status: number, corpo: unknown) {
  // a API não é cacheável: ranking muda e resposta de corrida é por jogador
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.status(status).json(corpo);
}

/** Só aceita os métodos listados; responde 405 no resto. */
export function exigirMetodo(req: VercelRequest, res: VercelResponse, ...metodos: string[]) {
  if (!metodos.includes(req.method ?? '')) {
    res.setHeader('Allow', metodos.join(', '));
    throw new ErroHttp(405, 'método não permitido');
  }
}

export function corpoJson(req: VercelRequest): Record<string, unknown> {
  const b = req.body;
  if (b && typeof b === 'object' && !Array.isArray(b)) return b as Record<string, unknown>;
  if (typeof b === 'string') {
    try {
      const p = JSON.parse(b);
      if (p && typeof p === 'object' && !Array.isArray(p)) return p;
    } catch {
      throw new ErroHttp(400, 'corpo inválido');
    }
  }
  return {};
}

/**
 * IP do cliente. Na Vercel o cabeçalho é escrito pela borda, então o primeiro
 * item é o real; confiar no último deixaria o cliente injetar o próprio.
 */
export function ipDoPedido(req: VercelRequest): string | undefined {
  const h = req.headers['x-forwarded-for'];
  const bruto = Array.isArray(h) ? h[0] : h;
  return bruto?.split(',')[0]?.trim() || undefined;
}

export function lerCookie(req: VercelRequest, nome: string): string | undefined {
  const cru = req.headers.cookie;
  if (!cru) return undefined;
  for (const parte of cru.split(';')) {
    const [k, ...v] = parte.trim().split('=');
    if (k === nome) return decodeURIComponent(v.join('='));
  }
  return undefined;
}

/**
 * Envolve o handler: converte erro conhecido em status adequado e engole o
 * resto como 500 genérico — mensagem de exceção nunca vai para o cliente,
 * porque costuma carregar caminho de arquivo, SQL e nome de coluna.
 */
export function rota(
  fn: (req: VercelRequest, res: VercelResponse) => Promise<void>
) {
  return async (req: VercelRequest, res: VercelResponse) => {
    try {
      await fn(req, res);
    } catch (erro) {
      if (erro instanceof ErroHttp) return json(res, erro.status, { erro: erro.message });
      if (erro instanceof ErroEntrada) return json(res, 400, { erro: erro.message });
      console.error('[api] erro não tratado:', erro);
      return json(res, 500, { erro: 'erro interno' });
    }
  };
}
