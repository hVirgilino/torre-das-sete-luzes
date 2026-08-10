// Leitor mínimo de .env.local para os scripts de linha de comando.
// Em produção quem injeta as variáveis é a Vercel; isto é só para o dev local.
import { existsSync, readFileSync } from 'node:fs';

export function carregarEnv(arquivo = '.env.local') {
  const caminho = new URL(`../${arquivo}`, import.meta.url);
  if (!existsSync(caminho)) return;
  for (const linha of readFileSync(caminho, 'utf8').split('\n')) {
    const texto = linha.trim();
    if (!texto || texto.startsWith('#')) continue;
    const corte = texto.indexOf('=');
    if (corte < 1) continue;
    const chave = texto.slice(0, corte).trim();
    const valor = texto.slice(corte + 1).trim().replace(/^["']|["']$/g, '');
    if (!(chave in process.env)) process.env[chave] = valor;
  }
}
