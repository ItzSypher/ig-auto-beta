import { db } from "@/lib/supabase";

/**
 * Caminho "Instagram API com login do Facebook".
 *
 * Trocamos o login do Instagram por este porque a página de autorização do
 * Instagram responde HTTP 500 (falha do lado da Meta). Aqui o token é um
 * token de Página, que não expira enquanto derivado de um token de usuário
 * de longa duração.
 */
export const GRAPH = "https://graph.facebook.com/v23.0";

export type SendResult = { ok: true } | { ok: false; error: string; fatal: boolean };

export type Account = {
  /** Token da Página do Facebook. */
  token: string;
  /** ID da conta profissional do Instagram vinculada à Página. */
  igUserId: string;
};

/** Credenciais gravadas pelo /conectar. */
export async function account(): Promise<Account | null> {
  try {
    const { data } = await db()
      .from("config")
      .select("ig_access_token, ig_user_id")
      .eq("id", 1)
      .maybeSingle();

    if (data?.ig_access_token && data?.ig_user_id) {
      return { token: data.ig_access_token as string, igUserId: data.ig_user_id as string };
    }
  } catch {
    // banco fora do ar
  }

  const token = process.env.IG_ACCESS_TOKEN;
  const igUserId = process.env.IG_USER_ID;
  return token && igUserId ? { token, igUserId } : null;
}

/**
 * Erros que não adianta repetir: comentário apagado, janela fechada,
 * token revogado. Insistir só queima cota.
 */
function isFatal(code: number, subcode: number, message: string): boolean {
  if (code === 190) return true; // token inválido ou expirado
  if (code === 10 || code === 200 || code === 803) return true; // permissão
  if (subcode === 2534037) return true; // fora da janela de mensagens
  if (code === 100 && /does not exist|Unsupported|Invalid parameter/i.test(message)) {
    return true;
  }
  return false;
}

async function post(url: string, body: unknown): Promise<SendResult> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
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
    // resposta não-JSON
  }

  const clientError = res.status >= 400 && res.status < 500 && res.status !== 429;
  return {
    ok: false,
    error: `${res.status} ${message}`.slice(0, 500),
    fatal: isFatal(code, subcode, message) || clientError,
  };
}

/** Resposta pública, no próprio comentário. */
export function replyToComment(commentId: string, text: string, token: string) {
  return post(`${GRAPH}/${commentId}/replies?access_token=${encodeURIComponent(token)}`, {
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
        { content_type: "text", title: quickReply.slice(0, 20), payload: "IG_AUTO_START" },
      ],
    };
  }

  return { text };
}

/**
 * Envia no direct.
 *
 * `recipient.comment_id` é a resposta privada de comentário — a única forma
 * de iniciar conversa sem janela aberta. `recipient.id` é a DM comum.
 */
export function sendMessage(
  igUserId: string,
  recipient: Recipient,
  token: string,
  text: string,
  opts?: { quickReply?: string | null; link?: { label: string; url: string } | null },
) {
  return post(`${GRAPH}/${igUserId}/messages?access_token=${encodeURIComponent(token)}`, {
    recipient,
    message: messagePayload(text, opts?.quickReply, opts?.link),
  });
}

/**
 * Confere validade do token.
 *
 * Token de Página derivado de token de usuário de longa duração não expira
 * (`expires_at` volta 0), então isto é diagnóstico, não renovação.
 */
export async function inspectToken(token: string) {
  const appId = process.env.FB_APP_ID;
  const appSecret = process.env.FB_APP_SECRET;
  if (!appId || !appSecret) return { ok: false as const, error: "FB_APP_ID/SECRET ausentes" };

  const res = await fetch(
    `${GRAPH}/debug_token?${new URLSearchParams({
      input_token: token,
      access_token: `${appId}|${appSecret}`,
    })}`,
  );
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.data) {
    return { ok: false as const, error: JSON.stringify(body).slice(0, 300) };
  }

  const expiresAt = Number(body.data.expires_at ?? 0);
  return {
    ok: true as const,
    valido: Boolean(body.data.is_valid),
    // 0 significa "não expira"
    expiraEm: expiresAt ? new Date(expiresAt * 1000).toISOString() : null,
    escopos: (body.data.scopes ?? []) as string[],
  };
}
