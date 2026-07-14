import { CEREMONY, CeremonySection } from '../data/ceremony';
import { Difficulty } from '../data/config';

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

export function generateQuestion(vela: number, difficulty: Difficulty): Question {
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
  const sentence = pick(sents);
  const ws = words(sentence);

  const n = Math.min(spanLength(difficulty), Math.max(1, ws.length - 3));
  const extracted = extractSpan(ws, n) ?? { start: 0, span: ws.slice(0, n).join(' ') };
  const { start, span } = extracted;

  const antes = ws.slice(0, start).join(' ');
  const depois = ws.slice(start + n).join(' ');
  const correta = span;

  // distratores: trechos do mesmo tamanho vindos de outras sentenças/seções
  const distractorPool: string[] = [];
  const poolSections = [velaSection, ...extras, ...otherVelas];
  for (const sec of shuffle(poolSections)) {
    for (const s of shuffle(sentences(sec))) {
      const wds = words(s);
      const alt = extractSpan(wds, Math.min(n, Math.max(1, wds.length - 2)));
      if (!alt) continue;
      const candidate = alt.span;
      if (norm(candidate) === norm(correta)) continue;
      if (distractorPool.some((d) => norm(d) === norm(candidate))) continue;
      distractorPool.push(candidate);
      if (distractorPool.length >= 12) break;
    }
    if (distractorPool.length >= 12) break;
  }

  const needed = difficulty.opcoes - 1;
  const distractors = shuffle(distractorPool).slice(0, needed);
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
