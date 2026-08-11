import { NextResponse } from "next/server";
import { GRAPH, account, inspectToken } from "@/lib/ig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Campos válidos ao assinar pelo ID da Página (família Messenger). */
const CAMPOS_PAGINA = [
  "messages",
  "messaging_postbacks",
  "messaging_optins",
  "message_reactions",
  "messaging_referrals",
  "feed",
];

/** Campos válidos ao assinar pelo ID da conta do Instagram. */
const CAMPOS_INSTAGRAM = [
  "comments",
  "messages",
  "message_reactions",
  "live_comments",
  "mentions",
];

async function chamar(alvo: string, token: string, campos: string[]) {
  const res = await fetch(
    `${GRAPH}/${alvo}/subscribed_apps?${new URLSearchParams({
      subscribed_fields: campos.join(","),
      access_token: token,
    })}`,
    { method: "POST" },
  );
  const body = await res.json().catch(() => null);
  return { ok: res.ok, erro: body?.error?.message as string | undefined };
}

/**
 * Assina um alvo, tolerando campo inválido.
 *
 * A Meta recusa o lote inteiro se um único nome não for aceito, e a lista
 * válida muda conforme o app. Tentamos em bloco e, na recusa, um a um.
 */
async function assinar(alvo: string, token: string, candidatos: string[]) {
  const aceitos: string[] = [];
  const recusados: { campo: string; motivo: string }[] = [];

  const lote = await chamar(alvo, token, candidatos);
  if (lote.ok) return { aceitos: candidatos, recusados };

  for (const campo of candidatos) {
    const r = await chamar(alvo, token, [campo]);
    if (r.ok) aceitos.push(campo);
    else recusados.push({ campo, motivo: r.erro ?? "recusado" });
  }
  return { aceitos, recusados };
}

/**
 * Inscreve no app para receber webhooks.
 *
 * Há dois endereços possíveis e qual funciona depende de como o app foi
 * configurado na Meta: pelo ID da Página (exige pages_manage_metadata) ou
 * pelo ID da conta do Instagram (exige instagram_manage_messages). Tentamos
 * os dois em vez de exigir que o usuário descubra qual é o caso dele.
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

  const viaPagina = await assinar(me.id, conta.token, CAMPOS_PAGINA);
  const viaInstagram = await assinar(conta.igUserId, conta.token, CAMPOS_INSTAGRAM);

  const info = await inspectToken(conta.token);
  const escopos = info.ok ? info.escopos : [];

  // Confere o que ficou de fato nos dois alvos.
  const confs = await Promise.all(
    [me.id, conta.igUserId].map(async (alvo) => {
      const r = await fetch(
        `${GRAPH}/${alvo}/subscribed_apps?access_token=${encodeURIComponent(conta.token)}`,
      );
      const b = await r.json().catch(() => null);
      return { alvo, assinado: b?.data ?? b?.error?.message ?? null };
    }),
  );

  const total = viaPagina.aceitos.length + viaInstagram.aceitos.length;

  return NextResponse.json(
    {
      ok: total > 0,
      pagina: { id: me.id, nome: me.name },
      instagram_id: conta.igUserId,
      via_pagina: viaPagina,
      via_instagram: viaInstagram,
      escopos,
      confirmado: confs,
      ...(total === 0
        ? {
            dica:
              "Nenhum dos dois endereços aceitou. Me mande este retorno inteiro: " +
              "os motivos de recusa dizem qual permissão a Meta está exigindo.",
          }
        : {}),
    },
    { status: total > 0 ? 200 : 502 },
  );
}
