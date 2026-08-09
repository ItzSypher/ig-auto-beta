-- ============================================================
-- IG Auto — motor de tempo (pg_cron + pg_net)
--
-- NÃO rode isto ainda. Só depois que o app estiver no ar e você tiver:
--   1. a URL do deploy   (ex.: https://ig-auto-beta.vercel.app)
--   2. o valor de CRON_SECRET configurado na Vercel
--
-- Motivo de existir: a Vercel no plano Hobby não roda cron de minuto.
-- O pg_cron do Supabase roda, e o pg_net faz a chamada HTTP de dentro do banco.
-- ============================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Troque os dois valores abaixo antes de rodar.
--   :app_url     -> https://SEU-DEPLOY.vercel.app
--   :cron_secret -> o mesmo valor que está na variável CRON_SECRET da Vercel

-- ------------------------------------------------------------
-- A cada minuto: drena a fila de envio
-- ------------------------------------------------------------
select cron.schedule(
  'ig-auto-drain',
  '* * * * *',
  $$
  select net.http_post(
    url     := 'https://SEU-DEPLOY.vercel.app/api/cron/drain',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer SEU_CRON_SECRET'
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 25000
  );
  $$
);

-- ------------------------------------------------------------
-- Toda segunda 03:00 UTC: renova o token de longa duração
-- (o token do Instagram dura 60 dias e só pode ser renovado
--  depois de 24h de vida — renovar semanalmente nunca deixa vencer)
-- ------------------------------------------------------------
select cron.schedule(
  'ig-auto-refresh-token',
  '0 3 * * 1',
  $$
  select net.http_post(
    url     := 'https://SEU-DEPLOY.vercel.app/api/cron/refresh-token',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer SEU_CRON_SECRET'
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 25000
  );
  $$
);

-- Conferir o que está agendado:
--   select jobid, jobname, schedule, active from cron.job;
-- Ver as últimas execuções:
--   select * from cron.job_run_details order by start_time desc limit 20;
-- Remover um agendamento:
--   select cron.unschedule('ig-auto-drain');
