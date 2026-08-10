/**
 * Ataque à API pelo caminho de rede real.
 *
 *   npm run test:http
 *
 * O `testar-api.mjs` chama os handlers direto e cobre a lógica. Este aqui sobe
 * um servidor HTTP que imita o runtime da Vercel (roteamento por arquivo,
 * parsing de corpo por content-type) e ataca por fetch — que é onde aparecem os
 * problemas que só existem na borda: método trocado, corpo gigante, JSON
 * malformado, injeção de cabeçalho, travessia de caminho e vazamento de erro.
 */
import { createServer } from 'node:http';
import { neon } from '@neondatabase/serverless';
import { carregarEnv } from './env.mjs';
import { compilarApi } from './compilar-api.mjs';

carregarEnv();
const sql = neon(process.env.DATABASE_URL);
const { carregar, limpar } = compilarApi();
process.on('exit', limpar);

const ROTAS = {
  'run/start': await carregar('run/start'),
  'run/question': await carregar('run/question'),
  'run/answer': await carregar('run/answer'),
  'ranking': await carregar('ranking/index'),
  'ranking/submit': await carregar('ranking/submit'),
  'ranking/me': await carregar('ranking/me'),
  'admin/login': await carregar('admin/login'),
  'admin/entries': await carregar('admin/entries')
};

/** Limite de corpo da Vercel para função Node; aqui só para imitar a borda. */
const LIMITE_CORPO = 4 * 1024 * 1024;

const servidor = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://local');
  // normaliza como um roteador de verdade: "/api/../x" não pode virar rota
  const caminho = url.pathname.replace(/^\/api\/?/, '').replace(/\/+$/, '');
  const handler = ROTAS[caminho];
  if (!handler) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    return res.end('{"erro":"não encontrado"}');
  }

  const pedacos = [];
  let tamanho = 0;
  for await (const p of req) {
    tamanho += p.length;
    if (tamanho > LIMITE_CORPO) {
      // fechar a conexão é obrigatório: responder 413 e parar de ler deixa o
      // resto do corpo no socket, e o próximo pedido em keep-alive leva
      // ECONNRESET — foi assim que este teste derrubou o teste seguinte
      res.writeHead(413, { 'Content-Type': 'application/json', Connection: 'close' });
      res.end('{"erro":"corpo grande demais"}');
      req.destroy();
      return;
    }
    pedacos.push(p);
  }
  const cru = Buffer.concat(pedacos).toString('utf8');

  // a Vercel entrega objeto já parseado quando o content-type é JSON;
  // fora disso o handler recebe a string e decide o que fazer
  let corpo = cru;
  if ((req.headers['content-type'] ?? '').includes('application/json')) {
    try {
      corpo = cru ? JSON.parse(cru) : {};
    } catch {
      corpo = cru;
    }
  }

  const query = Object.fromEntries(url.searchParams);
  const falso = {
    method: req.method,
    body: corpo,
    query,
    headers: req.headers
  };
  let status = 200;
  const saida = { corpo: '', cabecalhos: {} };
  const resposta = {
    status(s) { status = s; return this; },
    json(c) { saida.corpo = JSON.stringify(c); return this; },
    setHeader(k, v) { saida.cabecalhos[k] = v; }
  };
  try {
    await handler(falso, resposta);
  } catch (e) {
    status = 500;
    saida.corpo = '{"erro":"erro interno"}';
  }
  res.writeHead(status, { 'Content-Type': 'application/json', ...saida.cabecalhos });
  res.end(saida.corpo);
});

await new Promise((r) => servidor.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${servidor.address().port}/api`;

// ------------------------------------------------------------------ placar
let passou = 0;
let falhou = 0;
const secao = (t) => console.log(`\n\x1b[1m${t}\x1b[0m`);
const checar = (ok, d, extra = '') => {
  if (ok) { passou++; console.log(`  \x1b[32mok\x1b[0m    ${d}`); }
  else { falhou++; console.log(`  \x1b[31mFALHOU\x1b[0m ${d} ${extra}`); }
};

const bater = async (caminho, opcoes = {}) => {
  const r = await fetch(BASE + caminho, {
    ...opcoes,
    headers: { 'Content-Type': 'application/json', ...(opcoes.headers ?? {}) }
  });
  const texto = await r.text();
  let json = null;
  try { json = JSON.parse(texto); } catch { /* resposta não-JSON */ }
  return { status: r.status, texto, json, headers: r.headers };
};

// ============================================================ método e rota
secao('Método, rota e forma do pedido');

const g = await bater('/run/start', { method: 'GET' });
checar(g.status === 405, 'GET numa rota POST devolve 405', `(${g.status})`);
checar(g.headers.get('allow') === 'POST', 'resposta 405 traz o cabeçalho Allow');

checar(
  (await bater('/run/start', {
    method: 'GET',
    headers: { 'X-HTTP-Method-Override': 'POST' }
  })).status === 405,
  'X-HTTP-Method-Override não contorna a checagem de método'
);

checar(
  (await bater('/../../etc/passwd', { method: 'GET' })).status === 404,
  'travessia de caminho não alcança rota nenhuma'
);
checar((await bater('/run/start/', { method: 'POST', body: '{}' })).status !== 404,
  'barra final continua resolvendo a mesma rota');

const malformado = await bater('/run/start', { method: 'POST', body: '{"nome": ' });
checar(malformado.status === 400, 'JSON malformado devolve 400', `(${malformado.status})`);
checar(
  !/at Object|SyntaxError|\/api\/|node:internal/.test(malformado.texto),
  'erro de parsing não vaza stack nem caminho de arquivo'
);

const semTipo = await bater('/run/start', {
  method: 'POST',
  headers: { 'Content-Type': 'text/plain' },
  body: JSON.stringify({ nome: 'PlainText', dificuldade: 'escudeiro' })
});
checar([201, 400].includes(semTipo.status), 'content-type trocado não gera 500', `(${semTipo.status})`);
if (semTipo.status === 201) await sql`delete from run where id = ${semTipo.json.runId}`;

// ------------------------------------------------------------ corpo hostil
secao('Corpo hostil');

const gigante = await bater('/run/start', {
  method: 'POST',
  body: JSON.stringify({ nome: 'x'.repeat(5 * 1024 * 1024), dificuldade: 'escudeiro' })
});
checar(gigante.status === 413, 'corpo acima do limite é cortado com 413', `(${gigante.status})`);

// nome enorme mas dentro do limite: precisa ser truncado, não recusado com 500
const longo = await bater('/run/start', {
  method: 'POST',
  body: JSON.stringify({ nome: 'A'.repeat(5000), dificuldade: 'escudeiro' })
});
checar(longo.status === 201, 'nome absurdamente longo é aceito e truncado', `(${longo.status})`);
if (longo.status === 201) {
  const [linha] = await sql`select nome from run where id = ${longo.json.runId}`;
  checar(linha.nome.length <= 16, `nome truncado no limite (${linha.nome.length} chars)`);
  await sql`delete from run where id = ${longo.json.runId}`;
}

// montado como texto: passar por JSON.stringify estouraria a pilha do próprio
// teste antes de o payload chegar ao servidor, que é quem está sendo atacado
const PROFUNDIDADE = 100000;
const fundo = await bater('/run/start', {
  method: 'POST',
  body: '{"a":'.repeat(PROFUNDIDADE) + '1' + '}'.repeat(PROFUNDIDADE)
});
checar([400, 413].includes(fundo.status), 'JSON profundo é recusado sem derrubar o processo', `(${fundo.status})`);
checar(
  (await bater('/ranking', { method: 'GET' })).status === 200,
  'servidor continua de pé depois do JSON profundo'
);

const arrayao = await bater('/ranking/me', {
  method: 'POST',
  body: JSON.stringify({ entradas: Array.from({ length: 5000 }, () => ({ id: 'x', token: 'y' })) })
});
checar(arrayao.status === 200 && arrayao.json.melhor === null, 'lista gigante em /ranking/me é limitada e ignorada');

checar(
  (await bater('/ranking/me', { method: 'POST', body: JSON.stringify({ entradas: 'nao-e-array' }) })).status === 200,
  'campo com tipo errado não quebra o handler'
);

// -------------------------------------------------------- cabeçalho e IP
secao('Cabeçalhos');

const comInjecao = await bater('/run/start', {
  method: 'POST',
  headers: { 'X-Forwarded-For': '1.2.3.4, 5.6.7.8' },
  body: JSON.stringify({ nome: 'IpTeste', dificuldade: 'escudeiro' })
});
checar(comInjecao.status === 201, 'x-forwarded-for com vários saltos é aceito');
if (comInjecao.status === 201) {
  const [linha] = await sql`select ip_hash from run where id = ${comInjecao.json.runId}`;
  checar(
    linha.ip_hash && !linha.ip_hash.includes('.') && linha.ip_hash.length === 32,
    'o IP é gravado como hash, nunca em claro'
  );
  await sql`delete from run where id = ${comInjecao.json.runId}`;
}

const cab = await bater('/ranking', { method: 'GET' });
checar(cab.headers.get('cache-control') === 'no-store', 'resposta do ranking é no-store');
checar(cab.headers.get('x-content-type-options') === 'nosniff', 'resposta traz nosniff');

// ------------------------------------------------------- texto adulterado
secao('Texto adulterado através da rede');

const rtl = await bater('/run/start', {
  method: 'POST',
  body: JSON.stringify({ nome: '‮oãtnaf​', dificuldade: 'escudeiro' })
});
checar(rtl.status === 201, 'nome com override RTL é aceito');
if (rtl.status === 201) {
  const [linha] = await sql`select nome from run where id = ${rtl.json.runId}`;
  checar(
    !/[‪-‮​-‏﻿]/.test(linha.nome),
    `invisíveis removidos antes de gravar (${JSON.stringify(linha.nome)})`
  );
  await sql`delete from run where id = ${rtl.json.runId}`;
}

const sqlNoQuery = await bater("/ranking?dificuldade=escudeiro'%20or%201=1--", { method: 'GET' });
checar(sqlNoQuery.status === 400, 'dificuldade inválida na query é recusada por allowlist');

const limiteMaluco = await bater('/ranking?limite=999999', { method: 'GET' });
checar(limiteMaluco.status === 200, 'limite absurdo é apenas teto, não erro');

// --------------------------------------------------------------- sessão
secao('Sessão e vazamento');

checar((await bater('/admin/entries', { method: 'GET' })).status === 401, 'admin sem cookie: 401');
checar(
  (await bater('/admin/entries', { method: 'GET', headers: { Cookie: 'torre_admin=abc.def' } })).status === 401,
  'cookie com assinatura inválida: 401'
);
const expirado = `${Date.now() - 1000}.qualquer`;
checar(
  (await bater('/admin/entries', { method: 'GET', headers: { Cookie: `torre_admin=${expirado}` } })).status === 401,
  'timestamp editado sem assinatura válida: 401'
);
checar(
  (await bater('/admin/entries', {
    method: 'GET',
    headers: { Cookie: 'outro=1; torre_admin=; mais=2' }
  })).status === 401,
  'cookie vazio entre outros cookies: 401'
);

const semSenha = await bater('/admin/login', { method: 'POST', body: '{}' });
checar(semSenha.status === 401, 'login sem campo senha: 401 (igual a senha errada)');
checar(
  !/scrypt|ADMIN_PASSWORD|process\.env/.test(semSenha.texto),
  'resposta de login não menciona o formato do segredo'
);

const erroDeCorrida = await bater('/run/question', {
  method: 'POST',
  body: JSON.stringify({ runId: '00000000-0000-4000-8000-000000000000', token: 'x', vela: 1 })
});
checar(
  !/select|relation|column|neon|postgres/i.test(erroDeCorrida.texto),
  'erro de corrida não vaza SQL nem nome de tabela'
);

// --------------------------------------------------------------- limpeza
secao('Limpeza');
await sql`delete from run where nome in ('PlainText','IpTeste')`;
await sql`delete from rate_limit where chave like '%run:start%' or chave like '%admin:login%'`;
console.log('  base limpa');

servidor.close();
console.log(`\n\x1b[1m${passou} passaram, ${falhou} falharam\x1b[0m\n`);
process.exit(falhou ? 1 : 0);
