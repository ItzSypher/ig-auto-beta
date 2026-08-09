# IG Auto

Automação de Instagram própria, sem mensalidade: **comentário vira DM**.
Next.js (App Router) na Vercel + PostgreSQL no Supabase, tudo em plano grátis.

## Estado atual

| Parte | Situação |
| --- | --- |
| Flow builder visual (nodes) | ✅ funcionando, com fluxo piloto |
| Schema do banco (`supabase/schema.sql`) | ✅ escrito, falta rodar no Supabase |
| Webhook da Meta | ⛔ próximo passo |
| Fila + worker de envio | ⛔ próximo passo |
| pg_cron (`supabase/cron.sql`) | ⛔ depois do deploy |

O builder ainda **não grava no banco** — o rascunho fica no `localStorage`.
Isso muda quando as credenciais do Supabase entrarem.

## Rodar local

```bash
npm install
cp .env.example .env.local   # preencha o que tiver
npm run dev
```

- `/` — painel de configuração: mostra quais variáveis já estão setadas.
- `/builder` — o flow builder.

## Banco

No Supabase: **SQL Editor → New query** → cole `supabase/schema.sql` → **Run**.
É idempotente, pode rodar de novo.

Tabelas: `config`, `automations`, `followups`, `contacts`, `queue`, `events`.
Todas com RLS ligada e **sem políticas** — só o servidor entra, usando a
Service Role Key.

## Blocos do fluxo

| Bloco | O que faz |
| --- | --- |
| Quando... | Gatilho: comentário, resposta a story ou DM + palavras-chave |
| Resposta pública | Responde no próprio comentário (sorteia entre variações) |
| Enviar DM | Mensagem no direct com botões de resposta rápida |
| Mensagem com link | Texto + botão que abre uma URL |
| Esperar | Pausa entre mensagens |
| Lembrete | Cutucada disparada por tempo |
| Anotação | Post-it, não envia nada |

## As três regras que mandam no desenho

1. **Resposta privada de comentário fura a janela de 24h** — mas só 1 vez por
   comentário e em até 7 dias. Por isso `queue` tem índice único em
   `comment_id` e o campo `window_deadline`.
2. **Fora isso, só dá para mandar DM dentro de 24h** contadas a partir da
   última mensagem que a pessoa mandou. É o `contacts.last_inbound_at`.
3. **Disparo em massa para base fria é proibido** e derruba a conta. Todo envio
   aqui nasce de uma ação da pessoa.

## Limites que não dá para contornar

- Não dá para exigir que a pessoa te siga antes de liberar o link.
- Não dá para saber se ela clicou no link — o lembrete dispara por tempo.
