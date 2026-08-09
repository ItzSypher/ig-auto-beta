import { NextResponse } from "next/server";
import { appOrigin } from "@/lib/meta";
import { db } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REDIRECT_PATH = "/api/auth/instagram/callback";

function fail(message: string, status = 400) {
  return new NextResponse(
    `<!doctype html><meta charset="utf-8"><body style="font-family:system-ui;padding:40px;max-width:640px">
     <h1 style="font-size:20px">Não deu certo</h1>
     <p style="color:#444;line-height:1.6">${message}</p>
     <p><a href="/">Voltar</a></p></body>`,
    { status, headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

/**
 * Alvo do "URI de redirecionamento do OAuth" configurado na Meta.
 *
 * Recebe o `code` do login do Instagram, troca por um token de curta duração,
 * troca de novo por um de 60 dias, e grava tudo na tabela config. É o caminho
 * alternativo para obter o token quando o botão "Adicionar conta" do painel
 * da Meta falha.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);

  const metaError = url.searchParams.get("error_description") ?? url.searchParams.get("error");
  if (metaError) return fail(`A Meta recusou a autorização: ${metaError}`);

  const code = url.searchParams.get("code");
  if (!code) return fail("A Meta não devolveu o código de autorização.");

  const appId = process.env.IG_APP_ID;
  const appSecret = process.env.IG_APP_SECRET;
  if (!appId || !appSecret) {
    return fail("IG_APP_ID ou IG_APP_SECRET não estão configuradas na Vercel.", 500);
  }

  const redirectUri = `${appOrigin()}${REDIRECT_PATH}`;

  // 1. code -> token de curta duração
  const shortRes = await fetch("https://api.instagram.com/oauth/access_token", {
    method: "POST",
    body: new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      code,
    }),
  });
  const shortBody = await shortRes.json().catch(() => null);
  if (!shortRes.ok || !shortBody?.access_token) {
    return fail(
      `Falha ao trocar o código pelo token: ${JSON.stringify(shortBody)}`,
      502,
    );
  }

  // 2. curta -> longa duração (60 dias)
  const longRes = await fetch(
    `https://graph.instagram.com/access_token?${new URLSearchParams({
      grant_type: "ig_exchange_token",
      client_secret: appSecret,
      access_token: shortBody.access_token,
    })}`,
  );
  const longBody = await longRes.json().catch(() => null);
  if (!longRes.ok || !longBody?.access_token) {
    return fail(
      `Falha ao gerar o token de longa duração: ${JSON.stringify(longBody)}`,
      502,
    );
  }

  const token: string = longBody.access_token;
  const expiresAt = new Date(
    Date.now() + Number(longBody.expires_in ?? 60 * 24 * 3600) * 1000,
  ).toISOString();

  // 3. dados do perfil
  const meRes = await fetch(
    `https://graph.instagram.com/v23.0/me?${new URLSearchParams({
      fields: "user_id,username,profile_picture_url",
      access_token: token,
    })}`,
  );
  const me = await meRes.json().catch(() => ({}));

  // 4. grava na única linha de config
  const row = {
    ig_access_token: token,
    ig_user_id: String(me.user_id ?? shortBody.user_id ?? ""),
    ig_username: me.username ?? null,
    ig_profile_picture_url: me.profile_picture_url ?? null,
    token_expires_at: expiresAt,
    token_refreshed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  try {
    const supabase = db();
    const { data: existing } = await supabase.from("config").select("id").limit(1);

    const { error } = existing?.length
      ? await supabase.from("config").update(row).eq("id", existing[0].id)
      : await supabase.from("config").insert(row);

    if (error) throw error;
  } catch (err) {
    console.error("falha ao gravar config", err);
    return fail("O token foi gerado, mas não consegui gravar no banco.", 500);
  }

  return new NextResponse(
    `<!doctype html><meta charset="utf-8"><body style="font-family:system-ui;padding:40px;max-width:640px">
     <h1 style="font-size:20px">Conta conectada</h1>
     <p style="color:#444;line-height:1.6">
       <strong>@${row.ig_username ?? "conta"}</strong> autorizada. O token de 60 dias
       ficou salvo no banco e vai ser renovado sozinho toda semana.
     </p>
     <p><a href="/">Ir para o painel</a></p></body>`,
    { headers: { "content-type": "text/html; charset=utf-8" } },
  );
}
