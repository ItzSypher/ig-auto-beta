import { NextResponse } from "next/server";
import { after } from "next/server";
import { verifyWebhookSignature } from "@/lib/meta";
import { db } from "@/lib/supabase";
import { enqueueFollowups, enqueueForTrigger, type TriggerKind } from "@/lib/enqueue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Handshake. A Meta bate aqui uma vez, ao salvar o webhook no painel, e
 * espera receber o hub.challenge de volta como texto puro — nada de JSON.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  const expected = process.env.IG_VERIFY_TOKEN;
  if (!expected) {
    console.error("IG_VERIFY_TOKEN não está configurada");
    return new NextResponse("misconfigured", { status: 500 });
  }

  if (mode === "subscribe" && token === expected && challenge) {
    return new NextResponse(challenge, {
      status: 200,
      headers: { "content-type": "text/plain" },
    });
  }

  return new NextResponse("forbidden", { status: 403 });
}

type NormalizedEvent = {
  kind: "comment" | "message" | "story_reply" | "postback" | "unknown";
  igUserId: string;
  username: string | null;
  text: string;
  /** id do comentário, ou mid da mensagem — serve de chave de deduplicação */
  ref: string;
  mediaId: string | null;
  raw: unknown;
};

/**
 * Achata o envelope da Meta em eventos simples.
 *
 * Comentários chegam em `entry[].changes[]`; mensagens em `entry[].messaging[]`.
 * Resposta a story é uma mensagem comum que traz `message.reply_to.story`.
 */
function normalize(body: Record<string, unknown>): NormalizedEvent[] {
  const out: NormalizedEvent[] = [];
  const entries = Array.isArray(body.entry) ? body.entry : [];

  for (const entryRaw of entries) {
    const entry = entryRaw as Record<string, unknown>;

    for (const changeRaw of (entry.changes as unknown[]) ?? []) {
      const change = changeRaw as Record<string, unknown>;
      if (change.field !== "comments") continue;

      const v = (change.value ?? {}) as Record<string, unknown>;
      const from = (v.from ?? {}) as Record<string, unknown>;
      const media = (v.media ?? {}) as Record<string, unknown>;

      out.push({
        kind: "comment",
        igUserId: String(from.id ?? ""),
        username: (from.username as string) ?? null,
        text: String(v.text ?? ""),
        ref: String(v.id ?? ""),
        mediaId: media.id ? String(media.id) : null,
        raw: change,
      });
    }

    for (const msgRaw of (entry.messaging as unknown[]) ?? []) {
      const m = msgRaw as Record<string, unknown>;
      const sender = (m.sender ?? {}) as Record<string, unknown>;
      const message = (m.message ?? {}) as Record<string, unknown>;
      const postback = (m.postback ?? {}) as Record<string, unknown>;

      // Eco das nossas próprias mensagens: ignorar, senão viramos loop.
      if (message.is_echo) continue;

      const replyTo = (message.reply_to ?? {}) as Record<string, unknown>;
      const isStoryReply = Boolean(replyTo.story);

      if (m.postback) {
        out.push({
          kind: "postback",
          igUserId: String(sender.id ?? ""),
          username: null,
          text: String(postback.title ?? postback.payload ?? ""),
          ref: String(postback.mid ?? m.timestamp ?? ""),
          mediaId: null,
          raw: m,
        });
        continue;
      }

      if (!message.mid) continue;

      out.push({
        kind: isStoryReply ? "story_reply" : "message",
        igUserId: String(sender.id ?? ""),
        username: null,
        text: String(message.text ?? ""),
        ref: String(message.mid),
        mediaId: null,
        raw: m,
      });
    }
  }

  return out.filter((e) => e.igUserId);
}

/**
 * Toda mensagem RECEBIDA reabre a janela de 24h. É o `last_reply_at` que o
 * worker vai consultar antes de liberar qualquer envio que dependa dela.
 */
async function recordContact(e: NormalizedEvent) {
  const supabase = db();
  const now = new Date().toISOString();

  const { data: existing } = await supabase
    .from("contacts")
    .select("id")
    .eq("ig_user_id", e.igUserId)
    .maybeSingle();

  const opensWindow = e.kind !== "comment";

  if (existing?.id) {
    await supabase
      .from("contacts")
      .update({
        ...(e.username ? { username: e.username } : {}),
        ...(opensWindow ? { last_reply_at: now } : {}),
        last_trigger_ref: e.ref,
        updated_at: now,
      })
      .eq("id", existing.id);
    return existing.id as string;
  }

  const { data: created } = await supabase
    .from("contacts")
    .insert({
      ig_user_id: e.igUserId,
      username: e.username,
      first_contact_at: now,
      last_reply_at: opensWindow ? now : null,
      last_trigger_ref: e.ref,
    })
    .select("id")
    .maybeSingle();

  return (created?.id as string) ?? null;
}

/**
 * Recebe os eventos.
 *
 * Responde 200 rápido e faz o trabalho no after(): a Meta desiste e reenvia
 * se demorarmos, e reenvio duplicado é pior do que processamento tardio.
 */
export async function POST(req: Request) {
  const appSecret = process.env.IG_APP_SECRET;
  if (!appSecret) {
    console.error("IG_APP_SECRET não está configurada");
    return new NextResponse("misconfigured", { status: 500 });
  }

  // Precisa ser o corpo cru: reserializar o JSON muda os bytes e a
  // assinatura deixa de bater.
  const rawBody = await req.text();
  const signatureOk = verifyWebhookSignature(
    rawBody,
    req.headers.get("x-hub-signature-256"),
    appSecret,
  );

  if (!signatureOk) {
    console.warn("webhook com assinatura inválida, descartado");
    return new NextResponse("invalid signature", { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return new NextResponse("bad json", { status: 400 });
  }

  after(async () => {
    try {
      const events = normalize(body);
      const supabase = db();

      for (const e of events) {
        // dedupe_key impede processar duas vezes quando a Meta reenvia.
        const { error } = await supabase.from("events").insert({
          kind: e.kind,
          ig_user_id: e.igUserId,
          payload: e.raw as object,
          signature_ok: true,
          dedupe_key: `${e.kind}:${e.ref}`,
        });

        // Violação de unicidade: já tratamos este evento, seguir em frente.
        if (error?.code === "23505") continue;
        if (error) {
          console.error("falha ao gravar evento", error);
          continue;
        }

        const contactId = await recordContact(e);
        const trigger = {
          kind: e.kind as TriggerKind,
          igUserId: e.igUserId,
          username: e.username,
          text: e.text,
          ref: e.ref,
          mediaId: e.mediaId,
          contactId,
        };

        // Toque no botão abre a janela e libera a sequência; qualquer outro
        // evento é um gatilho que pode iniciar uma automação.
        if (e.kind === "postback") {
          await enqueueFollowups(trigger);
        } else if (e.kind !== "unknown") {
          await enqueueForTrigger(trigger);
        }
      }
    } catch (err) {
      console.error("falha ao processar webhook", err);
    }
  });

  return new NextResponse("EVENT_RECEIVED", { status: 200 });
}
