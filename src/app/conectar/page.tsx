"use client";

import Link from "next/link";
import { useState } from "react";

const inputCls =
  "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-[14px] text-neutral-900 outline-none focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10";

type Resposta = {
  ok?: boolean;
  erro?: string;
  pagina?: string;
  instagram?: string;
  paginas?: { id: string; nome: string; instagram?: string }[];
};

export default function ConectarPage() {
  const [token, setToken] = useState("");
  const [chave, setChave] = useState("");
  const [pageId, setPageId] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [res, setRes] = useState<Resposta | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setCarregando(true);
    setRes(null);
    try {
      const r = await fetch("/api/auth/facebook/setup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token: token.trim(),
          chave: chave.trim(),
          ...(pageId.trim() ? { page_id: pageId.trim() } : {}),
        }),
      });
      setRes(await r.json());
    } catch (err) {
      setRes({ erro: String(err) });
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-14">
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
        Conectar o Instagram
      </h1>
      <p className="mt-1.5 text-[15px] text-neutral-600">
        Pelo login do Facebook. Cole o token curto e o servidor faz o resto.
      </p>

      <ol className="mt-8 space-y-3 rounded-xl border border-neutral-200 bg-neutral-50 p-5 text-[14px] leading-relaxed text-neutral-700">
        <li>
          <strong>1.</strong> Abra o{" "}
          <a
            className="underline"
            href="https://developers.facebook.com/tools/explorer/"
            target="_blank"
            rel="noreferrer"
          >
            Graph API Explorer
          </a>
          .
        </li>
        <li>
          <strong>2.</strong> Em <em>Meta App</em>, escolha <strong>VEMDM</strong>. Em{" "}
          <em>User or Page</em>, deixe <strong>User Token</strong>.
        </li>
        <li>
          <strong>3.</strong> Em <em>Permissions</em>, marque:
          <code className="mt-1 block rounded bg-white px-2 py-1.5 text-[12px] text-neutral-800">
            pages_show_list, pages_manage_metadata, pages_read_engagement,
            instagram_basic, instagram_manage_messages, instagram_manage_comments
          </code>
        </li>
        <li>
          <strong>4.</strong> Clique em <strong>Generate Access Token</strong>, autorize, e
          copie o token que aparece no campo.
        </li>
        <li>
          <strong>5.</strong> Cole aqui embaixo. Esse token vale só 1 hora, mas o servidor
          troca por um permanente na hora.
        </li>
      </ol>

      <form onSubmit={enviar} className="mt-6 space-y-4">
        <label className="block space-y-1.5">
          <span className="block text-[13px] font-medium text-neutral-700">
            Token do Graph API Explorer
          </span>
          <textarea
            value={token}
            onChange={(e) => setToken(e.target.value)}
            rows={3}
            required
            placeholder="EAAB..."
            className={`${inputCls} resize-y font-mono text-[12px]`}
          />
        </label>

        <label className="block space-y-1.5">
          <span className="block text-[13px] font-medium text-neutral-700">
            Chave de administração
          </span>
          <input
            type="password"
            value={chave}
            onChange={(e) => setChave(e.target.value)}
            required
            className={inputCls}
          />
          <span className="block text-[12px] text-neutral-500">
            É o valor de CRON_SECRET, o mesmo que está na Vercel.
          </span>
        </label>

        {res?.paginas && (
          <label className="block space-y-1.5">
            <span className="block text-[13px] font-medium text-neutral-700">
              ID da Página
            </span>
            <input
              value={pageId}
              onChange={(e) => setPageId(e.target.value)}
              className={inputCls}
            />
          </label>
        )}

        <button
          type="submit"
          disabled={carregando}
          className="rounded-lg bg-neutral-900 px-4 py-2.5 text-[14px] font-medium text-white transition hover:bg-neutral-700 disabled:opacity-50"
        >
          {carregando ? "Conectando..." : "Conectar"}
        </button>
      </form>

      {res?.ok && (
        <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <p className="text-[14px] text-emerald-900">
            Conectado: <strong>@{res.instagram}</strong> pela Página{" "}
            <strong>{res.pagina}</strong>.
          </p>
          <p className="mt-1 text-[13px] text-emerald-700">
            Token de Página gravado. Ele não expira.{" "}
            <Link href="/" className="underline">
              Voltar ao painel
            </Link>
          </p>
        </div>
      )}

      {res?.erro && (
        <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
          <p className="text-[14px] text-rose-900">{res.erro}</p>
          {res.paginas && (
            <ul className="mt-2 space-y-1 text-[13px] text-rose-800">
              {res.paginas.map((p) => (
                <li key={p.id}>
                  <code>{p.id}</code> — {p.nome}
                  {p.instagram ? ` (@${p.instagram})` : " (sem Instagram)"}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
