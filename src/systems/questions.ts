import { CEREMONY, CeremonySection } from '../data/ceremony.js';
// de ./difficulty, não de ./config: este módulo roda também nas functions,
// onde importar config (que lê `window`) seria pedir para quebrar
import { Difficulty } from '../data/difficulty.js';
import { distratoresProximos } from './distratores.js';
import { normalizar, pick, rand, shuffle, significativa } from './texto.js';

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

/** índices de palavras "significativas" (não stopword, tamanho ≥ 4) */
function significantIndices(ws: string[]): number[] {
  const idx: number[] = [];
  ws.forEach((w, i) => {
    if (significativa(w)) idx.push(i);
  });
  return idx;
}

/** tamanho da lacuna (nº de palavras) conforme dificuldade */
function spanLength(d: Difficulty): number {
  const [min, max] = d.palavras;
  return min + rand(Math.max(1, max - min + 1));
}

/** extrai um trecho de n palavras começando em posição significativa */
function extractSpan(ws: string[], n: number): { start: number; span: string } | null {
  const sig = significantIndices(ws);
  const candidates = sig.filter((i) => i + n <= ws.length);
  if (!candidates.length) return null;
  const start = pick(candidates);
  return { start, span: ws.slice(start, start + n).join(' ') };
}

// ------------------------------------------------- memória anti-repetição
// O banco de textos é curto (poucas sentenças por vela), então a memória é
// pequena e sempre libera as entradas mais antigas quando o pool se esgota —
// nunca bloqueia a geração de uma questão.
const RECENT_SENTENCES_CAP = 12;
const RECENT_SPANS_CAP = 24;
/** só as duas últimas: bloquear mais faria a mesma vela nunca se repetir */
const RECENT_SECTIONS_CAP = 2;

/**
 * Memória de repetição. Deixou de ser estado de módulo porque as functions da
 * API geram perguntas para várias corridas na mesma instância — com uma lista
 * global, o histórico de um jogador afetaria o sorteio do outro. No cliente
 * continua havendo uma instância única (`historicoLocal`), como antes.
 */
export interface QuestionHistory {
  sentencas: string[];
  spans: string[];
  /** seções sorteadas por último; opcional porque corridas antigas não a têm */
  secoes?: string[];
}

export const novoHistorico = (): QuestionHistory => ({ sentencas: [], spans: [], secoes: [] });

const historicoLocal = novoHistorico();

/** Reinicia a memória de repetição — chamar ao começar um novo jogo. */
export function resetQuestionHistory(): void {
  historicoLocal.sentencas = [];
  historicoLocal.spans = [];
  historicoLocal.secoes = [];
}

function remember(list: string[], cap: number, entry: string) {
  list.push(entry);
  while (list.length > cap) list.shift();
}

/** escolhe uma sentença evitando as usadas recentemente; libera memória se preciso */
function pickSentence(sents: string[], sectionId: string, hist: QuestionHistory): string {
  const fresh = sents.filter((s) => !hist.sentencas.includes(`${sectionId}::${normalizar(s)}`));
  const pool = fresh.length ? fresh : sents;
  const chosen = pick(pool);
  remember(hist.sentencas, RECENT_SENTENCES_CAP, `${sectionId}::${normalizar(chosen)}`);
  return chosen;
}

/**
 * Escolhe a seção de origem evitando as duas últimas.
 *
 * Sem isto o sorteio uniforme insistia na mesma seção três, quatro vezes
 * seguidas — e as sentenças novas acabavam, então a memória de sentenças era
 * liberada e a repetição voltava por outro caminho.
 */
function pickSection(pool: CeremonySection[], hist: QuestionHistory): CeremonySection {
  const recentes = (hist.secoes ??= []);
  const fresh = pool.filter((s) => !recentes.includes(s.id));
  const chosen = pick(fresh.length ? fresh : pool);
  remember(recentes, RECENT_SECTIONS_CAP, chosen.id);
  return chosen;
}

/** amostra alguns recortes candidatos e prefere palavras significativas + spans não repetidos */
function pickSpan(ws: string[], n: number, hist: QuestionHistory): { start: number; span: string } {
  const sig = significantIndices(ws);
  const candidates = sig.filter((i) => i + n <= ws.length);
  const starts = candidates.length ? candidates : [0];

  let best: { start: number; span: string; score: number } | null = null;
  const tries = Math.min(6, starts.length);
  const tried = shuffle(starts).slice(0, tries);
  for (const start of tried) {
    const span = ws.slice(start, start + n).join(' ');
    const sigCount = ws.slice(start, start + n).filter((w) => significativa(w)).length;
    const repeatPenalty = hist.spans.includes(normalizar(span)) ? -4 : 0;
    const score = sigCount + repeatPenalty + Math.random() * 0.5;
    if (!best || score > best.score) best = { start, span, score };
  }
  const chosen = best ?? { start: 0, span: ws.slice(0, n).join(' '), score: 0 };
  remember(hist.spans, RECENT_SPANS_CAP, normalizar(chosen.span));
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
  // banco de seções: vela do andar tem prioridade; o resto conforme dificuldade
  const velaSection = CEREMONY.find((s) => s.vela === vela)!;
  const extras = CEREMONY.filter(
    (s) => s.tier !== 'vela' && difficulty.banco.includes(s.tier)
  );
  const otherVelas = CEREMONY.filter((s) => s.tier === 'vela' && s.vela !== vela);
  // fora da própria vela, as outras velas só valem nos modos duros: quanto mais
  // alta a dificuldade, menos o andar em que se está adianta como pista
  const fora = [...extras, ...(difficulty.todasAsVelas ? otherVelas : [])];

  const useOwn = fora.length === 0 || Math.random() < difficulty.focoVela;
  const source = useOwn ? velaSection : pickSection(fora, hist);

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

  const needed = difficulty.opcoes - 1;
  const distractors: string[] = [];

  // Alternativas quase iguais: variações da própria resposta, a uma palavra de
  // distância. No Cavaleiro são todas; no DeMolay entra uma, o bastante para
  // não existir questão em que basta reconhecer o assunto.
  const quantosProximos =
    difficulty.distratores === 'proximo' ? needed : difficulty.distratores === 'misto' ? 1 : 0;
  if (quantosProximos > 0) distractors.push(...distratoresProximos(correta, quantosProximos));

  // distratores de texto: trechos do mesmo tamanho, priorizando mesmo tier,
  // tamanho próximo e capitalização compatível (evita denunciar a resposta).
  // Completam o que as variações não deram — recorte curto e sem palavra no
  // léxico não rende três versões plausíveis.
  if (distractors.length < needed) {
    const usados = new Set(distractors.map(normalizar));
    interface Candidate { span: string; tier: string; len: number }
    const distractorPool: Candidate[] = [];
    const poolSections = [velaSection, ...extras, ...otherVelas];
    for (const sec of shuffle(poolSections)) {
      for (const s of shuffle(sentences(sec))) {
        const wds = words(s);
        const alt = extractSpan(wds, Math.min(n, Math.max(1, wds.length - 2)));
        if (!alt) continue;
        const candidate = alt.span;
        if (normalizar(candidate) === normalizar(correta)) continue;
        if (usados.has(normalizar(candidate))) continue;
        if (distractorPool.some((d) => normalizar(d.span) === normalizar(candidate))) continue;
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
    distractors.push(...ranked.slice(0, needed - distractors.length).map((c) => c.span));
  }

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
