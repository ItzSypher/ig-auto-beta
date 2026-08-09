import { db } from "@/lib/supabase";
import { matches, render, type MatchType } from "@/lib/matching";

export type TriggerKind = "comment" | "message" | "story_reply" | "postback";

export type Trigger = {
  kind: TriggerKind;
  igUserId: string;
  username: string | null;
  text: string;
  /** id do comentário, ou mid da mensagem. Base da chave de deduplicação. */
  ref: string;
  mediaId: string | null;
  contactId: string | null;
};

type Automation = {
  id: string;
  name: string;
  keywords: string[] | null;
  match_type: MatchType;
  media_id: string | null;
  public_replies: string[] | null;
  welcome_dm: string | null;
  quick_reply_label: string | null;
  link_message: string | null;
  link_button_label: string | null;
  link_url: string | null;
  link_delay_seconds: number | null;
  reminder_message: string | null;
  reminder_delay_seconds: number | null;
  reminder_enabled: boolean | null;
};

const AUTOMATION_COLS =
  "id,name,keywords,match_type,media_id,public_replies,welcome_dm," +
  "quick_reply_label,link_message,link_button_label,link_url," +
  "link_delay_seconds,reminder_message,reminder_delay_seconds,reminder_enabled";

type QueueRow = {
  kind: "private_reply" | "public_reply" | "welcome_dm" | "link" | "reminder";
  recipient_type: "comment_id" | "id" | "comment_reply";
  recipient_value: string;
  automation_id: string;
  contact_id: string | null;
  payload: Record<string, unknown>;
  /** false só para resposta privada de comentário, a única que fura a janela. */
  requires_24h_window: boolean;
  run_after: string;
  dedupe_key: string;
};

/**
 * Insere na fila ignorando duplicata.
 *
 * queue.dedupe_key é UNIQUE. Se a Meta reenviar o mesmo evento, o insert
 * falha com 23505 e a gente segue em frente — é exatamente o comportamento
 * desejado, e é o que garante "1 resposta privada por comentário".
 */
async function push(rows: QueueRow[]) {
  if (rows.length === 0) return 0;
  let inserted = 0;

  for (const row of rows) {
    const { error } = await db().from("queue").insert(row);
    if (!error) {
      inserted++;
      continue;
    }
    if (error.code === "23505") continue; // já enfileirado antes
    console.error("falha ao enfileirar", row.dedupe_key, error);
  }
  return inserted;
}

function pick(variations: string[] | null): string | null {
  const list = (variations ?? []).filter((v) => v?.trim());
  if (list.length === 0) return null;
  // Sorteia para não repetir o mesmo texto em todo comentário: repetição
  // idêntica é o que faz a conta ser marcada como spam.
  return list[Math.floor(Math.random() * list.length)];
}

function secondsFromNow(seconds: number) {
  return new Date(Date.now() + seconds * 1000).toISOString();
}

/** Só o primeiro nome, para {{primeiro_nome}}. */
function firstNameOf(username: string | null) {
  if (!username) return null;
  return username.split(/[._\s-]/)[0] || username;
}

async function activeAutomations(column: string): Promise<Automation[]> {
  const { data, error } = await db()
    .from("automations")
    .select(AUTOMATION_COLS)
    .eq("active", true)
    .eq(column, true);

  if (error) {
    console.error("falha ao carregar automações", error);
    return [];
  }
  return (data ?? []) as unknown as Automation[];
}

/**
 * Acha a primeira automação que casa. Uma só, de propósito: se duas
 * automações casassem o mesmo comentário, a pessoa receberia duas DMs.
 */
function firstMatch(list: Automation[], t: Trigger): Automation | null {
  for (const a of list) {
    if (t.kind === "comment" && a.media_id && a.media_id !== t.mediaId) continue;
    if (matches(t.text, a.keywords ?? [], a.match_type)) return a;
  }
  return null;
}

/**
 * Monta os envios de um gatilho e joga na fila.
 * Devolve a automação que casou, ou null.
 */
export async function enqueueForTrigger(t: Trigger): Promise<Automation | null> {
  const column =
    t.kind === "comment"
      ? "trigger_comment"
      : t.kind === "story_reply"
        ? "trigger_story_reply"
        : "trigger_dm";

  const automation = firstMatch(await activeAutomations(column), t);
  if (!automation) return null;

  const vars = { username: t.username, firstName: firstNameOf(t.username) };
  const rows: QueueRow[] = [];

  if (t.kind === "comment") {
    const publica = pick(automation.public_replies);
    if (publica) {
      rows.push({
        kind: "public_reply",
        recipient_type: "comment_id",
        recipient_value: t.ref,
        automation_id: automation.id,
        contact_id: t.contactId,
        payload: { text: render(publica, vars) },
        requires_24h_window: false,
        run_after: new Date().toISOString(),
        dedupe_key: `public_reply:${t.ref}`,
      });
    }

    if (automation.welcome_dm?.trim()) {
      // A resposta privada de comentário é a única que pode ser enviada sem
      // janela aberta — 1 vez por comentário, em até 7 dias.
      rows.push({
        kind: "private_reply",
        recipient_type: "comment_reply",
        recipient_value: t.ref,
        automation_id: automation.id,
        contact_id: t.contactId,
        payload: {
          text: render(automation.welcome_dm, vars),
          quick_reply_label: automation.quick_reply_label ?? null,
        },
        requires_24h_window: false,
        run_after: new Date().toISOString(),
        dedupe_key: `private_reply:${t.ref}`,
      });
    }
  } else if (automation.welcome_dm?.trim()) {
    // DM e resposta a story já abriram a janela ao chegar.
    rows.push({
      kind: "welcome_dm",
      recipient_type: "id",
      recipient_value: t.igUserId,
      automation_id: automation.id,
      contact_id: t.contactId,
      payload: {
        text: render(automation.welcome_dm, vars),
        quick_reply_label: automation.quick_reply_label ?? null,
      },
      requires_24h_window: true,
      run_after: new Date().toISOString(),
      dedupe_key: `welcome_dm:${t.ref}`,
    });
  }

  await push(rows);

  if (t.contactId) {
    await db()
      .from("contacts")
      .update({ last_automation_id: automation.id })
      .eq("id", t.contactId);
  }

  return automation;
}

/**
 * A pessoa tocou no botão. Isso abre a janela de 24h e libera a sequência:
 * a mensagem com link e, depois, o lembrete.
 *
 * Os dois saem dos campos da própria automação, que é o que o flow builder
 * edita. A tabela followups existe para sequências mais longas e entra
 * quando o builder passar a gerá-las.
 */
export async function enqueueFollowups(t: Trigger): Promise<number> {
  if (!t.contactId) return 0;

  const { data: contact } = await db()
    .from("contacts")
    .select("last_automation_id")
    .eq("id", t.contactId)
    .maybeSingle();

  const automationId = contact?.last_automation_id as string | undefined;
  if (!automationId) return 0;

  const { data } = await db()
    .from("automations")
    .select(AUTOMATION_COLS)
    .eq("id", automationId)
    .eq("active", true)
    .maybeSingle();

  const a = data as unknown as Automation | null;
  if (!a) return 0;

  const vars = { username: t.username, firstName: firstNameOf(t.username) };
  const rows: QueueRow[] = [];

  if (a.link_message?.trim() && a.link_url?.trim()) {
    rows.push({
      kind: "link",
      recipient_type: "id",
      recipient_value: t.igUserId,
      automation_id: a.id,
      contact_id: t.contactId,
      payload: {
        text: render(a.link_message, vars),
        button_label: a.link_button_label ?? "Abrir",
        button_url: a.link_url,
      },
      requires_24h_window: true,
      run_after: secondsFromNow(a.link_delay_seconds ?? 0),
      dedupe_key: `link:${a.id}:${t.igUserId}:${t.ref}`,
    });
  }

  if (a.reminder_enabled && a.reminder_message?.trim()) {
    // Dispara por tempo: não há como saber se a pessoa clicou no link.
    // Teto de 24h porque fora da janela a Meta recusa o envio.
    const delay = Math.min(a.reminder_delay_seconds ?? 3600, 24 * 3600 - 300);
    rows.push({
      kind: "reminder",
      recipient_type: "id",
      recipient_value: t.igUserId,
      automation_id: a.id,
      contact_id: t.contactId,
      payload: { text: render(a.reminder_message, vars) },
      requires_24h_window: true,
      run_after: secondsFromNow(delay),
      dedupe_key: `reminder:${a.id}:${t.igUserId}:${t.ref}`,
    });
  }

  return push(rows);
}
