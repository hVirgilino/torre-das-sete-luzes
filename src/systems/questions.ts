import { CEREMONY, CeremonySection } from '../data/ceremony.js';
// de ./difficulty, não de ./config: este módulo roda também nas functions,
// onde importar config (que lê `window`) seria pedir para quebrar
import { Difficulty } from '../data/difficulty.js';

export interface Question {
  /** título da seção de origem (ex.: "Fidelidade") */
  origem: string;
  /** texto antes da lacuna */
  antes: string;
  /** texto depois da lacuna */
  depois: string;
  /** resposta correta (conteúdo da lacuna) */
  correta: string;
  /** alternativas embaralhadas (inclui a correta) */
  opcoes: string[];
  indiceCorreta: number;
}

const STOPWORDS = new Set([
  'a', 'o', 'e', 'de', 'da', 'do', 'das', 'dos', 'em', 'um', 'uma', 'que', 'não',
  'nos', 'nas', 'no', 'na', 'os', 'as', 'se', 'por', 'para', 'com', 'como', 'mais',
  'mas', 'ao', 'aos', 'à', 'às', 'já', 'é', 'são', 'ser', 'seu', 'sua', 'seus',
  'suas', 'nós', 'ele', 'ela', 'este', 'esta', 'esse', 'essa', 'aquele', 'aquela',
  'qual', 'quando', 'onde', 'então', 'porém', 'pois', 'sobre', 'até', 'sem', 'nem'
]);

const rand = (n: number) => Math.floor(Math.random() * n);
const pick = <T,>(arr: T[]): T => arr[rand(arr.length)];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** quebra o texto de uma seção em sentenças utilizáveis */
function sentences(section: CeremonySection): string[] {
  return section.texto
    .split(/(?<=[.;])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.split(' ').length >= 6);
}

function words(sentence: string): string[] {
  return sentence.split(/\s+/);
}

const clean = (w: string) => w.replace(/[.,;:!?"“”()]/g, '').toLowerCase();

/** índices de palavras "significativas" (não stopword, tamanho ≥ 4) */
function significantIndices(ws: string[]): number[] {
  const idx: number[] = [];
  ws.forEach((w, i) => {
    const c = clean(w);
    if (c.length >= 4 && !STOPWORDS.has(c)) idx.push(i);
  });
  return idx;
}

/** tamanho da lacuna (nº de palavras) conforme dificuldade */
function spanLength(d: Difficulty): number {
  if (d.lacuna === 'palavra') return 1;
  if (d.lacuna === 'palavras') return 2 + rand(2); // 2–3
  return 4 + rand(4); // frase: 4–7
}

/** extrai um trecho de n palavras começando em posição significativa */
function extractSpan(ws: string[], n: number): { start: number; span: string } | null {
  const sig = significantIndices(ws);
  const candidates = sig.filter((i) => i + n <= ws.length);
  if (!candidates.length) return null;
  const start = pick(candidates);
  return { start, span: ws.slice(start, start + n).join(' ') };
}

/** normaliza para comparação de distratores */
const norm = (s: string) => clean(s).replace(/\s+/g, ' ');

// ------------------------------------------------- memória anti-repetição
// O banco de textos é curto (poucas sentenças por vela), então a memória é
// pequena e sempre libera as entradas mais antigas quando o pool se esgota —
// nunca bloqueia a geração de uma questão.
const RECENT_SENTENCES_CAP = 8;
const RECENT_SPANS_CAP = 12;

/**
 * Memória de repetição. Deixou de ser estado de módulo porque as functions da
 * API geram perguntas para várias corridas na mesma instância — com uma lista
 * global, o histórico de um jogador afetaria o sorteio do outro. No cliente
 * continua havendo uma instância única (`historicoLocal`), como antes.
 */
export interface QuestionHistory {
  sentencas: string[];
  spans: string[];
}

export const novoHistorico = (): QuestionHistory => ({ sentencas: [], spans: [] });

const historicoLocal = novoHistorico();

/** Reinicia a memória de repetição — chamar ao começar um novo jogo. */
export function resetQuestionHistory(): void {
  historicoLocal.sentencas = [];
  historicoLocal.spans = [];
}

function remember(list: string[], cap: number, entry: string) {
  list.push(entry);
  while (list.length > cap) list.shift();
}

/** escolhe uma sentença evitando as usadas recentemente; libera memória se preciso */
function pickSentence(sents: string[], sectionId: string, hist: QuestionHistory): string {
  const fresh = sents.filter((s) => !hist.sentencas.includes(`${sectionId}::${norm(s)}`));
  const pool = fresh.length ? fresh : sents;
  const chosen = pick(pool);
  remember(hist.sentencas, RECENT_SENTENCES_CAP, `${sectionId}::${norm(chosen)}`);
  return chosen;
}

/** amostra alguns recortes candidatos e prefere palavras significativas + spans não repetidos */
function pickSpan(ws: string[], n: number, hist: QuestionHistory): { start: number; span: string } {
  const sig = significantIndices(ws);
  const candidates = sig.filter((i) => i + n <= ws.length);
  const starts = candidates.length ? candidates : [0];

  let best: { start: number; span: string; score: number } | null = null;
  const tries = Math.min(4, starts.length);
  const tried = shuffle(starts).slice(0, tries);
  for (const start of tried) {
    const span = ws.slice(start, start + n).join(' ');
    const sigCount = ws.slice(start, start + n).filter((w) => significantIndices([w]).length > 0).length;
    const repeatPenalty = hist.spans.includes(norm(span)) ? -3 : 0;
    const score = sigCount + repeatPenalty + Math.random() * 0.5;
    if (!best || score > best.score) best = { start, span, score };
  }
  const chosen = best ?? { start: 0, span: ws.slice(0, n).join(' '), score: 0 };
  remember(hist.spans, RECENT_SPANS_CAP, norm(chosen.span));
  return chosen;
}

/**
 * @param hist memória anti-repetição. O cliente omite e usa a instância local;
 *             o servidor passa a da corrida, carregada do banco.
 */
export function generateQuestion(
  vela: number,
  difficulty: Difficulty,
  hist: QuestionHistory = historicoLocal
): Question {
  // banco de seções: vela do andar tem prioridade; extras conforme dificuldade
  const velaSection = CEREMONY.find((s) => s.vela === vela)!;
  const extras = CEREMONY.filter(
    (s) => s.tier !== 'vela' && difficulty.banco.includes(s.tier)
  );
  const otherVelas = CEREMONY.filter((s) => s.tier === 'vela' && s.vela !== vela);

  // 65% questão da própria vela; senão, sorteia dos extras liberados
  const useOwn = extras.length === 0 || Math.random() < 0.65;
  const source = useOwn ? velaSection : pick(extras);

  const sents = sentences(source);
  const sentence = pickSentence(sents, source.id, hist);
  const ws = words(sentence);

  const n = Math.min(spanLength(difficulty), Math.max(1, ws.length - 3));
  const { start, span } = pickSpan(ws, n, hist);

  const antes = ws.slice(0, start).join(' ');
  const depois = ws.slice(start + n).join(' ');
  const correta = span;
  // se a lacuna começa a sentença, o preenchimento correto normalmente é maiúsculo
  const expectsCapital = antes === '' && /^[A-ZÀ-Ý]/.test(correta);

  // distratores: trechos do mesmo tamanho, priorizando mesmo tier, tamanho
  // próximo e capitalização compatível (evita denunciar a resposta)
  interface Candidate { span: string; tier: string; len: number }
  const distractorPool: Candidate[] = [];
  const poolSections = [velaSection, ...extras, ...otherVelas];
  for (const sec of shuffle(poolSections)) {
    for (const s of shuffle(sentences(sec))) {
      const wds = words(s);
      const alt = extractSpan(wds, Math.min(n, Math.max(1, wds.length - 2)));
      if (!alt) continue;
      const candidate = alt.span;
      if (norm(candidate) === norm(correta)) continue;
      if (distractorPool.some((d) => norm(d.span) === norm(candidate))) continue;
      distractorPool.push({ span: candidate, tier: sec.tier, len: words(candidate).length });
      if (distractorPool.length >= 16) break;
    }
    if (distractorPool.length >= 16) break;
  }

  const scoreDistractor = (c: Candidate) => {
    let s = 0;
    if (c.tier === source.tier) s += 2;
    s -= Math.abs(c.len - n);
    const startsCapital = /^[A-ZÀ-Ý]/.test(c.span);
    if (startsCapital === expectsCapital) s += 3;
    return s + Math.random() * 0.75;
  };
  const ranked = shuffle(distractorPool).sort((a, b) => scoreDistractor(b) - scoreDistractor(a));

  const needed = difficulty.opcoes - 1;
  const distractors = ranked.slice(0, needed).map((c) => c.span);
  // fallback improvável: completa com variações
  while (distractors.length < needed) {
    distractors.push(shuffle(words(correta)).join(' ') + '…');
  }

  const opcoes = shuffle([correta, ...distractors]);
  return {
    origem: source.titulo,
    antes,
    depois,
    correta,
    opcoes,
    indiceCorreta: opcoes.indexOf(correta)
  };
}
