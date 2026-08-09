import { NextResponse } from "next/server";
import { parseSignedRequest } from "@/lib/meta";
import { db, deleteUserData } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Callback de cancelamento de autorização.
 *
 * A Meta chama isto quando alguém remove o app. Ela manda um form urlencoded
 * com o campo signed_request. Apagamos os dados da pessoa na hora: se ela
 * revogou o acesso, não temos base para continuar guardando nada.
 */
export async function POST(req: Request) {
  const appSecret = process.env.IG_APP_SECRET;
  if (!appSecret) {
    return NextResponse.json({ error: "app secret ausente" }, { status: 500 });
  }

  const form = await req.formData();
  const signed = form.get("signed_request");
  if (typeof signed !== "string") {
    return NextResponse.json({ error: "signed_request ausente" }, { status: 400 });
  }

  const payload = parseSignedRequest(signed, appSecret);
  if (!payload) {
    // Assinatura inválida: não veio da Meta.
    return NextResponse.json({ error: "assinatura inválida" }, { status: 401 });
  }

  const igUserId = String(payload.user_id ?? "");
  if (!igUserId) {
    return NextResponse.json({ error: "user_id ausente" }, { status: 400 });
  }

  try {
    await db().from("events").insert({
      kind: "deauthorize",
      ig_user_id: igUserId,
      payload,
      signature_ok: true,
      note: "app removido pela pessoa; dados apagados",
    });
    await deleteUserData(igUserId);
  } catch (err) {
    console.error("falha ao processar deauthorize", err);
    return NextResponse.json({ error: "falha interna" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
