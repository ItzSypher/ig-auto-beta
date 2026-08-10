import { NextResponse } from "next/server";
import { GRAPH, account } from "@/lib/ig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Campos que o motor consome. */
const CAMPOS = ["messages", "messaging_postbacks", "messaging_referral", "comments"];

/**
 * Assina a Página no app.
 *
 * Pelo caminho do login do Facebook não basta configurar o webhook no painel:
 * cada Página precisa ser inscrita no app, senão a Meta aceita o endereço e
 * simplesmente nunca manda evento nenhum.
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  const { chave } = await req.json().catch(() => ({ chave: undefined }));
  if (!secret || chave !== secret) {
    return NextResponse.json({ erro: "Chave incorreta." }, { status: 401 });
  }

  const conta = await account();
  if (!conta) {
    return NextResponse.json({ erro: "Nenhuma conta conectada." }, { status: 400 });
  }

  // Com um token de Página, /me é a própria Página.
  const meRes = await fetch(
    `${GRAPH}/me?fields=id,name&access_token=${encodeURIComponent(conta.token)}`,
  );
  const me = await meRes.json().catch(() => null);
  if (!meRes.ok || !me?.id) {
    return NextResponse.json(
      { erro: `Não identifiquei a Página: ${me?.error?.message ?? "resposta inesperada"}` },
      { status: 502 },
    );
  }

  const subRes = await fetch(
    `${GRAPH}/${me.id}/subscribed_apps?${new URLSearchParams({
      subscribed_fields: CAMPOS.join(","),
      access_token: conta.token,
    })}`,
    { method: "POST" },
  );
  const sub = await subRes.json().catch(() => null);
  if (!subRes.ok) {
    return NextResponse.json(
      {
        erro: `Falha ao assinar: ${sub?.error?.message ?? "resposta inesperada"}`,
        dica: "Costuma ser falta da permissão pages_manage_metadata no token.",
      },
      { status: 502 },
    );
  }

  // Confere o que ficou realmente assinado, em vez de confiar no "success".
  const conf = await fetch(
    `${GRAPH}/${me.id}/subscribed_apps?access_token=${encodeURIComponent(conta.token)}`,
  );
  const confirmado = await conf.json().catch(() => null);

  return NextResponse.json({
    ok: true,
    pagina: { id: me.id, nome: me.name },
    assinado: confirmado?.data ?? sub,
  });
}
