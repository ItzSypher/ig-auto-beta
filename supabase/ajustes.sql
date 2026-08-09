-- ============================================================
-- Único ajuste necessário no banco.
--
-- O banco já estava completo: as 6 tabelas, a RLS ligada em todas
-- e a função claim_queue_batch(p_limit) existem e estão corretas.
--
-- A única coisa que falta é onde guardar o grafo do flow builder
-- (a posição dos blocos e as ligações entre eles). Sem esta coluna
-- o builder desenha, mas não tem onde salvar.
--
-- Rode no SQL Editor. Não apaga nem altera dado nenhum: só acrescenta
-- uma coluna, e o "if not exists" faz virar no-op se rodar duas vezes.
-- ============================================================

alter table public.automations
  add column if not exists flow jsonb not null
  default '{"nodes":[],"edges":[]}'::jsonb;

-- Conferência: deve devolver uma linha, com data_type = jsonb
select column_name, data_type, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'automations'
  and column_name = 'flow';
