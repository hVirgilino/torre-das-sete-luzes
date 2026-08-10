import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../_lib/db.js';
import { exigirMetodo, json, rota } from '../_lib/http.js';
import {
  DIFICULDADES_RANQUEAVEIS, dificuldadeRanqueavel, type DificuldadeRanqueavel
} from '../_lib/validar.js';

interface Linha {
  id: string;
  nome: string;
  nome_exibicao: string | null;
  capitulo: string | null;
  duracao_ms: number;
  criado_em: string;
}

const LIMITE_PADRAO = 20;
const LIMITE_MAXIMO = 100;

/**
 * Classificação pública de uma dificuldade.
 *
 * Linhas ocultas pela moderação não saem daqui, e o `nome` cru é substituído
 * pelo `nome_exibicao` quando existe — quem foi censurado não tem o nome
 * original devolvido por nenhuma rota pública.
 */
export default rota(async (req: VercelRequest, res: VercelResponse) => {
  exigirMetodo(req, res, 'GET');

  const q = req.query.dificuldade;
  const alvo = Array.isArray(q) ? q[0] : q;
  const dificuldades: DificuldadeRanqueavel[] = alvo
    ? [dificuldadeRanqueavel(alvo)]
    : [...DIFICULDADES_RANQUEAVEIS];

  const bruto = Number(Array.isArray(req.query.limite) ? req.query.limite[0] : req.query.limite);
  const limite = Number.isInteger(bruto) && bruto > 0 ? Math.min(bruto, LIMITE_MAXIMO) : LIMITE_PADRAO;

  const resultado: Record<string, unknown[]> = {};
  for (const dif of dificuldades) {
    const linhas = (await sql`
      select id, nome, nome_exibicao, capitulo, duracao_ms, criado_em
        from ranking
       where dificuldade = ${dif} and oculto = false
       order by duracao_ms asc, criado_em asc
       limit ${limite}
    `) as unknown as Linha[];

    resultado[dif] = linhas.map((l, i) => ({
      posicao: i + 1,
      id: l.id,
      nome: l.nome_exibicao ?? l.nome,
      capitulo: l.capitulo,
      duracaoMs: l.duracao_ms,
      criadoEm: l.criado_em
    }));
  }

  json(res, 200, { ranking: resultado });
});
