import { NextResponse } from "next/server";
import { GRAPH, account } from "@/lib/ig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Campos que interessam ao motor.
 *
 * A lista aceita varia conforme o app e o tipo da Página, e a Meta recusa o
 * lote inteiro se um único nome for inválido. Por isso tentamos em bloco e,
 * na recusa, um a um — melhor assinar cinco de seis do que nenhum.
 */
const CANDIDATOS = [
  "messages",
  "messaging_postbacks",
  "messaging_optins",
  "message_reactions",
  "messaging_referrals",
  "comments",
  "feed",
];

async function assinar(pageId: string, token: string, campos: string[]) {
  const res = await fetch(
    `${GRAPH}/${pageId}/subscribed_apps?${new URLSearchParams({
      subscribed_fields: campos.join(","),
      access_token: token,
    })}`,
    { method: "POST" },
  );
  const body = await res.json().catch(() => null);
  return { ok: res.ok, erro: body?.error?.message as string | undefined };
}

/**
 * Inscreve a Página no app.
 *
 * Pelo caminho do login do Facebook não basta configurar o webhook no painel:
 * sem a Página inscrita, a Meta aceita o endereço e nunca envia evento.
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

  // Com token de Página, /me é a própria Página.
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

  const aceitos: string[] = [];
  const recusados: { campo: string; motivo: string }[] = [];

  const lote = await assinar(me.id, conta.token, CANDIDATOS);
  if (lote.ok) {
    aceitos.push(...CANDIDATOS);
  } else {
    for (const campo of CANDIDATOS) {
      const r = await assinar(me.id, conta.token, [campo]);
      if (r.ok) aceitos.push(campo);
      else recusados.push({ campo, motivo: r.erro ?? "recusado" });
    }
  }

  // Confere o que ficou de fato, em vez de confiar no "success".
  const conf = await fetch(
    `${GRAPH}/${me.id}/subscribed_apps?access_token=${encodeURIComponent(conta.token)}`,
  );
  const confirmado = await conf.json().catch(() => null);

  const nenhum = aceitos.length === 0;
  return NextResponse.json(
    {
      ok: !nenhum,
      pagina: { id: me.id, nome: me.name },
      aceitos,
      recusados,
      confirmado: confirmado?.data ?? confirmado,
      ...(nenhum
        ? {
            dica:
              "Nenhum campo entrou. Normalmente é falta da permissão " +
              "pages_manage_metadata no token. Se ela não aparece no Graph API " +
              "Explorer, use o interruptor 'Assinatura do webhook' no passo 2 do " +
              "painel da API do Instagram — ele faz a mesma coisa pela interface.",
          }
        : {}),
    },
    { status: nenhum ? 502 : 200 },
  );
}
