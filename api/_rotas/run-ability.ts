import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../_lib/db.js';
import { corpoJson, ErroHttp, exigirMetodo, json, rota } from '../_lib/http.js';
import {
  apagarPorHabilidade,
  carregarCorrida,
  estadoPublico,
  removerTranca,
  velaValida,
  type Vela
} from '../_lib/corrida.js';

interface LinhaPergunta {
  id: string;
  vela: number;
  indice_correta: number;
  opcoes: string[];
  correta: string;
  eliminadas: number[];
  respondida_em: string | null;
}

/**
 * Usa a habilidade de uma vela acesa.
 *
 * Precisa existir no servidor porque toda habilidade mexe no placar: apaga a
 * vela, devolve tranca, ou resolve a questão. Se ficasse só no cliente, bastaria
 * declarar "usei Luz Plena" para ganhar a questão sem gastar vela nenhuma.
 */
export default rota(async (req: VercelRequest, res: VercelResponse) => {
  exigirMetodo(req, res, 'POST');
  const corpo = corpoJson(req);
  const corrida = await carregarCorrida(corpo);
  const vela = velaValida(corpo.vela);

  const velas: Vela[] = corrida.velas;
  if (!velas[vela - 1].lit) throw new ErroHttp(409, 'esta vela não está acesa');

  const abertas = (await sql`
    select id, vela, indice_correta, opcoes, correta, eliminadas, respondida_em
      from run_question
     where run_id = ${corrida.id} and respondida_em is null
     order by criada_em desc limit 1
  `) as unknown as LinhaPergunta[];
  const pergunta = abertas[0];
  if (!pergunta) throw new ErroHttp(409, 'nenhuma pergunta em aberto');

  // custo, idêntico ao modo casual: a vela apaga e uma tranca volta,
  // a menos que o Voto de Fidelidade esteja pendente
  const custo = apagarPorHabilidade(velas, vela, corrida.protecao_ativa);
  let protecaoAtiva = custo.protecaoAtiva;

  const erradas = pergunta.opcoes
    .map((_, i) => i)
    .filter((i) => i !== pergunta.indice_correta && !pergunta.eliminadas.includes(i));
  const sorteia = <T,>(a: T[]): T | undefined => a[Math.floor(Math.random() * a.length)];

  let efeito: Record<string, unknown> = {};
  let resolveuCerto = false;

  switch (vela) {
    case 1: {
      const alvo = sorteia(erradas);
      if (alvo !== undefined) {
        pergunta.eliminadas.push(alvo);
        await sql`update run_question set eliminadas = ${JSON.stringify(pergunta.eliminadas)}::jsonb where id = ${pergunta.id}`;
      }
      efeito = { eliminar: alvo ?? null };
      break;
    }
    case 2: {
      // revela só o começo — a dica não pode entregar a resposta inteira
      const ws = pergunta.correta.split(' ');
      const trecho =
        ws.length > 1
          ? `${ws[0]} …`
          : `${pergunta.correta.slice(0, Math.ceil(pergunta.correta.length / 2))}…`;
      efeito = { dica: `A lacuna começa com: «${trecho}»`, encurtar: sorteia(erradas) ?? null };
      break;
    }
    case 3: {
      await sql`update run_question set congelada = true where id = ${pergunta.id}`;
      efeito = { congelada: true };
      break;
    }
    case 4: {
      await sql`update run_question set sem_reset = true where id = ${pergunta.id}`;
      efeito = { semReset: true };
      break;
    }
    case 5: {
      protecaoAtiva = true;
      efeito = { protecaoAtiva: true };
      break;
    }
    case 6:
    case 7: {
      resolveuCerto = true;
      efeito = vela === 7 ? { indiceCorreta: pergunta.indice_correta } : {};
      break;
    }
  }

  if (resolveuCerto) {
    const fechadas = (await sql`
      update run_question set respondida_em = now(), acertou = true
       where id = ${pergunta.id} and respondida_em is null returning id
    `) as unknown as { id: string }[];
    if (!fechadas.length) throw new ErroHttp(409, 'esta pergunta já foi respondida');
    removerTranca(velas, pergunta.vela);
  }

  await sql`
    update run
       set velas = ${JSON.stringify(velas)}::jsonb,
           protecao_ativa = ${protecaoAtiva},
           acertos = acertos + ${resolveuCerto ? 1 : 0},
           vista_em = now()
     where id = ${corrida.id}
  `;

  json(res, 200, {
    vela,
    apagou: custo.apagou,
    resolveuCerto,
    velaLiberada: velas[pergunta.vela - 1].locks === 0,
    ...efeito,
    ...estadoPublico({ ...corrida, protecao_ativa: protecaoAtiva }, velas)
  });
});
