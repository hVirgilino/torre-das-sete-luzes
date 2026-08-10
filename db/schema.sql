-- Esquema do ranking global — Neon/Postgres.
--
-- Princípio: o cliente nunca guarda nada que valha nota. Numa partida
-- ranqueada as perguntas são sorteadas aqui, a resposta certa nunca sai do
-- banco, e o tempo é a diferença entre dois relógios do servidor.
--
-- Aplicar com: npm run db:migrate

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- corridas
create table if not exists run (
  id             uuid primary key default gen_random_uuid(),
  nome           text        not null,
  dificuldade    text        not null,
  status         text        not null default 'ativa',
  -- estado das 7 velas: [{ "locks": n, "lit": bool }, ...]
  velas          jsonb       not null,
  -- buff da vela 5 pendente (a próxima habilidade não apaga a vela)
  protecao_ativa boolean     not null default false,
  -- memória anti-repetição de sentenças/lacunas, por corrida
  historico      jsonb       not null default '{"sentencas":[],"spans":[]}'::jsonb,
  acertos        integer     not null default 0,
  erros          integer     not null default 0,
  iniciada_em    timestamptz not null default now(),
  vista_em       timestamptz not null default now(),
  concluida_em   timestamptz,
  duracao_ms     integer,
  ip_hash        text,
  constraint run_status_valido check (status in ('ativa', 'concluida', 'abandonada')),
  constraint run_dificuldade_valida
    check (dificuldade in ('escudeiro', 'iniciatico', 'demolay', 'cavaleiro'))
);

create index if not exists run_ativas_idx on run (status, vista_em);

-- ------------------------------------------------------------- perguntas
-- Uma pergunta em aberto por corrida. `correta` e `indice_correta` são o
-- segredo que torna o modo ranqueado verificável — nunca vão na resposta HTTP.
create table if not exists run_question (
  id             uuid primary key default gen_random_uuid(),
  run_id         uuid        not null references run(id) on delete cascade,
  vela           smallint    not null,
  origem         text        not null,
  antes          text        not null,
  depois         text        not null,
  correta        text        not null,
  indice_correta smallint    not null,
  opcoes         jsonb       not null,
  -- efeitos de habilidade que valem só para esta pergunta
  sem_reset      boolean     not null default false,
  congelada      boolean     not null default false,
  eliminadas     jsonb       not null default '[]'::jsonb,
  criada_em      timestamptz not null default now(),
  prazo_em       timestamptz not null,
  respondida_em  timestamptz,
  acertou        boolean
);

create index if not exists run_question_aberta_idx
  on run_question (run_id, criada_em desc);

-- --------------------------------------------------------------- ranking
create table if not exists ranking (
  id            uuid primary key default gen_random_uuid(),
  run_id        uuid        not null unique references run(id) on delete cascade,
  nome          text        not null,
  -- preenchido só pela moderação; sobrepõe `nome` na exibição
  nome_exibicao text,
  capitulo      text,
  dificuldade   text        not null,
  duracao_ms    integer     not null,
  criado_em     timestamptz not null default now(),
  oculto        boolean     not null default false,
  motivo        text,
  moderado_em   timestamptz,
  constraint ranking_dificuldade_valida
    check (dificuldade in ('iniciatico', 'demolay', 'cavaleiro')),
  constraint ranking_duracao_positiva check (duracao_ms > 0)
);

-- o índice parcial é o que serve a consulta do ranking (só linhas visíveis)
create index if not exists ranking_classificacao_idx
  on ranking (dificuldade, duracao_ms, criado_em) where oculto = false;

-- ------------------------------------------------------- log de moderação
create table if not exists admin_log (
  id         bigserial primary key,
  acao       text        not null,
  ranking_id uuid,
  detalhe    jsonb,
  ip_hash    text,
  criado_em  timestamptz not null default now()
);

-- ----------------------------------------------------------- rate limit
-- Contador por janela. Simples de propósito: o volume aqui é baixo e uma
-- tabela evita depender de um segundo serviço só para isso.
create table if not exists rate_limit (
  chave      text primary key,
  contador   integer     not null default 0,
  janela_em  timestamptz not null default now()
);

-- Escudeiro saiu do ranking depois da criação da tabela; este bloco aperta o
-- CHECK em bases que já existiam. Idempotente: se já estiver apertado, não faz
-- nada. Falha de propósito se houver linha de Escudeiro publicada, para a
-- decisão de o que fazer com ela ser humana e não silenciosa.
do $$
begin
  if exists (
    select 1 from pg_constraint
     where conname = 'ranking_dificuldade_valida'
       and pg_get_constraintdef(oid) like '%escudeiro%'
  ) then
    alter table ranking drop constraint ranking_dificuldade_valida;
    alter table ranking add constraint ranking_dificuldade_valida
      check (dificuldade in ('iniciatico', 'demolay', 'cavaleiro'));
  end if;
end $$;
