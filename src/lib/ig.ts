import { db } from "@/lib/supabase";

const GRAPH = "https://graph.instagram.com/v23.0";

export type SendResult = { ok: true } | { ok: false; error: string; fatal: boolean };

/**
 * Token de acesso: primeiro o do banco (gravado pelo OAuth e renovado
 * sozinho), com a variável de ambiente como rede de segurança.
 */
export async function accessToken(): Promise<string | null> {
  try {
    const { data } = await db()
      .from("config")
      .select("ig_access_token")
      .eq("id", 1)
      .maybeSingle();
    if (data?.ig_access_token) return data.ig_access_token as string;
  } catch {
    // banco fora do ar: cai para a variável de ambiente
  }
  return process.env.IG_ACCESS_TOKEN ?? null;
}

/**
 * Erros que não adianta repetir: comentário apagado, janela fechada,
 * permissão negada. Repetir só queima cota e polui o log.
 */
function isFatal(code: number, subcode: number, message: string): boolean {
  if (code === 190) return true; // token inválido/expirado
  if (code === 10 || code === 200) return true; // sem permissão
  if (code === 100 && /does not exist|Unsupported|Invalid parameter/i.test(message)) {
    return true;
  }
  if (subcode === 2534037) return true; // fora da janela de mensagens
  return false;
}

async function call(url: string, body: unknown): Promise<SendResult> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    // Falha de rede: vale tentar de novo depois.
    return { ok: false, error: `rede: ${String(err)}`, fatal: false };
  }

  if (res.ok) return { ok: true };

  const text = await res.text();
  let code = 0;
  let subcode = 0;
  let message = text;
  try {
    const parsed = JSON.parse(text);
    code = parsed?.error?.code ?? 0;
    subcode = parsed?.error?.error_subcode ?? 0;
    message = parsed?.error?.message ?? text;
  } catch {
    // resposta não-JSON: fica com o texto cru
  }

  return {
    ok: false,
    error: `${res.status} ${message}`.slice(0, 500),
    fatal: isFatal(code, subcode, message) || (res.status >= 400 && res.status < 500 && res.status !== 429),
  };
}

/** Resposta pública, no próprio comentário. */
export function replyToComment(commentId: string, text: string, token: string) {
  return call(`${GRAPH}/${commentId}/replies?access_token=${encodeURIComponent(token)}`, {
    message: text,
  });
}

type Recipient = { id: string } | { comment_id: string };

function messagePayload(
  text: string,
  quickReply?: string | null,
  link?: { label: string; url: string } | null,
) {
  if (link) {
    // Botão que abre URL: no Instagram isso é o template genérico.
    return {
      attachment: {
        type: "template",
        payload: {
          template_type: "generic",
          elements: [
            {
              title: text.slice(0, 80),
              subtitle: text.length > 80 ? text.slice(80, 160) : undefined,
              buttons: [{ type: "web_url", url: link.url, title: link.label.slice(0, 20) }],
            },
          ],
        },
      },
    };
  }

  if (quickReply?.trim()) {
    return {
      text,
      quick_replies: [
        {
          content_type: "text",
          title: quickReply.slice(0, 20),
          payload: "IG_AUTO_START",
        },
      ],
    };
  }

  return { text };
}

/**
 * Envia mensagem no direct.
 *
 * `recipient.comment_id` é a resposta privada de comentário — a única forma
 * de iniciar conversa sem janela aberta. `recipient.id` é a DM normal, que
 * exige janela.
 */
export function sendMessage(
  recipient: Recipient,
  token: string,
  text: string,
  opts?: { quickReply?: string | null; link?: { label: string; url: string } | null },
) {
  return call(`${GRAPH}/me/messages?access_token=${encodeURIComponent(token)}`, {
    recipient,
    message: messagePayload(text, opts?.quickReply, opts?.link),
  });
}

/** Renova o token de 60 dias. Só funciona em token com mais de 24h de vida. */
export async function refreshToken(token: string) {
  const res = await fetch(
    `${GRAPH.replace("/v23.0", "")}/refresh_access_token?${new URLSearchParams({
      grant_type: "ig_refresh_token",
      access_token: token,
    })}`,
  );
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.access_token) {
    return { ok: false as const, error: JSON.stringify(body).slice(0, 300) };
  }
  return {
    ok: true as const,
    token: body.access_token as string,
    expiresIn: Number(body.expires_in ?? 60 * 24 * 3600),
  };
}
