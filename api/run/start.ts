import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../_lib/db';
import { corpoJson, exigirMetodo, ipDoPedido, json, rota } from '../_lib/http';
import { assinarToken, hashIp } from '../_lib/cripto';
import { limitar } from '../_lib/limite';
import { dificuldade, textoObrigatorio, LIMITE_NOME } from '../_lib/validar';
import { estadoPublico, velasIniciais, type Corrida } from '../_lib/corrida';

/**
 * Abre uma partida ranqueada.
 *
 * O relógio do ranking nasce aqui, em `iniciada_em`, e é do servidor. O cliente
 * nunca informa quanto tempo levou — ele só avisa que terminou, e a diferença
 * entre os dois carimbos é o tempo. É isso que torna o ranking difícil de forjar.
 */
export default rota(async (req: VercelRequest, res: VercelResponse) => {
  exigirMetodo(req, res, 'POST');
  const corpo = corpoJson(req);

  const ip = hashIp(ipDoPedido(req));
  // teto largo: serve para conter script, não para atrapalhar quem repete o desafio
  await limitar(`run:start:${ip ?? 'sem-ip'}`, 30, 3600);

  const nome = textoObrigatorio(corpo.nome, LIMITE_NOME, 'nome');
  const dif = dificuldade(corpo.dificuldade);

  const linhas = (await sql`
    insert into run (nome, dificuldade, velas, ip_hash)
    values (${nome}, ${dif}, ${JSON.stringify(velasIniciais())}::jsonb, ${ip})
    returning id, nome, dificuldade, status, velas, protecao_ativa, historico,
              acertos, erros, iniciada_em, concluida_em, duracao_ms
  `) as unknown as Corrida[];

  const corrida = linhas[0];
  json(res, 201, {
    runId: corrida.id,
    token: assinarToken(corrida.id),
    dificuldade: corrida.dificuldade,
    ...estadoPublico(corrida)
  });
});
