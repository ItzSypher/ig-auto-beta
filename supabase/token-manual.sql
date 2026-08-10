-- ============================================================
-- Inserir o token à mão
--
-- Use isto quando você conseguir um access token por qualquer caminho
-- (gerador da Meta, Graph API Explorer, login da empresa) e quiser
-- colocá-lo no app sem depender do fluxo de OAuth.
--
-- O app lê o token daqui primeiro; a variável de ambiente é só reserva.
-- ============================================================

-- Troque APENAS o valor entre aspas na linha do token.
-- Um token do Instagram é longo e começa com IGAA...
insert into public.config (id, ig_access_token, ig_user_id, ig_username, token_expires_at, token_refreshed_at, updated_at)
values (
  1,
  'COLE_O_TOKEN_AQUI',
  '17841462370831170',   -- id da moura_webp, já conhecido
  'moura_webp',
  now() + interval '60 days',
  now(),
  now()
)
on conflict (id) do update set
  ig_access_token   = excluded.ig_access_token,
  ig_user_id        = excluded.ig_user_id,
  ig_username       = excluded.ig_username,
  token_expires_at  = excluded.token_expires_at,
  token_refreshed_at = excluded.token_refreshed_at,
  updated_at        = now();

-- Conferência: deve mostrar o @ e a validade, sem expor o token inteiro.
select ig_username,
       ig_user_id,
       left(ig_access_token, 8) || '...' as token,
       token_expires_at
from public.config
where id = 1;
