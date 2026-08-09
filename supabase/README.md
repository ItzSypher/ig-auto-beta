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
`id (uuid), name (text), active (bool), trigger_comment (bool),`
`trigger_story_reply (bool), trigger_dm (bool), keywords (array),`
`match_type (text), media_id (text), public_replies (array),`
`welcome_dm (text), quick_reply_label (text), link_message (text),`
`link_button_label (text), link_url (text), link_delay_seconds (int),`
`reminder_message (text), reminder_delay_seconds (int),`
`reminder_enabled (bool), created_at, updated_at`

Mais `flow (jsonb)`, acrescentada por `ajustes.sql` — é onde o flow builder
guarda os nodes e as ligações.

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

## Funções que já existem

| Função | Para quê |
| --- | --- |
| `claim_queue_batch(p_limit integer)` | trava atômica do worker ao puxar um lote |
| `expire_stale_queue()` | devolve para a fila o que ficou preso em `sending` |
| `sent_last_hour()` | contador para respeitar o teto de 200 envios/hora |
| `touch_updated_at()` | trigger que mantém `updated_at` |
| `rls_auto_enable()` | liga RLS automaticamente em tabela nova |

## RLS

Ligada nas seis tabelas (`config`, `automations`, `followups`, `contacts`,
`queue`, `events`), sem políticas. Só o servidor entra, com a secret key.

## Ainda por conferir

- Índice único em `queue.dedupe_key`

Qualquer ajuste entra como `ajustes.sql`, contendo só o delta — nunca um
`create table` de algo que já existe.
