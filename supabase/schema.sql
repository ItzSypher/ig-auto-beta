-- ============================================================
-- IG Auto — schema completo
-- Rode este arquivo inteiro no Supabase: SQL Editor > New query > Run.
-- É idempotente: pode rodar de novo sem quebrar nada.
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- config — uma linha só, com a conta do Instagram conectada
-- ------------------------------------------------------------
create table if not exists public.config (
  id                     boolean primary key default true,
  ig_user_id             text,
  ig_username            text,
  ig_profile_picture_url text,
  ig_access_token        text,
  token_expires_at       timestamptz,
  updated_at             timestamptz not null default now(),
  constraint config_singleton check (id)
);

insert into public.config (id) values (true) on conflict (id) do nothing;

-- ------------------------------------------------------------
-- automations — o que dispara e o que responde
-- ------------------------------------------------------------
create table if not exists public.automations (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  is_active          boolean not null default false,

  -- gatilhos
  trigger_comment    boolean not null default false,
  trigger_story      boolean not null default false,
  trigger_dm         boolean not null default false,

  -- casamento de palavra-chave
  keywords           text[] not null default '{}',
  match_type         text   not null default 'contains'
                       check (match_type in ('contains', 'exact', 'any')),
  -- null/vazio = vale para qualquer post
  ig_media_id        text,

  -- resposta pública no comentário (sorteia uma das variações)
  public_replies     text[] not null default '{}',

  -- DM de boas-vindas + botão de resposta rápida
  welcome_dm         text,
  quick_reply_label  text,

  -- mensagem com link
  link_text          text,
  link_button_label  text,
  link_url           text,

  -- lembrete por tempo
  reminder_text      text,
  reminder_delay_minutes integer not null default 60
                       check (reminder_delay_minutes between 1 and 1440),

  -- grafo do flow builder (nodes + edges), fonte da verdade da UI
  flow               jsonb not null default '{"nodes":[],"edges":[]}'::jsonb,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists automations_active_idx
  on public.automations (is_active) where is_active;

-- ------------------------------------------------------------
-- followups — a sequência de envio derivada da automação
-- ------------------------------------------------------------
create table if not exists public.followups (
  id             uuid primary key default gen_random_uuid(),
  automation_id  uuid not null references public.automations(id) on delete cascade,
  step_order     integer not null,
  delay_minutes  integer not null default 0 check (delay_minutes >= 0),
  message_type   text not null default 'text'
                   check (message_type in ('text', 'button', 'image')),
  body           text,
  button_label   text,
  button_url     text,
  image_url      text,
  created_at     timestamptz not null default now(),
  unique (automation_id, step_order)
);

create index if not exists followups_automation_idx
  on public.followups (automation_id, step_order);

-- ------------------------------------------------------------
-- contacts — quem falou com você
-- ------------------------------------------------------------
create table if not exists public.contacts (
  id                  uuid primary key default gen_random_uuid(),
  ig_user_id          text not null unique,
  username            text,
  first_seen_at       timestamptz not null default now(),
  -- toda mensagem RECEBIDA atualiza este campo: é ele que abre a janela de 24h
  last_inbound_at     timestamptz,
  last_automation_id  uuid references public.automations(id) on delete set null,
  created_at          timestamptz not null default now()
);

-- ------------------------------------------------------------
-- queue — fila de envio com trava atômica
-- ------------------------------------------------------------
do $$ begin
  create type public.queue_status as enum
    ('pending', 'sending', 'sent', 'failed', 'skipped');
exception when duplicate_object then null;
end $$;

create table if not exists public.queue (
  id             uuid primary key default gen_random_uuid(),
  contact_id     uuid references public.contacts(id) on delete cascade,
  ig_user_id     text not null,
  automation_id  uuid references public.automations(id) on delete set null,
  followup_id    uuid references public.followups(id) on delete set null,

  kind           text not null
                   check (kind in ('private_reply', 'dm', 'followup', 'reminder')),
  payload        jsonb not null default '{}'::jsonb,

  -- private_reply responde a um comentário específico
  comment_id     text,
  -- private_reply FURA a janela de 24h => false. Todo o resto => true.
  requires_open_window boolean not null default true,
  -- private_reply: comment_time + 7 dias. Passou disso, vira 'skipped'.
  window_deadline timestamptz,

  status         public.queue_status not null default 'pending',
  run_after      timestamptz not null default now(),
  claimed_at     timestamptz,
  attempts       integer not null default 0,
  last_error     text,
  sent_at        timestamptz,
  created_at     timestamptz not null default now()
);

-- índice que o worker usa para achar o próximo lote
create index if not exists queue_drain_idx
  on public.queue (run_after) where status = 'pending';

-- uma resposta privada por comentário, para sempre
create unique index if not exists queue_one_private_reply_per_comment
  on public.queue (comment_id) where kind = 'private_reply';

create index if not exists queue_contact_idx on public.queue (contact_id);

-- ------------------------------------------------------------
-- events — log cru de tudo que a Meta manda
-- ------------------------------------------------------------
create table if not exists public.events (
  id           bigserial primary key,
  received_at  timestamptz not null default now(),
  event_type   text,
  ig_user_id   text,
  raw          jsonb not null
);

create index if not exists events_received_idx on public.events (received_at desc);

-- ------------------------------------------------------------
-- claim_queue_batch — trava atômica do worker
--
-- FOR UPDATE SKIP LOCKED garante que duas execuções simultâneas do cron
-- nunca peguem a mesma linha. Itens presos em 'sending' há mais de
-- stale_seconds voltam para 'pending' (worker morreu no meio).
-- ------------------------------------------------------------
create or replace function public.claim_queue_batch(
  batch_size    integer default 20,
  stale_seconds integer default 120
)
returns setof public.queue
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.queue
     set status = 'pending', claimed_at = null
   where status = 'sending'
     and claimed_at < now() - make_interval(secs => stale_seconds);

  -- fora da janela de 7 dias da resposta privada: não adianta tentar
  update public.queue
     set status = 'skipped', last_error = 'janela expirada'
   where status = 'pending'
     and window_deadline is not null
     and window_deadline < now();

  return query
  update public.queue q
     set status = 'sending',
         claimed_at = now(),
         attempts = q.attempts + 1
   where q.id in (
     select id
       from public.queue
      where status = 'pending'
        and run_after <= now()
      order by run_after
      for update skip locked
      limit batch_size
   )
  returning q.*;
end;
$$;

-- ------------------------------------------------------------
-- RLS ligada e SEM políticas em todas as tabelas.
-- Ninguém acessa pelo anon key. Só o servidor, com a Service Role Key,
-- que por definição passa por cima da RLS.
-- ------------------------------------------------------------
alter table public.config      enable row level security;
alter table public.automations enable row level security;
alter table public.followups   enable row level security;
alter table public.contacts    enable row level security;
alter table public.queue       enable row level security;
alter table public.events      enable row level security;

-- Trava extra: nem PostgREST enxerga a função de claim.
revoke all on function public.claim_queue_batch(integer, integer) from anon, authenticated;
