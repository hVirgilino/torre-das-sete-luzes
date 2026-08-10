/**
 * Conversa com as functions da Vercel.
 *
 * Regra do módulo: o jogo casual nunca depende daqui. Se a API estiver fora do
 * ar, ou se o jogo estiver rodando de um `file://` ou do GitHub Pages, tudo
 * segue funcionando offline — só o ranqueado e o ranking ficam indisponíveis.
 */

const TEMPO_LIMITE_MS = 8000;

export class ErroApi extends Error {
  constructor(readonly status: number, mensagem: string) {
    super(mensagem);
    this.name = 'ErroApi';
  }
}

async function pedir<T>(caminho: string, opcoes: RequestInit = {}): Promise<T> {
  const aborto = new AbortController();
  const relogio = setTimeout(() => aborto.abort(), TEMPO_LIMITE_MS);
  try {
    const resp = await fetch(`/api${caminho}`, {
      ...opcoes,
      signal: aborto.signal,
      headers: { 'Content-Type': 'application/json', ...(opcoes.headers ?? {}) }
    });
    const texto = await resp.text();
    const corpo = texto ? JSON.parse(texto) : {};
    if (!resp.ok) throw new ErroApi(resp.status, corpo?.erro ?? 'falha na comunicação');
    return corpo as T;
  } catch (erro) {
    if (erro instanceof ErroApi) throw erro;
    if (erro instanceof DOMException && erro.name === 'AbortError') {
      throw new ErroApi(0, 'o servidor demorou a responder');
    }
    throw new ErroApi(0, 'sem conexão com o servidor');
  } finally {
    clearTimeout(relogio);
  }
}

const post = <T,>(caminho: string, corpo: unknown) =>
  pedir<T>(caminho, { method: 'POST', body: JSON.stringify(corpo) });

// ------------------------------------------------------------------- tipos
export interface Vela {
  locks: number;
  lit: boolean;
}

export interface EstadoCorrida {
  velas: Vela[];
  protecaoAtiva: boolean;
  acertos: number;
  erros: number;
  completa: boolean;
}

export interface CorridaAberta extends EstadoCorrida {
  runId: string;
  token: string;
  dificuldade: string;
}

export interface PerguntaServidor extends EstadoCorrida {
  questionId: string;
  origem: string;
  antes: string;
  depois: string;
  opcoes: string[];
  eliminadas: number[];
  congelada: boolean;
  semReset: boolean;
  restanteMs: number;
}

export interface RespostaServidor extends EstadoCorrida {
  acertou: boolean;
  expirou: boolean;
  indiceCorreta: number;
  velaLiberada: boolean;
}

export interface EfeitoHabilidade extends EstadoCorrida {
  vela: number;
  apagou: boolean;
  resolveuCerto: boolean;
  velaLiberada: boolean;
  /** vela 1: índice da alternativa falsa que o servidor eliminou */
  eliminar?: number | null;
  /** vela 2: início da resposta + alternativa falsa a encurtar */
  dica?: string;
  encurtar?: number | null;
  /** vela 7: o servidor entrega a certa porque já resolveu a questão */
  indiceCorreta?: number;
  congelada?: boolean;
  semReset?: boolean;
}

export interface FimDeCorrida {
  duracaoMs: number;
  acertos: number;
  erros: number;
  dificuldade: string;
  estrelas: number;
  podeSubmeter: boolean;
}

export interface EntradaRanking {
  posicao: number;
  id: string;
  nome: string;
  capitulo: string | null;
  duracaoMs: number;
  criadoEm: string;
}

export interface Colocacao {
  id: string;
  dificuldade: string;
  posicao: number;
  duracaoMs: number;
}

// ------------------------------------------------------------------ rotas
export const Api = {
  iniciarCorrida: (nome: string, dificuldade: string) =>
    post<CorridaAberta>('/run/start', { nome, dificuldade }),

  pergunta: (runId: string, token: string, vela: number) =>
    post<PerguntaServidor>('/run/question', { runId, token, vela }),

  responder: (runId: string, token: string, questionId: string, escolha: number) =>
    post<RespostaServidor>('/run/answer', { runId, token, questionId, escolha }),

  habilidade: (runId: string, token: string, vela: number) =>
    post<EfeitoHabilidade>('/run/ability', { runId, token, vela }),

  acender: (runId: string, token: string, vela: number) =>
    post<EstadoCorrida & { vela: number }>('/run/light', { runId, token, vela }),

  concluir: (runId: string, token: string) =>
    post<FimDeCorrida>('/run/finish', { runId, token }),

  submeter: (runId: string, token: string, capitulo: string | null) =>
    post<{ entradaId: string; entradaToken: string; posicao: number; dificuldade: string }>(
      '/ranking/submit',
      { runId, token, capitulo }
    ),

  ranking: (dificuldade?: string, limite = 20) =>
    pedir<{ ranking: Record<string, EntradaRanking[]> }>(
      `/ranking?limite=${limite}${dificuldade ? `&dificuldade=${encodeURIComponent(dificuldade)}` : ''}`
    ),

  minhasColocacoes: (entradas: { id: string; token: string }[]) =>
    post<{ melhor: Colocacao | null; posicoes: Colocacao[] }>('/ranking/me', { entradas })
};

// ------------------------------------------- entradas publicadas do jogador
const CHAVE_ENTRADAS = 'cerimonia-da-luz:ranking:v1';

export interface EntradaPublicada {
  id: string;
  token: string;
}

/**
 * Comprovantes das publicações deste navegador. O token é o HMAC da linha; sem
 * ele o servidor não reconhece a colocação, então copiar um id da tela pública
 * de ranking não dá a ninguém a estrela de campeão.
 */
export function entradasPublicadas(): EntradaPublicada[] {
  try {
    const cru = localStorage.getItem(CHAVE_ENTRADAS);
    const lista = cru ? JSON.parse(cru) : [];
    if (!Array.isArray(lista)) return [];
    return lista
      .filter((e) => e && typeof e.id === 'string' && typeof e.token === 'string')
      .slice(-12);
  } catch {
    return [];
  }
}

export function guardarEntrada(entrada: EntradaPublicada) {
  try {
    const lista = entradasPublicadas().filter((e) => e.id !== entrada.id);
    lista.push(entrada);
    localStorage.setItem(CHAVE_ENTRADAS, JSON.stringify(lista.slice(-12)));
  } catch {
    /* storage indisponível — perde só o brilho de pódio */
  }
}

/**
 * Dificuldades que entram no ranking. Escudeiro fica de fora: com 20s por
 * questão e duas alternativas, o tempo mede digitação, não domínio da
 * Cerimônia. Precisa espelhar DIFICULDADES_RANQUEAVEIS do servidor.
 */
export const DIFICULDADES_RANQUEAVEIS = ['iniciatico', 'demolay', 'cavaleiro'] as const;

export const ehRanqueavel = (id: string): boolean =>
  (DIFICULDADES_RANQUEAVEIS as readonly string[]).includes(id);
