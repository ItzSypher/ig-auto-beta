import { NextResponse } from "next/server";
import { GRAPH } from "@/lib/ig";
import { db } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Pagina = {
  id: string;
  name: string;
  access_token?: string;
  instagram_business_account?: {
    id: string;
    username?: string;
    profile_picture_url?: string;
  };
};

const CAMPOS =
  "id,name,access_token,instagram_business_account{id,username,profile_picture_url}";

async function graphGet(caminho: string, token?: string) {
  // A troca do token curto se autentica por client_id/client_secret na própria
  // query; mandar access_token vazio ali faz a Meta recusar.
  const sufixo = token ? `${caminho.includes("?") ? "&" : "?"}access_token=${encodeURIComponent(token)}` : "";
  const res = await fetch(`${GRAPH}${caminho}${sufixo}`);
  const body = await res.json().catch(() => null);
  return { ok: res.ok, body };
}

/**
 * Acha as Páginas do usuário.
 *
 * `/me/accounts` só devolve Páginas em que o perfil tem papel direto. Página
 * que pertence a um Portfólio empresarial não aparece ali — é preciso passar
 * pelo negócio, o que exige a permissão business_management.
 */
async function listarPaginas(token: string) {
  const encontradas = new Map<string, Pagina>();
  const negociosVistos: { id: string; nome: string }[] = [];

  const diretas = await graphGet(`/me/accounts?fields=${CAMPOS}`, token);
  for (const p of (diretas.body?.data ?? []) as Pagina[]) {
    encontradas.set(p.id, p);
  }

  // Mesmo achando Páginas diretas, varremos os portfólios: a Página que
  // interessa pode estar só lá.
  const negocios = await graphGet("/me/businesses?fields=id,name", token);
  for (const n of (negocios.body?.data ?? []) as { id: string; name: string }[]) {
    negociosVistos.push({ id: n.id, nome: n.name });

    for (const aresta of ["owned_pages", "client_pages"]) {
      const r = await graphGet(`/${n.id}/${aresta}?fields=${CAMPOS}`, token);
      for (const p of (r.body?.data ?? []) as Pagina[]) {
        if (!encontradas.has(p.id)) encontradas.set(p.id, p);
      }
    }
  }

  // Página vinda pelo negócio às vezes não traz o token junto; buscamos avulso.
  for (const p of encontradas.values()) {
    if (p.access_token) continue;
    const r = await graphGet(`/${p.id}?fields=access_token`, token);
    if (r.body?.access_token) p.access_token = r.body.access_token as string;
  }

  return { paginas: [...encontradas.values()], negocios: negociosVistos };
}

/**
 * Converte um token curto do Graph API Explorer em credenciais utilizáveis:
 * alonga o token, acha a Página com Instagram vinculado, e guarda o token
 * dela. Token de Página derivado de token longo de usuário não expira.
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

  // curto -> longo
  const troca = await graphGet(
    `/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}` +
      `&client_secret=${appSecret}&fb_exchange_token=${encodeURIComponent(token.trim())}`,
  ).catch(() => null);

  const tokenLongo = troca?.body?.access_token as string | undefined;
  if (!tokenLongo) {
    return NextResponse.json(
      {
        erro: `Falha ao alongar o token: ${troca?.body?.error?.message ?? "resposta inesperada"}`,
      },
      { status: 502 },
    );
  }

  const { paginas, negocios } = await listarPaginas(tokenLongo);

  if (paginas.length === 0) {
    const eu = await graphGet("/me?fields=id,name", tokenLongo);
    const quem = eu.body?.name ? `${eu.body.name} (id ${eu.body.id})` : "desconhecido";
    return NextResponse.json(
      {
        erro:
          `Token do perfil: ${quem}. Nenhuma Página encontrada, nem direta nem ` +
          `em portfólio empresarial. Portfólios vistos: ${
            negocios.length ? negocios.map((n) => n.nome).join(", ") : "nenhum"
          }. Confira se a permissão business_management foi concedida.`,
      },
      { status: 400 },
    );
  }

  const comInstagram = paginas.filter(
    (p) => p.instagram_business_account?.id && p.access_token,
  );

  if (comInstagram.length === 0) {
    return NextResponse.json(
      {
        erro:
          "Achei Páginas, mas nenhuma com Instagram vinculado E token acessível. " +
          "Se a Página certa está na lista, verifique se você é administrador dela.",
        paginas: paginas.map((p) => ({
          id: p.id,
          nome: p.name,
          instagram: p.instagram_business_account?.username ?? "sem Instagram",
        })),
      },
      { status: 400 },
    );
  }

  if (!page_id && comInstagram.length > 1) {
    return NextResponse.json(
      {
        erro: "Mais de uma Página elegível. Escolha uma e reenvie com o ID.",
        paginas: comInstagram.map((p) => ({
          id: p.id,
          nome: p.name,
          instagram: p.instagram_business_account?.username,
        })),
      },
      { status: 409 },
    );
  }

  const escolhida = page_id ? comInstagram.find((p) => p.id === page_id) : comInstagram[0];
  if (!escolhida) {
    return NextResponse.json(
      {
        erro: "O ID informado não está entre as Páginas elegíveis.",
        paginas: comInstagram.map((p) => ({
          id: p.id,
          nome: p.name,
          instagram: p.instagram_business_account?.username,
        })),
      },
      { status: 400 },
    );
  }

  const ig = escolhida.instagram_business_account!;

  const { error } = await db()
    .from("config")
    .upsert(
      {
        id: 1,
        ig_access_token: escolhida.access_token!,
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
