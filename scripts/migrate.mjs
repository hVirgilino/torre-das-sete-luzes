// Aplica db/schema.sql no Neon. O schema é idempotente (tudo `if not exists`),
// então rodar de novo é seguro.
import { readFileSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';
import { carregarEnv } from './env.mjs';

carregarEnv();

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL ausente. Rode `vercel env pull .env.local` antes.');
  process.exit(1);
}

const sql = neon(url);
const texto = readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8');

// separa por ";" no fim de linha — o schema não usa funções com corpo composto,
// então não há ponto e vírgula interno para atrapalhar
const comandos = texto
  .split(/;\s*$/m)
  .map((c) => c.trim())
  .filter((c) => c && !c.split('\n').every((l) => l.trim().startsWith('--')));

for (const comando of comandos) {
  const rotulo = comando.split('\n').find((l) => !l.trim().startsWith('--'))?.slice(0, 68) ?? '';
  try {
    await sql.query(comando);
    console.log('  ok  ', rotulo);
  } catch (erro) {
    console.error('  FALHOU', rotulo, '\n       ', erro.message);
    process.exit(1);
  }
}

console.log(`\n${comandos.length} comandos aplicados.`);
