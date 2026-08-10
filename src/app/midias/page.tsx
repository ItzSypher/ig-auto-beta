import Link from "next/link";
import { GRAPH, account } from "@/lib/ig";

export const dynamic = "force-dynamic";
export const metadata = { title: "Suas mídias — IG Auto" };

type Midia = {
  id: string;
  caption?: string;
  media_type?: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  timestamp?: string;
};

async function buscar(): Promise<{ midias: Midia[]; erro?: string }> {
  const conta = await account();
  if (!conta) return { midias: [], erro: "Nenhuma conta conectada." };

  try {
    const res = await fetch(
      `${GRAPH}/${conta.igUserId}/media?${new URLSearchParams({
        fields: "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp",
        limit: "24",
        access_token: conta.token,
      })}`,
      { cache: "no-store" },
    );
    const body = await res.json();
    if (!res.ok) return { midias: [], erro: body?.error?.message ?? "falha na Meta" };
    return { midias: (body.data ?? []) as Midia[] };
  } catch (err) {
    return { midias: [], erro: String(err) };
  }
}

export default async function MidiasPage() {
  const { midias, erro } = await buscar();

  return (
    <div className="mx-auto max-w-4xl px-6 py-14">
      <Link href="/builder" className="text-[13px] text-neutral-500 underline">
        ← Voltar ao builder
      </Link>
      <h1 className="mt-5 text-2xl font-semibold tracking-tight text-neutral-900">
        Suas publicações
      </h1>
      <p className="mt-1.5 text-[15px] text-neutral-600">
        O código embaixo de cada uma é o ID da mídia. Cole no campo &quot;Post
        específico&quot; do gatilho para a automação valer só naquele post.
      </p>

      {erro && (
        <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[14px] text-rose-900">
          {erro}
        </div>
      )}

      {!erro && midias.length === 0 && (
        <p className="mt-6 text-[14px] text-neutral-500">
          Nenhuma publicação encontrada nesta conta.
        </p>
      )}

      <ul className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {midias.map((m) => (
          <li key={m.id} className="overflow-hidden rounded-xl border border-neutral-200">
            {/* Miniatura vem da CDN da Meta; next/image exigiria configurar o
                domínio remoto e isso não paga o custo aqui. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={m.thumbnail_url ?? m.media_url ?? ""}
              alt={m.caption?.slice(0, 60) ?? "Publicação"}
              className="aspect-square w-full bg-neutral-100 object-cover"
            />
            <div className="space-y-1 p-2.5">
              <p className="line-clamp-2 text-[12px] leading-snug text-neutral-700">
                {m.caption?.slice(0, 80) ?? <span className="italic">sem legenda</span>}
              </p>
              <code className="block select-all break-all rounded bg-neutral-100 px-1.5 py-1 text-[11px] text-neutral-800">
                {m.id}
              </code>
              {m.permalink && (
                <a
                  href={m.permalink}
                  target="_blank"
                  rel="noreferrer"
                  className="block text-[11px] text-neutral-500 underline"
                >
                  ver no Instagram
                </a>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
