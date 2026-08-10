import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../_lib/db.js';
import { corpoJson, exigirMetodo, ipDoPedido, json, rota } from '../_lib/http.js';
import { assinarToken, hashIp } from '../_lib/cripto.js';
import { limitar } from '../_lib/limite.js';
import { dificuldadeRanqueavel, textoObrigatorio, LIMITE_NOME } from '../_lib/validar.js';
import { estadoPublico, velasIniciais, type Corrida } from '../_lib/corrida.js';
import { dificuldadePorId } from '../../src/data/difficulty.js';

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
  // Escudeiro não abre corrida: não haveria onde publicar o resultado
  const dif = dificuldadeRanqueavel(corpo.dificuldade);

  const linhas = (await sql`
    insert into run (nome, dificuldade, velas, ip_hash)
    values (${nome}, ${dif}, ${JSON.stringify(velasIniciais(dificuldadePorId(dif)!))}::jsonb, ${ip})
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
