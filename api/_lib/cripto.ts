import {
  createHmac,
  randomBytes,
  scrypt as scryptCb,
  timingSafeEqual
} from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb) as (
  senha: string | Buffer,
  sal: string | Buffer,
  tamanho: number
) => Promise<Buffer>;

function segredo(nome: 'APP_SECRET' | 'SESSION_SECRET'): string {
  const v = process.env[nome];
  if (!v || v.length < 32) throw new Error(`${nome} ausente ou curto demais`);
  return v;
}

/** Comparação em tempo constante — evita descobrir o segredo byte a byte. */
export function iguais(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  // tamanhos diferentes já não batem; comparar mesmo assim mantém o tempo fixo
  if (ba.length !== bb.length) {
    timingSafeEqual(ba, ba);
    return false;
  }
  return timingSafeEqual(ba, bb);
}

// -------------------------------------------------------- token de corrida
/**
 * Prova de posse de uma corrida, sem guardar segredo no banco: o token é o
 * próprio id assinado. Quem não tem APP_SECRET não consegue forjar um id de
 * corrida alheia nem promover a própria.
 */
export function assinarToken(id: string): string {
  return createHmac('sha256', segredo('APP_SECRET')).update(id).digest('base64url');
}

export function tokenValido(id: string, token: unknown): boolean {
  if (typeof token !== 'string' || !token) return false;
  return iguais(assinarToken(id), token);
}

// ---------------------------------------------------------- senha do admin
/** Formato guardado em env: `scrypt$<sal base64url>$<hash base64url>`. */
export async function gerarHashSenha(senha: string): Promise<string> {
  const sal = randomBytes(16);
  const hash = await scrypt(senha.normalize('NFKC'), sal, 64);
  return `scrypt$${sal.toString('base64url')}$${hash.toString('base64url')}`;
}

export async function senhaConfere(senha: string, guardado: string): Promise<boolean> {
  const partes = guardado.split('$');
  if (partes.length !== 3 || partes[0] !== 'scrypt') return false;
  const sal = Buffer.from(partes[1], 'base64url');
  const esperado = Buffer.from(partes[2], 'base64url');
  const obtido = await scrypt(senha.normalize('NFKC'), sal, esperado.length);
  return timingSafeEqual(obtido, esperado);
}

// -------------------------------------------------------- sessão do admin
const DURACAO_SESSAO_MS = 2 * 60 * 60 * 1000; // 2h

/** Token de sessão assinado: `<expiraEm>.<hmac>`. Sem estado no banco. */
export function criarSessao(): string {
  const expira = Date.now() + DURACAO_SESSAO_MS;
  const assinatura = createHmac('sha256', segredo('SESSION_SECRET'))
    .update(String(expira))
    .digest('base64url');
  return `${expira}.${assinatura}`;
}

export function sessaoValida(token: unknown): boolean {
  if (typeof token !== 'string') return false;
  const [expiraTxt, assinatura] = token.split('.');
  const expira = Number(expiraTxt);
  if (!Number.isFinite(expira) || !assinatura) return false;
  // confere a assinatura ANTES de confiar no prazo, senão bastava editar o número
  const esperada = createHmac('sha256', segredo('SESSION_SECRET'))
    .update(expiraTxt)
    .digest('base64url');
  if (!iguais(esperada, assinatura)) return false;
  return Date.now() < expira;
}

/** Hash do IP — permite rate limit e auditoria sem guardar o IP em si. */
export function hashIp(ip: string | undefined): string | null {
  if (!ip) return null;
  return createHmac('sha256', segredo('APP_SECRET')).update(ip).digest('base64url').slice(0, 32);
}
