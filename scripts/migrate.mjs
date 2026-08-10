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

/**
 * Separa por ";" ignorando os que estão dentro de bloco `$$ ... $$` — um
 * `do $$ ... $$;` tem ponto e vírgula interno e seria cortado no meio.
 */
function separarComandos(sql) {
  const comandos = [];
  let atual = '';
  let dentroDeBloco = false;
  for (const linha of sql.split('\n')) {
    // cada $$ alterna entrar/sair do bloco; par na mesma linha se anula
    const marcas = (linha.match(/\$\$/g) ?? []).length;
    atual += linha + '\n';
    if (marcas % 2 === 1) dentroDeBloco = !dentroDeBloco;
    if (!dentroDeBloco && /;\s*$/.test(linha)) {
      comandos.push(atual.replace(/;\s*$/, '').trim());
      atual = '';
    }
  }
  if (atual.trim()) comandos.push(atual.trim());
  return comandos.filter(
    (c) => c && !c.split('\n').every((l) => !l.trim() || l.trim().startsWith('--'))
  );
}

const comandos = separarComandos(texto);

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
