import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../_lib/db.js';
import { corpoJson, exigirMetodo, json, rota } from '../_lib/http.js';
import { tokenValido } from '../_lib/cripto.js';
import { uuid } from '../_lib/validar.js';

interface Linha {
  id: string;
  dificuldade: string;
  duracao_ms: number;
  criado_em: string;
  oculto: boolean;
  posicao: number;
}

const MAX_ENTRADAS = 12;

/**
 * Melhor colocação atual do jogador — é o que decide se as estrelas do menu
 * ganham o brilho de campeão.
 *
 * O cliente manda os pares (id, token) que guardou ao publicar. O token é o
 * HMAC do id: sem ele, qualquer um reivindicaria a posição alheia mandando um
 * id copiado da tela de ranking, que é público.
 */
export default rota(async (req: VercelRequest, res: VercelResponse) => {
  exigirMetodo(req, res, 'POST');
  const corpo = corpoJson(req);

  const bruto = Array.isArray(corpo.entradas) ? corpo.entradas.slice(0, MAX_ENTRADAS) : [];
  const ids: string[] = [];
  for (const item of bruto) {
    if (!item || typeof item !== 'object') continue;
    const { id, token } = item as { id?: unknown; token?: unknown };
    try {
      const limpo = uuid(id, 'id');
      if (tokenValido(limpo, token)) ids.push(limpo);
    } catch {
      // entrada malformada no localStorage do jogador: ignora em silêncio
    }
  }

  if (!ids.length) return json(res, 200, { melhor: null, posicoes: [] });

  // a posição sai de uma janela sobre as linhas visíveis daquela dificuldade,
  // então acompanha quem entrou na frente sem precisar recalcular nada
  const linhas = (await sql`
    with classificado as (
      select id, dificuldade, duracao_ms, criado_em, oculto,
             row_number() over (
               partition by dificuldade order by duracao_ms asc, criado_em asc
             ) as posicao
        from ranking
       where oculto = false
    )
    select id, dificuldade, duracao_ms, criado_em, oculto, posicao
      from classificado
     where id = any(${ids})
  `) as unknown as Linha[];

  const posicoes = linhas.map((l) => ({
    id: l.id,
    dificuldade: l.dificuldade,
    posicao: Number(l.posicao),
    duracaoMs: l.duracao_ms
  }));

  const melhor = posicoes.reduce<(typeof posicoes)[number] | null>(
    (m, p) => (!m || p.posicao < m.posicao ? p : m),
    null
  );

  json(res, 200, { melhor, posicoes });
});
