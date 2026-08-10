import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../_lib/db.js';
import { corpoJson, ErroHttp, exigirMetodo, ipDoPedido, json, rota } from '../_lib/http.js';
import { assinarToken, hashIp, tokenValido } from '../_lib/cripto.js';
import { limitar } from '../_lib/limite.js';
import { dificuldadeRanqueavel, textoOpcional, uuid, LIMITE_CAPITULO } from '../_lib/validar.js';
import { carregarCorrida, type Corrida } from '../_lib/corrida.js';

/**
 * Posição de uma entrada, pela mesma janela da listagem pública e de
 * /ranking/me — as três telas precisam ordenar igual, senão o número
 * anunciado aqui não bate com o que o jogador vê.
 */
async function posicaoDe(id: string): Promise<number> {
  const linhas = (await sql`
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
  return Number(linhas[0]?.posicao ?? 1);
}

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

  /**
   * Uma entrada por jogador em cada dificuldade — a melhor.
   *
   * O UNIQUE em run_id já impedia publicar a MESMA corrida duas vezes, mas
   * nada impedia duas corridas diferentes da mesma pessoa ocuparem 1º e 2º.
   *
   * A identidade aqui é posse, não nome: o cliente devolve os comprovantes
   * (id + HMAC) que guardou ao publicar, e só os que conferem contam. Usar o
   * nome como chave puniria dois irmãos homônimos de capítulos diferentes.
   */
  const bruto = Array.isArray(corpo.anteriores) ? corpo.anteriores.slice(0, 12) : [];
  const idsProprios: string[] = [];
  for (const item of bruto) {
    if (!item || typeof item !== 'object') continue;
    const { id: idAnterior, token } = item as { id?: unknown; token?: unknown };
    try {
      const limpo = uuid(idAnterior, 'id');
      if (tokenValido(limpo, token)) idsProprios.push(limpo);
    } catch {
      // comprovante estragado no navegador do jogador: ignora
    }
  }

  if (idsProprios.length) {
    const melhores = (await sql`
      select id, duracao_ms from ranking
       where id = any(${idsProprios}) and dificuldade = ${corrida.dificuldade}
       order by duracao_ms asc limit 1
    `) as unknown as { id: string; duracao_ms: number }[];
    const anterior = melhores[0];
    if (anterior && anterior.duracao_ms <= corrida.duracao_ms) {
      // a corrida antiga foi melhor: mantém a dela e não publica esta
      const pos = await posicaoDe(anterior.id);
      return json(res, 200, {
        entradaId: anterior.id,
        entradaToken: assinarToken(anterior.id),
        posicao: pos,
        dificuldade: corrida.dificuldade,
        duracaoMs: anterior.duracao_ms,
        superou: false
      });
    }
  }

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

  // esta corrida foi melhor: as anteriores do mesmo jogador saem de cena
  if (idsProprios.length) {
    await sql`
      delete from ranking
       where id = any(${idsProprios}) and dificuldade = ${corrida.dificuldade} and id <> ${id}
    `;
  }

  const posicao = await posicaoDe(id);

  json(res, 201, {
    entradaId: id,
    // prova de posse da linha: é o que deixa o menu perguntar "sou top 3?"
    entradaToken: assinarToken(id),
    posicao,
    dificuldade: corrida.dificuldade,
    duracaoMs: corrida.duracao_ms,
    superou: true
  });
});
