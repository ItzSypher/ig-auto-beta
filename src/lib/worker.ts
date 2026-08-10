import { accessToken, replyToComment, sendMessage, type SendResult } from "@/lib/ig";
import { db } from "@/lib/supabase";


/** Teto de segurança da Meta. */
const MAX_PER_HOUR = 200;
/** No máximo 2 envios por segundo. */
const GAP_MS = 500;
/** Quantos itens tirar da fila por execução do cron. */
const BATCH = 20;

type QueueItem = {
  id: string;
  kind: "private_reply" | "public_reply" | "welcome_dm" | "link" | "reminder";
  recipient_type: "comment_id" | "id" | "comment_reply";
  recipient_value: string;
  contact_id: string | null;
  payload: Record<string, unknown>;
  requires_24h_window: boolean;
  attempts: number;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Quantos já saíram na última hora, para respeitar o teto. */
async function sentLastHour(): Promise<number> {
  const { data, error } = await db().rpc("sent_last_hour");
  if (!error && typeof data === "number") return data;

  // Se a função não existir, conta na mão.
  const since = new Date(Date.now() - 3600_000).toISOString();
  const { count } = await db()
    .from("queue")
    .select("id", { count: "exact", head: true })
    .eq("status", "sent")
    .gte("sent_at", since);
  return count ?? 0;
}

/**
 * A janela de 24h conta a partir da última mensagem RECEBIDA da pessoa.
 * Fora dela a Meta recusa, então nem tentamos: marcamos como skipped.
 */
async function windowOpen(contactId: string | null): Promise<boolean> {
  if (!contactId) return false;
  const { data } = await db()
    .from("contacts")
    .select("last_reply_at")
    .eq("id", contactId)
    .maybeSingle();

  const last = data?.last_reply_at as string | null | undefined;
  if (!last) return false;
  return Date.now() - new Date(last).getTime() < 24 * 3600 * 1000;
}

async function deliver(item: QueueItem, token: string): Promise<SendResult> {
  const text = String(item.payload.text ?? "");
  const quickReply = (item.payload.quick_reply_label as string | null) ?? null;
  const buttonUrl = item.payload.button_url as string | undefined;
  const buttonLabel = (item.payload.button_label as string) ?? "Abrir";

  if (item.kind === "public_reply") {
    return replyToComment(item.recipient_value, text, token);
  }

  const recipient =
    item.recipient_type === "comment_reply"
      ? { comment_id: item.recipient_value }
      : { id: item.recipient_value };

  return sendMessage(recipient, token, text, {
    quickReply,
    link: buttonUrl ? { label: buttonLabel, url: buttonUrl } : null,
  });
}

async function finish(
  id: string,
  patch: Record<string, unknown>,
) {
  await db().from("queue").update(patch).eq("id", id);
}

/**
 * Drena a fila.
 *
 * Chamado a cada minuto pelo pg_cron do Supabase — a Vercel no plano Hobby
 * não roda cron de minuto. A trava atômica está no banco: claim_queue_batch
 * usa FOR UPDATE SKIP LOCKED, então duas execuções simultâneas nunca pegam
 * o mesmo item.
 */
export async function drain() {
  const token = await accessToken();
  if (!token) return { erro: "sem token de acesso" };

  const already = await sentLastHour();
  const budget = Math.max(0, MAX_PER_HOUR - already);
  if (budget === 0) {
    return { enviados: 0, motivo: `teto de ${MAX_PER_HOUR}/hora atingido` };
  }

  const { data, error } = await db().rpc("claim_queue_batch", {
    p_limit: Math.min(BATCH, budget),
  });
  if (error) return { erro: `claim_queue_batch: ${error.message}` };

  const items = (data ?? []) as QueueItem[];
  let enviados = 0;
  let pulados = 0;
  let falhas = 0;

  for (const [i, item] of items.entries()) {
    if (i > 0) await sleep(GAP_MS);

    if (item.requires_24h_window && !(await windowOpen(item.contact_id))) {
      await finish(item.id, {
        status: "skipped",
        last_error: "janela de 24h fechada",
      });
      pulados++;
      continue;
    }

    const result = await deliver(item, token);

    if (result.ok) {
      await finish(item.id, {
        status: "sent",
        sent_at: new Date().toISOString(),
        last_error: null,
      });
      enviados++;
      continue;
    }

    // Erro definitivo, ou já tentamos demais: para de insistir.
    const desiste = result.fatal || item.attempts >= 4;
    await finish(item.id, {
      status: desiste ? "failed" : "pending",
      claimed_at: null,
      last_error: result.error,
      // Recuo progressivo: 1min, 2min, 4min...
      ...(desiste
        ? {}
        : {
            run_after: new Date(
              Date.now() + 60_000 * 2 ** Math.min(item.attempts, 4),
            ).toISOString(),
          }),
    });
    falhas++;
  }

  return { enviados, pulados, falhas, naFila: items.length };
}
