/**
 * Banco de provas da API. Compila `api/` e chama os handlers direto, com
 * req/res falsos, contra o Neon de verdade — sem depender do `vercel dev`.
 *
 *   npm run test:api
 *
 * Faz duas coisas: joga uma partida ranqueada inteira até publicar no ranking,
 * e depois tenta quebrar cada regra (injection, forja de token, adulteração de
 * tempo, resposta repetida, brute force do admin...).
 */
import { neon } from '@neondatabase/serverless';
import { carregarEnv } from './env.mjs';
import { compilarApi } from './compilar-api.mjs';

carregarEnv();
const sql = neon(process.env.DATABASE_URL);
const { carregar, limpar } = compilarApi();
process.on('exit', limpar);


const rotas = {
  start: await carregar('_rotas/run-start'),
  question: await carregar('_rotas/run-question'),
  answer: await carregar('_rotas/run-answer'),
  ability: await carregar('_rotas/run-ability'),
  light: await carregar('_rotas/run-light'),
  finish: await carregar('_rotas/run-finish'),
  ranking: await carregar('_rotas/ranking-lista'),
  submit: await carregar('_rotas/ranking-submit'),
  me: await carregar('_rotas/ranking-me'),
  login: await carregar('_rotas/admin-login'),
  entries: await carregar('_rotas/admin-entries'),
  moderate: await carregar('_rotas/admin-moderate')
};

// ------------------------------------------------------------ req/res falsos
async function chamar(handler, { metodo = 'POST', corpo, query = {}, cookie, ip } = {}) {
  const req = {
    method: metodo,
    body: corpo,
    query,
    headers: { 'x-forwarded-for': ip ?? '203.0.113.7', ...(cookie ? { cookie } : {}) }
  };
  let status = 200;
  const cabecalhos = {};
  let payload;
  const res = {
    status(s) { status = s; return this; },
    json(c) { payload = c; return this; },
    setHeader(k, v) { cabecalhos[k.toLowerCase()] = v; }
  };
  await handler(req, res);
  return { status, corpo: payload, cabecalhos };
}

// ---------------------------------------------------------------- placar
let passou = 0;
let falhou = 0;
const secao = (t) => console.log(`\n\x1b[1m${t}\x1b[0m`);
function checar(ok, descricao, extra = '') {
  if (ok) { passou++; console.log(`  \x1b[32mok\x1b[0m    ${descricao}`); }
  else { falhou++; console.log(`  \x1b[31mFALHOU\x1b[0m ${descricao} ${extra}`); }
}

// ============================================================ partida feliz
secao('Partida ranqueada completa (modo iniciatico)');

const r0 = await chamar(rotas.start, { corpo: { nome: 'TesteBot', dificuldade: 'iniciatico' } });
checar(r0.status === 201 && r0.corpo.runId && r0.corpo.token, 'start abre corrida e devolve token');
const runId = r0.corpo.runId;
const token = r0.corpo.token;

// joga as 7 velas: pergunta -> descobre a certa pelo banco -> responde
let perguntasFeitas = 0;
for (let vela = 1; vela <= 7; vela++) {
  let guarda = 0;
  for (;;) {
    const q = await chamar(rotas.question, { corpo: { runId, token, vela } });
    if (q.status >= 400) { checar(false, `question vela ${vela}`, JSON.stringify(q.corpo)); break; }
    checar(
      q.corpo.opcoes && q.corpo.correta === undefined && q.corpo.indiceCorreta === undefined,
      `vela ${vela}: pergunta ${++perguntasFeitas} nao vaza a resposta`,
      ''
    );
    // só o banco sabe a resposta — é exatamente o ponto
    const [{ indice_correta }] = await sql`
      select indice_correta from run_question where id = ${q.corpo.questionId}`;
    const a = await chamar(rotas.answer, {
      corpo: { runId, token, questionId: q.corpo.questionId, escolha: indice_correta }
    });
    if (!a.corpo.acertou) { checar(false, `resposta certa aceita (vela ${vela})`); break; }
    if (a.corpo.velaLiberada) break;
    if (++guarda > 40) { checar(false, `vela ${vela} nao liberou`); break; }
  }
  const l = await chamar(rotas.light, { corpo: { runId, token, vela } });
  if (l.status !== 200) checar(false, `acender vela ${vela}`, JSON.stringify(l.corpo));
}
checar(perguntasFeitas === 35, `exigiu as 35 respostas certas do desafio (foram ${perguntasFeitas})`);

const fim = await chamar(rotas.finish, { corpo: { runId, token } });
checar(fim.status === 200 && fim.corpo.duracaoMs > 0, 'finish fecha e cronometra no servidor');
const duracaoReal = fim.corpo.duracaoMs;

const sub = await chamar(rotas.submit, { corpo: { runId, token, capitulo: 'Capítulo Teste' } });
checar(sub.status === 201 && sub.corpo.entradaId, 'submit publica no ranking');
const entradaId = sub.corpo.entradaId;
const entradaToken = sub.corpo.entradaToken;

const lista = await chamar(rotas.ranking, { metodo: 'GET', query: { dificuldade: 'iniciatico' } });
checar(
  lista.corpo.ranking.iniciatico.some((e) => e.id === entradaId),
  'a entrada aparece no ranking publico'
);

const eu = await chamar(rotas.me, { corpo: { entradas: [{ id: entradaId, token: entradaToken }] } });
checar(eu.corpo.melhor?.id === entradaId, 'ranking/me devolve a colocacao com token valido');

// ========================================================== tentando quebrar
secao('Injection e entrada hostil');

const payloads = [
  "'; drop table ranking; --",
  "' or 1=1 --",
  "\\'; update ranking set oculto=true; --",
  '<script>alert(1)</script>',
  '${process.env.DATABASE_URL}'
];
for (const p of payloads) {
  const r = await chamar(rotas.start, { corpo: { nome: p, dificuldade: 'iniciatico' } });
  const criou = r.status === 201;
  checar(criou, `payload tratado como texto: ${JSON.stringify(p.slice(0, 28))}`);
  if (criou) await sql`delete from run where id = ${r.corpo.runId}`;
}
const tabelas = await sql`select count(*)::int n from information_schema.tables where table_schema='public'`;
checar(tabelas[0].n === 5, `as 5 tabelas continuam de pe apos os payloads (${tabelas[0].n})`);

const proto = await chamar(rotas.start, {
  corpo: { nome: 'Proto', dificuldade: 'iniciatico', __proto__: { admin: true }, constructor: 'x' }
});
checar(proto.status === 201 && {}.admin === undefined, 'prototype pollution no JSON nao contamina');
if (proto.status === 201) await sql`delete from run where id = ${proto.corpo.runId}`;

secao('Escudeiro fora do ranking');

checar(
  (await chamar(rotas.start, { corpo: { nome: 'Escu', dificuldade: 'escudeiro' } })).status === 400,
  'run/start recusa abrir corrida no Escudeiro'
);
checar(
  (await chamar(rotas.ranking, { metodo: 'GET', query: { dificuldade: 'escudeiro' } })).status === 400,
  'ranking publico recusa consultar Escudeiro'
);
const todas = await chamar(rotas.ranking, { metodo: 'GET' });
checar(
  Object.keys(todas.corpo.ranking).join(',') === 'iniciatico,demolay,cavaleiro',
  `ranking sem argumento traz só as tres dificuldades (${Object.keys(todas.corpo.ranking).join(',')})`
);

secao('Forja e adulteração');

checar(
  (await chamar(rotas.question, { corpo: { runId, token: 'token-falso', vela: 1 } })).status === 403,
  'token de corrida forjado e recusado'
);
checar(
  (await chamar(rotas.question, { corpo: { runId, vela: 1 } })).status === 403,
  'pedido sem token e recusado'
);
checar(
  (await chamar(rotas.question, { corpo: { runId: 'nao-e-uuid', token, vela: 1 } })).status === 400,
  'runId malformado e recusado antes de tocar o banco'
);

const outra = await chamar(rotas.start, { corpo: { nome: 'Intruso', dificuldade: 'iniciatico' } });
checar(
  (await chamar(rotas.question, {
    corpo: { runId: outra.corpo.runId, token, vela: 1 }
  })).status === 403,
  'token de uma corrida nao serve para outra'
);

// a corrida usada aqui precisa estar ATIVA, senão o teste pararia no guarda de
// status e nunca exercitaria o vínculo pergunta↔corrida, que é o que importa
const terceira = await chamar(rotas.start, { corpo: { nome: 'Intruso', dificuldade: 'iniciatico' } });
const qIntruso = await chamar(rotas.question, {
  corpo: { runId: outra.corpo.runId, token: outra.corpo.token, vela: 1 }
});
checar(
  (await chamar(rotas.answer, {
    corpo: {
      runId: terceira.corpo.runId,
      token: terceira.corpo.token,
      questionId: qIntruso.corpo.questionId,
      escolha: 0
    }
  })).status === 404,
  'corrida ativa nao responde pergunta de outra corrida'
);
checar(
  (await chamar(rotas.answer, {
    corpo: { runId, token, questionId: qIntruso.corpo.questionId, escolha: 0 }
  })).status === 409,
  'corrida ja concluida nao aceita mais respostas'
);

// tempo e dificuldade informados pelo cliente devem ser ignorados
const entradaBanco = await sql`select duracao_ms, dificuldade from ranking where id = ${entradaId}`;
checar(
  entradaBanco[0].duracao_ms === duracaoReal && entradaBanco[0].dificuldade === 'iniciatico',
  'tempo e dificuldade gravados sao os do servidor'
);
const reenvio = await chamar(rotas.submit, {
  corpo: { runId, token, capitulo: 'x', duracaoMs: 1, dificuldade: 'cavaleiro', nome: 'Hacker' }
});
checar(reenvio.status === 409, 'republicar a mesma corrida e bloqueado');

checar(
  (await chamar(rotas.finish, { corpo: { runId: outra.corpo.runId, token: outra.corpo.token } })).status === 409,
  'finish sem as sete luzes e recusado'
);

const qDupla = await chamar(rotas.question, {
  corpo: { runId: outra.corpo.runId, token: outra.corpo.token, vela: 1 }
});
const [{ indice_correta: certa }] = await sql`
  select indice_correta from run_question where id = ${qDupla.corpo.questionId}`;
await chamar(rotas.answer, {
  corpo: { runId: outra.corpo.runId, token: outra.corpo.token, questionId: qDupla.corpo.questionId, escolha: certa }
});
checar(
  (await chamar(rotas.answer, {
    corpo: { runId: outra.corpo.runId, token: outra.corpo.token, questionId: qDupla.corpo.questionId, escolha: certa }
  })).status === 409,
  'responder duas vezes a mesma pergunta e bloqueado'
);

checar(
  (await chamar(rotas.ability, {
    corpo: { runId: outra.corpo.runId, token: outra.corpo.token, vela: 7 }
  })).status === 409,
  'habilidade de vela apagada e recusada'
);

checar(
  (await chamar(rotas.me, {
    corpo: { entradas: [{ id: entradaId, token: 'forjado' }] }
  })).corpo.melhor === null,
  'reivindicar colocacao alheia sem token nao funciona'
);

secao('Painel de moderação');

checar((await chamar(rotas.entries, { metodo: 'GET' })).status === 401, 'listar sem sessao da 401');
checar(
  (await chamar(rotas.moderate, { corpo: { id: entradaId, acao: 'ocultar' } })).status === 401,
  'moderar sem sessao da 401'
);
checar(
  (await chamar(rotas.entries, { metodo: 'GET', cookie: 'torre_admin=999999999999.forjado' })).status === 401,
  'cookie de sessao forjado da 401'
);

const ipLogin = '198.51.100.' + Math.floor(Math.random() * 200);
const errada = await chamar(rotas.login, { corpo: { senha: 'nao-e-a-senha' }, ip: ipLogin });
checar(errada.status === 401, 'senha errada da 401');

const certo = await chamar(rotas.login, { corpo: { senha: 'Virgilino391' }, ip: ipLogin });
checar(certo.status === 200 && /HttpOnly/.test(certo.cabecalhos['set-cookie'] ?? ''), 'senha certa cria sessao HttpOnly');
checar(
  /SameSite=Strict/.test(certo.cabecalhos['set-cookie'] ?? ''),
  'cookie e SameSite=Strict (fecha CSRF)'
);
const cookieAdmin = (certo.cabecalhos['set-cookie'] ?? '').split(';')[0];

let bloqueou = false;
for (let i = 0; i < 8; i++) {
  const r = await chamar(rotas.login, { corpo: { senha: 'chute' + i }, ip: ipLogin });
  if (r.status === 429) { bloqueou = true; break; }
}
checar(bloqueou, 'brute force do login e barrado pelo rate limit');

const mod = await chamar(rotas.moderate, {
  corpo: { id: entradaId, acao: 'censurar', nomeExibicao: 'Anônimo', motivo: 'teste' },
  cookie: cookieAdmin
});
checar(mod.status === 200, 'censurar com sessao valida funciona');
const publico = await chamar(rotas.ranking, { metodo: 'GET', query: { dificuldade: 'iniciatico' } });
const linha = publico.corpo.ranking.iniciatico.find((e) => e.id === entradaId);
checar(linha?.nome === 'Anônimo', 'ranking publico mostra o nome censurado, nao o original');

await chamar(rotas.moderate, { corpo: { id: entradaId, acao: 'ocultar' }, cookie: cookieAdmin });
const pos = await chamar(rotas.ranking, { metodo: 'GET', query: { dificuldade: 'iniciatico' } });
checar(
  !pos.corpo.ranking.iniciatico.some((e) => e.id === entradaId),
  'entrada oculta some do ranking publico'
);
const log = await sql`select count(*)::int n from admin_log where ranking_id = ${entradaId}`;
checar(log[0].n === 2, `acoes de moderacao ficaram no log (${log[0].n})`);

// ------------------------------------------------------------------ limpeza
secao('Limpeza');
await sql`delete from run where nome in ('TesteBot','Intruso','Proto')`;
await sql`delete from rate_limit where chave like '%198.51.100%' or chave like '%203.0.113%'`;
const sobrou = await sql`select count(*)::int n from ranking`;
console.log(`  ranking restante: ${sobrou[0].n} linha(s)`);

console.log(
  `\n\x1b[1m${passou} passaram, ${falhou} falharam\x1b[0m\n`
);
process.exit(falhou ? 1 : 0);
