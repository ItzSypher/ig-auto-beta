-- ============================================================
-- Motor de tempo: pg_cron + pg_net
--
-- A Vercel no plano Hobby não roda cron de minuto. O pg_cron do Supabase
-- roda, e o pg_net faz a chamada HTTP de dentro do próprio banco.
--
-- Rode no SQL Editor DEPOIS que o app estiver no ar.
-- O CRON_SECRET abaixo tem que ser igual ao que está na Vercel.
-- ============================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ------------------------------------------------------------
-- A cada minuto: drena a fila de envio
-- ------------------------------------------------------------
select cron.schedule(
  'ig-auto-drain',
  '* * * * *',
  $$
  select net.http_post(
    url     := 'https://ig-auto-beta.vercel.app/api/cron/drain',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ec477325633933a877a347b5e8141206ef968d89221456d2'
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 25000
  );
  $$
);

-- ------------------------------------------------------------
-- Segunda-feira 03:00 UTC: renova o token de 60 dias
-- ------------------------------------------------------------
select cron.schedule(
  'ig-auto-refresh-token',
  '0 3 * * 1',
  $$
  select net.http_post(
    url     := 'https://ig-auto-beta.vercel.app/api/cron/refresh-token',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ec477325633933a877a347b5e8141206ef968d89221456d2'
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 25000
  );
  $$
);

-- Conferir o que está agendado:
--   select jobid, jobname, schedule, active from cron.job;
--
-- Ver as últimas execuções:
--   select jobid, status, return_message, start_time
--     from cron.job_run_details order by start_time desc limit 20;
--
-- Desagendar:
--   select cron.unschedule('ig-auto-drain');
