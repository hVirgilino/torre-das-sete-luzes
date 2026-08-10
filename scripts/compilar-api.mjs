// Compila api/ para JS executável em Node, para os scripts de teste
// conseguirem carregar os handlers sem depender do `vercel dev`.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const raiz = new URL('..', import.meta.url).pathname;

function listar(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? listar(p) : [p];
  });
}

export function compilarApi() {
  // dentro de node_modules porque o Node precisa achar @neondatabase/serverless
  // subindo a árvore a partir do arquivo compilado — em /tmp não acharia
  const saida = join(raiz, 'node_modules', '.torre-api-test');
  rmSync(saida, { recursive: true, force: true });
  mkdirSync(saida, { recursive: true });

  execFileSync(
    'npx',
    ['tsc', '-p', 'api/tsconfig.json', '--noEmit', 'false', '--outDir', saida, '--module', 'esnext'],
    { cwd: raiz, stdio: 'inherit' }
  );

  // tsc emite import sem extensão; Node exige extensão em ESM
  for (const arquivo of listar(saida)) {
    if (!arquivo.endsWith('.js')) continue;
    writeFileSync(
      arquivo,
      readFileSync(arquivo, 'utf8').replace(/from '(\.[^']*)'/g, (m, p) =>
        p.endsWith('.js') ? m : `from '${p}.js'`
      )
    );
  }
  writeFileSync(join(saida, 'package.json'), '{"type":"module"}');

  const base = join(saida, 'api');
  return {
    saida,
    carregar: async (rota) =>
      (await import(pathToFileURL(join(base, rota + '.js')).href)).default,
    limpar: () => rmSync(saida, { recursive: true, force: true })
  };
}
