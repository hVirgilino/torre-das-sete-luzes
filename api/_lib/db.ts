import { neon, type NeonQueryFunction } from '@neondatabase/serverless';
import { ErroHttp } from './http.js';

/**
 * Cliente Neon sobre HTTP. Cada consulta é um fetch, então não existe pool de
 * conexão para vazar entre invocações da função — que é a armadilha clássica
 * de Postgres em serverless.
 *
 * Use SEMPRE como template tag: sql`select ... where id = ${id}`. O driver
 * transforma cada `${}` em parâmetro do protocolo, nunca em concatenação de
 * texto. Montar SQL com `+` ou template literal comum reabre injection.
 *
 * A criação é preguiçosa de propósito: lançar no topo do módulo faz a function
 * inteira morrer com FUNCTION_INVOCATION_FAILED e um 500 sem explicação —
 * quem estiver configurando o ambiente não descobre o que faltou.
 */
let cliente: NeonQueryFunction<false, false> | null = null;

function conectar(): NeonQueryFunction<false, false> {
  if (cliente) return cliente;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new ErroHttp(
      503,
      'banco não configurado: falta DATABASE_URL no ambiente desta implantação'
    );
  }
  cliente = neon(url);
  return cliente;
}

/** Proxy sobre a template tag, para o cliente só nascer na primeira consulta. */
export const sql = ((...args: unknown[]) =>
  (conectar() as unknown as (...a: unknown[]) => unknown)(...args)) as unknown as
  NeonQueryFunction<false, false>;

// `sql.query(...)` é usado pelos scripts de migração
(sql as unknown as Record<string, unknown>).query = (...args: unknown[]) =>
  (conectar() as unknown as { query: (...a: unknown[]) => unknown }).query(...args);
