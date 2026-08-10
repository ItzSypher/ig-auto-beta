import { NextResponse } from "next/server";
import { GRAPH } from "@/lib/ig";
import { db } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Pagina = {
  id: string;
  name: string;
  access_token: string;
  instagram_business_account?: {
    id: string;
    username?: string;
    profile_picture_url?: string;
  };
};

/**
 * Converte um token curto do Graph API Explorer em credenciais utilizáveis.
 *
 * Faz a cadeia que normalmente é manual:
 *   1. token curto de usuário -> token longo de usuário (60 dias)
 *   2. token longo -> lista de Páginas, cada uma com seu próprio token
 *   3. da Página escolhida, extrai a conta profissional do Instagram
 *
 * O token de Página derivado de um token longo de usuário não expira, então
 * depois disto não há renovação a fazer.
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  const appId = process.env.FB_APP_ID;
  const appSecret = process.env.FB_APP_SECRET;

  if (!secret || !appId || !appSecret) {
    return NextResponse.json(
      { erro: "Faltam CRON_SECRET, FB_APP_ID ou FB_APP_SECRET na Vercel." },
      { status: 500 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const { chave, token, page_id } = body as {
    chave?: string;
    token?: string;
    page_id?: string;
  };

  // Impede que qualquer pessoa que ache a URL sobrescreva as credenciais.
  if (chave !== secret) {
    return NextResponse.json({ erro: "Chave incorreta." }, { status: 401 });
  }
  if (!token?.trim()) {
    return NextResponse.json({ erro: "Cole o token do Graph API Explorer." }, { status: 400 });
  }

  // 1. curto -> longo
  const trocaRes = await fetch(
    `${GRAPH}/oauth/access_token?${new URLSearchParams({
      grant_type: "fb_exchange_token",
      client_id: appId,
      client_secret: appSecret,
      fb_exchange_token: token.trim(),
    })}`,
  );
  const troca = await trocaRes.json().catch(() => null);
  if (!trocaRes.ok || !troca?.access_token) {
    return NextResponse.json(
      { erro: `Falha ao alongar o token: ${troca?.error?.message ?? "resposta inesperada"}` },
      { status: 502 },
    );
  }

  // 2. Páginas do usuário, cada uma com o token dela
  const pagesRes = await fetch(
    `${GRAPH}/me/accounts?${new URLSearchParams({
      fields: "id,name,access_token,instagram_business_account{id,username,profile_picture_url}",
      access_token: troca.access_token,
    })}`,
  );
  const pages = await pagesRes.json().catch(() => null);
  if (!pagesRes.ok) {
    return NextResponse.json(
      { erro: `Falha ao listar Páginas: ${pages?.error?.message ?? "resposta inesperada"}` },
      { status: 502 },
    );
  }

  const lista = (pages?.data ?? []) as Pagina[];
  if (lista.length === 0) {
    // Lista vazia tem três causas comuns e o usuário não consegue distinguir
    // entre elas sozinho: não existe Página; existe mas está em outro perfil
    // do Facebook; ou existe e o usuário não a marcou na tela de autorização.
    // Dizer de quem é o token elimina a segunda de imediato.
    const euRes = await fetch(
      `${GRAPH}/me?${new URLSearchParams({
        fields: "id,name",
        access_token: troca.access_token,
      })}`,
    );
    const eu = await euRes.json().catch(() => null);
    const quem = eu?.name ? `${eu.name} (id ${eu.id})` : "desconhecido";

    return NextResponse.json(
      {
        erro:
          `O token pertence ao perfil do Facebook: ${quem}. ` +
          "Nenhuma Página apareceu para ele. Ou a Página não existe, ou foi " +
          "criada em outro perfil, ou você não marcou a Página na tela de " +
          "autorização ao gerar o token.",
      },
      { status: 400 },
    );
  }

  const comInstagram = lista.filter((p) => p.instagram_business_account?.id);
  if (comInstagram.length === 0) {
    return NextResponse.json(
      {
        erro: "Nenhuma das suas Páginas tem conta do Instagram vinculada.",
        paginas: lista.map((p) => ({ id: p.id, nome: p.name })),
      },
      { status: 400 },
    );
  }

  const escolhida = page_id
    ? comInstagram.find((p) => p.id === page_id)
    : comInstagram[0];

  if (!escolhida) {
    return NextResponse.json(
      {
        erro: "page_id não encontrado entre as Páginas com Instagram.",
        paginas: comInstagram.map((p) => ({
          id: p.id,
          nome: p.name,
          instagram: p.instagram_business_account?.username,
        })),
      },
      { status: 400 },
    );
  }

  // Mais de uma opção e nenhuma escolhida: devolve a lista em vez de chutar.
  if (!page_id && comInstagram.length > 1) {
    return NextResponse.json(
      {
        erro: "Você tem mais de uma Página com Instagram. Escolha uma e reenvie com o page_id.",
        paginas: comInstagram.map((p) => ({
          id: p.id,
          nome: p.name,
          instagram: p.instagram_business_account?.username,
        })),
      },
      { status: 409 },
    );
  }

  const ig = escolhida.instagram_business_account!;

  const { error } = await db()
    .from("config")
    .upsert(
      {
        id: 1,
        ig_access_token: escolhida.access_token,
        ig_user_id: ig.id,
        ig_username: ig.username ?? null,
        ig_profile_picture_url: ig.profile_picture_url ?? null,
        // Token de Página não expira; não há data para guardar.
        token_expires_at: null,
        token_refreshed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );

  if (error) {
    return NextResponse.json({ erro: `Falha ao gravar: ${error.message}` }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    pagina: escolhida.name,
    instagram: ig.username ?? ig.id,
    ig_user_id: ig.id,
  });
}
