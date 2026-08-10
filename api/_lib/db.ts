import { neon } from '@neondatabase/serverless';

/**
 * Cliente Neon sobre HTTP. Cada consulta é um fetch, então não existe pool de
 * conexão para vazar entre invocações da função — que é a armadilha clássica
 * de Postgres em serverless.
 *
 * Use SEMPRE como template tag: sql`select ... where id = ${id}`. O driver
 * transforma cada `${}` em parâmetro do protocolo, nunca em concatenação de
 * texto. Montar SQL com `+` ou template literal comum reabre injection.
 */
const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL ausente no ambiente');

export const sql = neon(url);
