import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { appOrigin, parseSignedRequest } from "@/lib/meta";
import { db, deleteUserData } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Callback de solicitação de exclusão de dados.
 *
 * A Meta exige que este endpoint responda um JSON com `url` (onde a pessoa
 * acompanha o pedido) e `confirmation_code`. Como o volume de dados por
 * pessoa é pequeno, apagamos na hora e o código serve de comprovante.
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
    return NextResponse.json({ error: "assinatura inválida" }, { status: 401 });
  }

  const igUserId = String(payload.user_id ?? "");
  if (!igUserId) {
    return NextResponse.json({ error: "user_id ausente" }, { status: 400 });
  }

  const confirmationCode = crypto.randomBytes(8).toString("hex");

  try {
    await deleteUserData(igUserId);
    // Gravado DEPOIS da exclusão: deleteUserData limpa os eventos da pessoa,
    // e este registro precisa sobreviver como comprovante do pedido.
    await db().from("events").insert({
      kind: "data_deletion",
      ig_user_id: igUserId,
      payload: { confirmation_code: confirmationCode },
      signature_ok: true,
      note: "exclusão concluída via callback da Meta",
    });
  } catch (err) {
    console.error("falha ao apagar dados", err);
    return NextResponse.json({ error: "falha interna" }, { status: 500 });
  }

  return NextResponse.json({
    url: `${appOrigin()}/exclusao-de-dados/status?codigo=${confirmationCode}`,
    confirmation_code: confirmationCode,
  });
}
