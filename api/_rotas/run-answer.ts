import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../_lib/db.js';
import { corpoJson, ErroHttp, exigirMetodo, json, rota } from '../_lib/http.js';
import { inteiro, uuid } from '../_lib/validar.js';
import {
  carregarCorrida,
  estadoPublico,
  removerTranca,
  reporTrancas,
  type Vela
} from '../_lib/corrida.js';

interface LinhaPergunta {
  id: string;
  vela: number;
  correta: string;
  indice_correta: number;
  opcoes: string[];
  sem_reset: boolean;
  congelada: boolean;
  prazo_em: string;
  respondida_em: string | null;
}

/**
 * Valida uma resposta. Só aqui se descobre qual era a certa — e só depois de a
 * resposta estar registrada, para a informação não servir mais de nada.
 */
export default rota(async (req: VercelRequest, res: VercelResponse) => {
  exigirMetodo(req, res, 'POST');
  const corpo = corpoJson(req);
  const corrida = await carregarCorrida(corpo);
  const questionId = uuid(corpo.questionId, 'questionId');

  const linhas = (await sql`
    select id, vela, correta, indice_correta, opcoes, sem_reset, congelada,
           prazo_em, respondida_em
      from run_question
     where id = ${questionId} and run_id = ${corrida.id}
  `) as unknown as LinhaPergunta[];

  const pergunta = linhas[0];
  // o vínculo com run_id acima é o que impede responder pergunta de outra corrida
  if (!pergunta) throw new ErroHttp(404, 'pergunta não encontrada');
  if (pergunta.respondida_em) throw new ErroHttp(409, 'esta pergunta já foi respondida');

  const escolha = inteiro(corpo.escolha, -1, pergunta.opcoes.length - 1, 'escolha');
  const expirou = !pergunta.congelada && new Date(pergunta.prazo_em).getTime() < Date.now();
  // escolha -1 é o cliente avisando que o tempo acabou na tela dele
  const acertou = !expirou && escolha >= 0 && escolha === pergunta.indice_correta;

  const velas: Vela[] = corrida.velas;
  if (acertou) {
    removerTranca(velas, pergunta.vela);
  } else if (!pergunta.sem_reset) {
    reporTrancas(velas, pergunta.vela);
  }

  // o UPDATE condicional em respondida_em fecha a corrida entre dois envios
  // simultâneos da mesma resposta: só o primeiro encontra a linha
  const fechadas = (await sql`
    update run_question set respondida_em = now(), acertou = ${acertou}
     where id = ${pergunta.id} and respondida_em is null
     returning id
  `) as unknown as { id: string }[];
  if (!fechadas.length) throw new ErroHttp(409, 'esta pergunta já foi respondida');

  await sql`
    update run
       set velas = ${JSON.stringify(velas)}::jsonb,
           acertos = acertos + ${acertou ? 1 : 0},
           erros = erros + ${acertou ? 0 : 1},
           vista_em = now()
     where id = ${corrida.id}
  `;

  json(res, 200, {
    acertou,
    expirou,
    indiceCorreta: pergunta.indice_correta,
    velaLiberada: velas[pergunta.vela - 1].locks === 0,
    ...estadoPublico(corrida, velas)
  });
});
