/**
 * Alternativas falsas *quase* iguais à certa — o que dá dentes ao Cavaleiro.
 *
 * O gerador antigo tirava distratores de outros trechos da Cerimônia. Funciona
 * para quem está aprendendo (o assunto errado salta aos olhos), mas quem já
 * decorou o texto elimina três opções sem ler: bastava reconhecer de que vela
 * cada pedaço veio. Aqui as alternativas nascem da própria resposta, com **uma**
 * palavra trocada, invertida ou flexionada — não há atalho: ou se lembra da
 * palavra exata, ou se chuta.
 *
 * Módulo puro (roda também nas functions da API).
 */

import { CEREMONY } from '../data/ceremony.js';
import { NUMERO_DETERMINANTES, TROCAS_PROXIMAS } from '../data/lexicon.js';
import { comCaixa, fatiar, juntar, normalizar, pick, rand, shuffle, significativa } from './texto.js';

/** Vocabulário significativo da Cerimônia, para trocas por palavra de forma parecida. */
const VOCABULARIO: string[] = (() => {
  const vistas = new Set<string>();
  for (const secao of CEREMONY) {
    for (const palavra of secao.texto.split(/\s+/)) {
      const nucleo = fatiar(palavra).nucleo.toLowerCase();
      if (nucleo.length >= 4 && significativa(nucleo)) vistas.add(nucleo);
    }
  }
  return [...vistas];
})();

/** Verbos de ligação: quem tem um destes antes concorda com ele em número. */
const COPULAS = new Set([
  'é', 'são', 'era', 'eram', 'foi', 'foram', 'seja', 'sejam', 'será', 'serão',
  'seria', 'seriam', 'está', 'estão', 'parece', 'parecem', 'permanece', 'permanecem'
]);

type Mutador = (ws: string[]) => string[] | null;

/** Índices das palavras que podem ser mexidas sem virar erro de português. */
const alvos = (ws: string[]): number[] =>
  ws.map((_, i) => i).filter((i) => significativa(ws[i]));

/** Troca uma palavra por uma vizinha semântica do léxico curado. */
const trocaLexical: Mutador = (ws) => {
  const candidatos = shuffle(
    ws.map((_, i) => i).filter((i) => TROCAS_PROXIMAS[fatiar(ws[i]).nucleo.toLowerCase()])
  );
  // palavra que já está no recorte não serve: "justo, pode um DeMolay ser
  // justo" chama atenção pela repetição e a alternativa se elimina sozinha
  const presentes = new Set(ws.map((w) => fatiar(w).nucleo.toLowerCase()));
  for (const i of candidatos) {
    const p = fatiar(ws[i]);
    const opcoes = TROCAS_PROXIMAS[p.nucleo.toLowerCase()].filter(
      (o) => o.toLowerCase() !== p.nucleo.toLowerCase() && !presentes.has(o.toLowerCase())
    );
    if (!opcoes.length) continue;
    const saida = [...ws];
    saida[i] = juntar({ ...p, nucleo: comCaixa(p.nucleo, pick(opcoes)) });
    return saida;
  }
  return null;
};

/**
 * Inverte dois termos de uma enumeração. Cruel de propósito: "pensamento,
 * palavra e ação" continua fazendo sentido em qualquer ordem, mas só uma delas
 * é a da Cerimônia.
 *
 * Só age em enumeração de verdade — separados por vírgula ou por "e"/"ou". A
 * primeira versão invertia quaisquer duas palavras vizinhas e produzia coisas
 * como "sagrado neste Altar": alternativa que ninguém marca, porque não é
 * português, e que por isso não disputava nada com a resposta certa.
 */
const trocaVizinhas: Mutador = (ws) => {
  interface Par { a: number; b: number }
  const noLexico = (p: string) => !!TROCAS_PROXIMAS[fatiar(p).nucleo.toLowerCase()];
  const nucleoDe = (i: number) => (i < ws.length ? fatiar(ws[i]).nucleo.toLowerCase() : '');
  const pares: Par[] = [];
  for (let i = 0; i < ws.length; i++) {
    if (!significativa(ws[i])) continue;
    // "pensamento, palavra e ação" — vírgula sozinha não basta: em "de nossas
    // sete, representa simbolicamente" ela separa oração, e a inversão sairia
    // sem pé nem cabeça. Exijo o terceiro item da enumeração (outra vírgula ou
    // um "e") e que as duas palavras sejam do léxico curado, que só tem termo
    // de conteúdo — advérbio e conectivo ficam de fora por construção.
    const enumeracao =
      /[,;]$/.test(ws[i]) &&
      i + 1 < ws.length &&
      significativa(ws[i + 1]) &&
      noLexico(ws[i]) &&
      noLexico(ws[i + 1]) &&
      (/[,;]$/.test(ws[i + 1]) || nucleoDe(i + 2) === 'e' || nucleoDe(i + 2) === 'ou');
    if (enumeracao) pares.push({ a: i, b: i + 1 });
    // "pais e filhos", "profunda e permanente" — coordenação é simétrica, então
    // inverter os dois lados sempre devolve português
    const elo = nucleoDe(i + 1);
    if ((elo === 'e' || elo === 'ou') && i + 2 < ws.length && significativa(ws[i + 2])) {
      pares.push({ a: i, b: i + 2 });
    }
  }
  for (const { a: ia, b: ib } of shuffle(pares)) {
    const a = fatiar(ws[ia]);
    const b = fatiar(ws[ib]);
    if (a.nucleo.toLowerCase() === b.nucleo.toLowerCase()) continue;
    const saida = [...ws];
    // os núcleos trocam de lugar, a pontuação fica: a vírgula pertence à
    // posição na frase, não à palavra que estava ali
    saida[ia] = juntar({ ...a, nucleo: comCaixa(a.nucleo, b.nucleo) });
    saida[ib] = juntar({ ...b, nucleo: comCaixa(b.nucleo, a.nucleo) });
    return saida;
  }
  return null;
};

/**
 * Passa um substantivo do plural ao singular (ou o contrário), levando junto
 * toda a cadeia de determinantes — "toda a nossa vida" vira "todas as nossas
 * vidas", nunca "toda as nossas vida".
 *
 * Só age quando dá para garantir a concordância inteira **dentro do recorte**,
 * e por isso recusa muita coisa:
 *
 * - a cadeia de determinantes tem de terminar em palavra não-determinante que
 *   ainda esteja no recorte, senão pode haver um "toda" escondido no texto que
 *   ficou de fora da lacuna e que continuaria no singular;
 * - o substantivo precisa fechar sintagma (pontuação depois) ou ser seguido de
 *   palavra que não concorda com ele — "os livros escolares" viraria "o livro
 *   escolares".
 */
const trocaNumero: Mutador = (ws) => {
  for (const i of shuffle(alvos(ws))) {
    const p = fatiar(ws[i]);
    const nucleo = p.nucleo;
    // determinante não é substantivo: flexionar "nossa" e deixar o núcleo do
    // sintagma fora da lacuna é como saía "durante toda as nossas vida"
    if (NUMERO_DETERMINANTES[nucleo.toLowerCase()]) continue;

    const cadeia: number[] = [];
    let j = i - 1;
    while (j >= 0 && NUMERO_DETERMINANTES[fatiar(ws[j]).nucleo.toLowerCase()]) {
      cadeia.push(j);
      j--;
    }
    if (!cadeia.length || j < 0) continue;

    // o sintagma tem de fechar ali: qualquer palavra logo depois do substantivo
    // concorda com ele — "os livros escolares" viraria "o livro escolares", e
    // "a escuridão tomará conta" viraria "as escuridões tomará conta"
    if (!/[,;.:]$/.test(ws[i])) continue;
    // e nada de cópula antes: "a vela é o símbolo," daria "é os símbolos,"
    if (COPULAS.has(fatiar(ws[j]).nucleo.toLowerCase())) continue;

    const detPlural = fatiar(ws[i - 1]).nucleo.toLowerCase().endsWith('s');
    let novo: string | null = null;
    if (detPlural && nucleo.length >= 5 && /[aeiou]s$/i.test(nucleo)) {
      novo = nucleo.slice(0, -1);
    } else if (!detPlural && /[aeo]$/i.test(nucleo)) {
      novo = `${nucleo}s`;
    }
    if (!novo) continue;

    const saida = [...ws];
    for (const k of cadeia) {
      const det = fatiar(ws[k]);
      saida[k] = juntar({ ...det, nucleo: comCaixa(det.nucleo, NUMERO_DETERMINANTES[det.nucleo.toLowerCase()]) });
    }
    saida[i] = juntar({ ...p, nucleo: comCaixa(nucleo, novo) });
    return saida;
  }
  return null;
};

/**
 * Última rede: troca a palavra por outra da própria Cerimônia com a mesma
 * terminação e quase o mesmo tamanho. Não é sinônimo — é forma parecida, o
 * suficiente para a alternativa não ter cara de intrusa.
 *
 * A exigência de quatro letras iguais no fim e um caractere de diferença no
 * tamanho é o que segura o palpite: com três letras, "alcança" virava
 * "confiança" e o distrator saía sem verbo.
 */
const trocaSemelhante: Mutador = (ws) => {
  for (const i of shuffle(alvos(ws))) {
    const p = fatiar(ws[i]);
    const nucleo = p.nucleo.toLowerCase();
    if (nucleo.length < 5) continue;
    const sufixo = nucleo.slice(-4);
    const presentes = new Set(ws.map((w) => fatiar(w).nucleo.toLowerCase()));
    const candidatos = VOCABULARIO.filter(
      (v) =>
        v !== nucleo &&
        !presentes.has(v) &&
        v.endsWith(sufixo) &&
        Math.abs(v.length - nucleo.length) <= 1
    );
    if (!candidatos.length) continue;
    const saida = [...ws];
    saida[i] = juntar({ ...p, nucleo: comCaixa(p.nucleo, pick(candidatos)) });
    return saida;
  }
  return null;
};

// O léxico curado é o que dá alternativa convincente; a inversão e a flexão
// entram quando o recorte permite. Repetir a entrada é como o sorteio pesa isso
// sem precisar de tabela de probabilidade.
const MUTADORES: Mutador[] = [
  trocaLexical, trocaLexical, trocaLexical,
  trocaVizinhas, trocaVizinhas,
  trocaNumero
];

function mutar(ws: string[]): string[] | null {
  for (const m of shuffle(MUTADORES)) {
    const r = m(ws);
    if (r) return r;
  }
  // fora do léxico não há troca boa, só troca parecida — daí ser a última
  return trocaSemelhante(ws);
}

/**
 * Gera até `quantidade` alternativas próximas da resposta certa.
 *
 * Pode devolver menos do que o pedido — recorte curto e sem palavra no léxico
 * não rende quatro variações plausíveis. Quem chama completa com o que tiver.
 */
export function distratoresProximos(correta: string, quantidade: number): string[] {
  if (quantidade <= 0) return [];
  const base = correta.split(/\s+/);
  const saida: string[] = [];
  const vistos = new Set<string>([normalizar(correta)]);

  const limite = quantidade * 14;
  for (let tentativa = 0; tentativa < limite && saida.length < quantidade; tentativa++) {
    // Metade das variantes nasce de outra variante, não da resposta certa.
    //
    // Sem esse encadeamento a certa seria a única a uma palavra de distância de
    // todas as outras — e quem notasse acertaria pela "opção do meio", sem
    // saber o texto. Com ele, a distância entre as alternativas embaralha e o
    // truque morre.
    const semente = saida.length > 0 && rand(2) === 0 ? pick(saida).split(/\s+/) : base;
    const variante = mutar(semente);
    if (!variante) {
      if (semente === base) break; // a base não rende nada: insistir é laço vazio
      continue;
    }
    const texto = variante.join(' ');
    const chave = normalizar(texto);
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    saida.push(texto);
  }
  return saida;
}
