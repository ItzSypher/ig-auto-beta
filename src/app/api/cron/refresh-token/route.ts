import { NextResponse } from "next/server";
import { account, inspectToken } from "@/lib/ig";
import { db } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Vigia o token.
 *
 * No caminho do login do Facebook o token é de Página, derivado de um token
 * de usuário de longa duração — ele não expira, então não há o que renovar.
 * O que ainda faz sentido é conferir semanalmente se continua válido: token
 * revogado, senha trocada ou app removido derrubam tudo em silêncio, e é
 * melhor descobrir por aqui do que por uma automação que parou de responder.
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }

  const conta = await account();
  if (!conta) {
    return NextResponse.json({ error: "nenhuma conta conectada" }, { status: 400 });
  }

  const info = await inspectToken(conta.token);
  if (!info.ok) {
    console.error("falha ao inspecionar token", info.error);
    return NextResponse.json({ error: info.error }, { status: 502 });
  }

  if (!info.valido) {
    console.error("TOKEN INVÁLIDO: reconecte em /conectar");
  }

  await db()
    .from("config")
    .update({
      token_expires_at: info.expiraEm,
      token_refreshed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);

  return NextResponse.json({
    valido: info.valido,
    expira_em: info.expiraEm ?? "não expira",
    escopos: info.escopos,
  });
}

export async function GET(req: Request) {
  return POST(req);
}
