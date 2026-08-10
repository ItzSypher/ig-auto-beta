import { NextResponse } from "next/server";
import { refreshToken } from "@/lib/ig";
import { db } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Renova o token de 60 dias.
 *
 * Roda toda semana pelo pg_cron. Renovar semanalmente dá margem de sobra:
 * mesmo que falhe algumas vezes seguidas, ainda há semanas até vencer.
 * A Meta só aceita renovar token com mais de 24h de vida.
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }

  const { data } = await db()
    .from("config")
    .select("ig_access_token, token_expires_at")
    .eq("id", 1)
    .maybeSingle();

  const atual = data?.ig_access_token as string | undefined;
  if (!atual) {
    return NextResponse.json({ error: "nenhum token no banco" }, { status: 400 });
  }

  const result = await refreshToken(atual);
  if (!result.ok) {
    console.error("falha ao renovar token", result.error);
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  const expiraEm = new Date(Date.now() + result.expiresIn * 1000).toISOString();
  const { error } = await db()
    .from("config")
    .update({
      ig_access_token: result.token,
      token_expires_at: expiraEm,
      token_refreshed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, expira_em: expiraEm });
}

export async function GET(req: Request) {
  return POST(req);
}
