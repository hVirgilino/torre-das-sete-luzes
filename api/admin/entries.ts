import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../_lib/db';
import { exigirMetodo, json, rota } from '../_lib/http';
import { exigirAdmin } from '../_lib/sessao';

interface Linha {
  id: string;
  nome: string;
  nome_exibicao: string | null;
  capitulo: string | null;
  dificuldade: string;
  duracao_ms: number;
  criado_em: string;
  oculto: boolean;
  motivo: string | null;
  acertos: number;
  erros: number;
}

/** Lista completa para o painel — inclui as linhas ocultas, ao contrário da pública. */
export default rota(async (req: VercelRequest, res: VercelResponse) => {
  exigirMetodo(req, res, 'GET');
  exigirAdmin(req);

  const linhas = (await sql`
    select r.id, r.nome, r.nome_exibicao, r.capitulo, r.dificuldade, r.duracao_ms,
           r.criado_em, r.oculto, r.motivo, c.acertos, c.erros
      from ranking r
      join run c on c.id = r.run_id
     order by r.criado_em desc
     limit 500
  `) as unknown as Linha[];

  json(res, 200, {
    entradas: linhas.map((l) => ({
      id: l.id,
      nome: l.nome,
      nomeExibicao: l.nome_exibicao,
      capitulo: l.capitulo,
      dificuldade: l.dificuldade,
      duracaoMs: l.duracao_ms,
      criadoEm: l.criado_em,
      oculto: l.oculto,
      motivo: l.motivo,
      // ajudam a farejar linha suspeita: tempo baixo com poucos acertos
      acertos: l.acertos,
      erros: l.erros
    }))
  });
});
