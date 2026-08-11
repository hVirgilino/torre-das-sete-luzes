import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../_lib/db.js';
import { corpoJson, ErroHttp, exigirMetodo, json, rota } from '../_lib/http.js';
import {
  carregarCorrida,
  dificuldadeDa,
  estadoPublico,
  velaValida,
  FOLGA_REDE_MS
} from '../_lib/corrida.js';
import { generateQuestion } from '../../src/systems/questions.js';

interface LinhaPergunta {
  id: string;
  vela: number;
  origem: string;
  antes: string;
  depois: string;
  opcoes: string[];
  eliminadas: number[];
  congelada: boolean;
  sem_reset: boolean;
  prazo_em: string;
}

/**
 * Entrega a pergunta atual da vela. `correta` e `indice_correta` ficam no banco
 * e não aparecem em nenhuma resposta HTTP — é o que impede ler a resposta pelo
 * devtools, como acontece no modo casual.
 *
 * Idempotente de propósito: se já existe pergunta aberta, devolve a mesma. Sem
 * isso, recarregar a página sortearia outra pergunta e daria um jeito barato de
 * pular questão difícil.
 */
export default rota(async (req: VercelRequest, res: VercelResponse) => {
  exigirMetodo(req, res, 'POST');
  const corpo = corpoJson(req);
  const corrida = await carregarCorrida(corpo);
  const vela = velaValida(corpo.vela);
  const dif = dificuldadeDa(corrida);

  const estado = corrida.velas[vela - 1];
  if (estado.locks === 0) throw new ErroHttp(409, 'esta vela não tem trancas');

  const abertas = (await sql`
    select id, vela, origem, antes, depois, opcoes, eliminadas, congelada, sem_reset, prazo_em
      from run_question
     where run_id = ${corrida.id} and respondida_em is null
     order by criada_em desc
     limit 1
  `) as unknown as LinhaPergunta[];

  const aberta = abertas[0];
  if (aberta) {
    // pergunta congelada por habilidade não expira sozinha
    const vencida = !aberta.congelada && new Date(aberta.prazo_em).getTime() < Date.now();
    if (!vencida && aberta.vela === vela) {
      return json(res, 200, {
        questionId: aberta.id,
        origem: aberta.origem,
        antes: aberta.antes,
        depois: aberta.depois,
        opcoes: aberta.opcoes,
        eliminadas: aberta.eliminadas,
        congelada: aberta.congelada,
        semReset: aberta.sem_reset,
        // a folga é do servidor, não do jogador: sai da conta antes de virar barra
        restanteMs: Math.max(
          0,
          new Date(aberta.prazo_em).getTime() - FOLGA_REDE_MS - Date.now()
        ),
        ...estadoPublico(corrida)
      });
    }
    // fecha a pendente antes de sortear outra, para nunca haver duas em aberto
    await sql`
      update run_question set respondida_em = now(), acertou = false
       where id = ${aberta.id} and respondida_em is null
    `;
  }

  const historico = corrida.historico ?? { sentencas: [], spans: [] };
  const q = generateQuestion(vela, dif, historico);
  // Dois números diferentes de propósito: a barra do jogador conta o tempo da
  // dificuldade, o prazo gravado conta esse tempo mais a folga. Devolver o prazo
  // cheio em `restanteMs` anulava a folga — a barra passava a durar exatamente o
  // que o servidor esperava, e qualquer latência fazia o prazo vencer com a
  // barra ainda na tela.
  const tempoVisivelMs = dif.tempo * 1000;
  const prazoMs = tempoVisivelMs + FOLGA_REDE_MS;
  // Gravado pelo relógio desta função, não pelo `now()` do Postgres: quem compara
  // com `prazo_em` depois é sempre um `Date.now()` daqui, e misturar os dois
  // relógios põe a diferença entre eles dentro do prazo do jogador.
  const prazoEm = new Date(Date.now() + prazoMs);

  const criadas = (await sql`
    insert into run_question
      (run_id, vela, origem, antes, depois, correta, indice_correta, opcoes, prazo_em)
    values
      (${corrida.id}, ${vela}, ${q.origem}, ${q.antes}, ${q.depois}, ${q.correta},
       ${q.indiceCorreta}, ${JSON.stringify(q.opcoes)}::jsonb, ${prazoEm})
    returning id
  `) as unknown as { id: string }[];

  await sql`
    update run set historico = ${JSON.stringify(historico)}::jsonb, vista_em = now()
     where id = ${corrida.id}
  `;

  json(res, 201, {
    questionId: criadas[0].id,
    origem: q.origem,
    antes: q.antes,
    depois: q.depois,
    opcoes: q.opcoes,
    eliminadas: [],
    congelada: false,
    semReset: false,
    restanteMs: tempoVisivelMs,
    ...estadoPublico(corrida)
  });
});
