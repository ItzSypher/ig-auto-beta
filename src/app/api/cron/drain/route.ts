import { NextResponse } from "next/server";
import { drain } from "@/lib/worker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

/**
 * Chamado a cada minuto pelo pg_cron do Supabase, porque a Vercel no plano
 * Hobby não roda cron de minuto.
 */
export async function POST(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  try {
    return NextResponse.json(await drain());
  } catch (err) {
    console.error("falha ao drenar a fila", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

/** Mesma coisa via GET, para dar para testar do navegador com o segredo. */
export async function GET(req: Request) {
  return POST(req);
}
