# Banco (Supabase)

**Não existe migration neste repositório e isso é de propósito.**

O banco já estava criado antes deste código. O schema abaixo foi lido direto do
Supabase (`information_schema.columns`) e é a fonte da verdade — o código se
adapta a ele, nunca o contrário.

Projeto: `zxzhyzubeyqddnlsepgs` (org FOXTI, projeto VEMDM).

## Tabelas

### config
`id, ig_access_token, ig_user_id, ig_username, ig_profile_picture_url,`
`token_expires_at, token_refreshed_at, created_at, updated_at`

### automations
`id, name, active, trigger_comment, trigger_story_reply, trigger_dm,`
`keywords, match_type, media_id, public_replies, welcome_dm,`
`quick_reply_label, link_message, link_button_label, link_url,`
`link_delay_seconds, reminder_message, ...`

> ⚠️ A listagem veio cortada na tela. Faltam confirmar as colunas depois de
> `reminder_message` — em especial se existe uma coluna `jsonb` para guardar o
> grafo do flow builder. Sem ela, o builder não tem onde salvar os nodes.

### followups
`id, automation_id, step_order, kind, body, button_label, button_url,`
`delay_seconds, created_at`

### contacts
`id, ig_user_id, username, first_contact_at, last_reply_at,`
`last_automation_id, created_at, updated_at, last_trigger_ref`

`last_reply_at` é o campo que abre a janela de 24h.

### queue
`id, kind, recipient_type, recipient_value, automation_id, contact_id,`
`followup_id, payload, status, claimed_at, run_after, requires_24h_window,`
`attempts, last_error, sent_at, dedupe_key, created_at`

`requires_24h_window = false` é o que deixa a resposta privada de comentário
furar a janela. `dedupe_key` impede o envio repetido.

### events
`id, kind, ig_user_id, payload, signature_ok, note, dedupe_key, created_at`

## Ainda por confirmar

- Colunas finais de `automations` (ver aviso acima)
- Se a função de trava atômica da fila existe (`claim_queue_batch` ou similar)
- Se a RLS está ligada em todas as tabelas
- Índice único em `queue.dedupe_key`

Qualquer ajuste que faltar vai entrar aqui como `ajustes.sql`, contendo só o
delta — nunca um `create table` de algo que já existe.
