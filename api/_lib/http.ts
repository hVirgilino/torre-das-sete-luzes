import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ErroEntrada } from './validar.js';

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

/**
 * Nenhuma rota daqui recebe corpo grande — o maior deles é uma lista de 12
 * comprovantes de ranking. O teto próprio evita depender do limite da
 * plataforma, que não existe no `vercel dev` e pode mudar sem aviso.
 */
const LIMITE_CORPO = 64 * 1024;

export function corpoJson(req: VercelRequest): Record<string, unknown> {
  // ler req.body é o que dispara o parser da Vercel; com JSON malformado ele
  // lança, e sem esta guarda o pedido virava 500 em vez do 400 que merece
  let b: unknown;
  try {
    b = req.body;
  } catch {
    throw new ErroHttp(400, 'corpo inválido');
  }
  if (b && typeof b === 'object' && !Array.isArray(b)) return b as Record<string, unknown>;
  if (typeof b === 'string') {
    if (!b) return {};
    try {
      const p = JSON.parse(b);
      if (p && typeof p === 'object' && !Array.isArray(p)) return p;
    } catch {
      throw new ErroHttp(400, 'corpo inválido');
    }
  }
  return {};
}

/** Recusa corpo absurdo antes de o handler tocar em qualquer coisa. */
function conferirTamanho(req: VercelRequest) {
  const bruto = req.headers['content-length'];
  const tamanho = Number(Array.isArray(bruto) ? bruto[0] : bruto);
  if (Number.isFinite(tamanho) && tamanho > LIMITE_CORPO) {
    throw new ErroHttp(413, 'corpo grande demais');
  }
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
      conferirTamanho(req);
      await fn(req, res);
    } catch (erro) {
      if (erro instanceof ErroHttp) return json(res, erro.status, { erro: erro.message });
      if (erro instanceof ErroEntrada) return json(res, 400, { erro: erro.message });
      console.error('[api] erro não tratado:', erro);
      return json(res, 500, { erro: 'erro interno' });
    }
  };
}
