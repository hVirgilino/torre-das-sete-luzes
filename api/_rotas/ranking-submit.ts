import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../_lib/db.js';
import { corpoJson, ErroHttp, exigirMetodo, ipDoPedido, json, rota } from '../_lib/http.js';
import { assinarToken, hashIp } from '../_lib/cripto.js';
import { limitar } from '../_lib/limite.js';
import { dificuldadeRanqueavel, textoOpcional, LIMITE_CAPITULO } from '../_lib/validar.js';
import { carregarCorrida, type Corrida } from '../_lib/corrida.js';

/**
 * Publica uma corrida concluída no ranking.
 *
 * O nome vem da corrida, não do corpo do pedido: é o mesmo com que se jogou, e
 * não dá para trocar na hora de publicar. Só o capítulo é aceito aqui, porque
 * só ele é pedido depois do fim da partida.
 */
export default rota(async (req: VercelRequest, res: VercelResponse) => {
  exigirMetodo(req, res, 'POST');
  const corpo = corpoJson(req);

  const ip = hashIp(ipDoPedido(req));
  await limitar(`ranking:submit:${ip ?? 'sem-ip'}`, 20, 3600);

  const corrida = (await carregarCorrida(corpo, { exigirAtiva: false })) as Corrida;
  if (corrida.status !== 'concluida' || !corrida.duracao_ms) {
    throw new ErroHttp(409, 'esta corrida não foi concluída');
  }

  // guarda redundante: run/start já barra, mas uma corrida antiga no banco
  // não pode virar linha de ranking numa dificuldade que saiu da disputa
  dificuldadeRanqueavel(corrida.dificuldade);

  const capitulo = textoOpcional(corpo.capitulo, LIMITE_CAPITULO);

  // o UNIQUE em run_id é o que impede publicar a mesma corrida várias vezes
  const linhas = (await sql`
    insert into ranking (run_id, nome, capitulo, dificuldade, duracao_ms)
    values (${corrida.id}, ${corrida.nome}, ${capitulo}, ${corrida.dificuldade},
            ${corrida.duracao_ms})
    on conflict (run_id) do nothing
    returning id
  `) as unknown as { id: string }[];

  if (!linhas.length) throw new ErroHttp(409, 'esta corrida já está no ranking');
  const id = linhas[0].id;

  // A mesma janela usada pela listagem pública e por /ranking/me — as três
  // precisam ordenar igual, senão o número anunciado aqui não bate com a tela.
  //
  // A versão anterior contava "quantos vêm antes" logo após o INSERT, e a
  // própria linha recém-criada satisfazia a condição (mesmo tempo e criado_em
  // anterior ao now() da consulta seguinte): ela se contava, e todo primeiro
  // lugar era anunciado como segundo.
  const posicao = (await sql`
    with classificado as (
      select id,
             row_number() over (
               partition by dificuldade order by duracao_ms asc, criado_em asc
             ) as posicao
        from ranking
       where oculto = false
    )
    select posicao from classificado where id = ${id}
  `) as unknown as { posicao: number }[];

  json(res, 201, {
    entradaId: id,
    // prova de posse da linha: é o que deixa o menu perguntar "sou top 3?"
    entradaToken: assinarToken(id),
    posicao: Number(posicao[0]?.posicao ?? 1),
    dificuldade: corrida.dificuldade,
    duracaoMs: corrida.duracao_ms
  });
});
