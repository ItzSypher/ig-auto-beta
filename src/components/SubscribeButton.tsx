"use client";

import { useState } from "react";

type Tentativa = {
  aceitos?: string[];
  recusados?: { campo: string; motivo: string }[];
};

type Resultado = {
  ok?: boolean;
  erro?: string;
  dica?: string;
  pagina?: { id: string; nome: string };
  instagram_id?: string;
  via_pagina?: Tentativa;
  via_instagram?: Tentativa;
  escopos?: string[];
};

function Tentativa({ titulo, dados }: { titulo: string; dados?: Tentativa }) {
  if (!dados) return null;
  const aceitos = dados.aceitos ?? [];
  const recusados = dados.recusados ?? [];

  return (
    <div className="mt-2">
      <p className="font-medium">
        {titulo}: {aceitos.length > 0 ? `${aceitos.length} campo(s) assinado(s)` : "recusado"}
      </p>
      {aceitos.length > 0 && <p className="opacity-80">✓ {aceitos.join(", ")}</p>}
      {recusados.length > 0 && (
        // O motivo de cada recusa é o que diz qual permissão a Meta quer.
        <ul className="mt-1 space-y-0.5 opacity-80">
          {recusados.slice(0, 3).map((r) => (
            <li key={r.campo}>
              ✗ {r.campo}: {r.motivo}
            </li>
          ))}
          {recusados.length > 3 && <li>… e mais {recusados.length - 3}</li>}
        </ul>
      )}
    </div>
  );
}

/**
 * Dispara a inscrição sem precisar de console. A chave é o CRON_SECRET —
 * sem ela qualquer visitante mexeria na configuração.
 */
export function SubscribeButton() {
  const [chave, setChave] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [res, setRes] = useState<Resultado | null>(null);

  async function assinar() {
    setCarregando(true);
    setRes(null);
    try {
      const r = await fetch("/api/instagram/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chave: chave.trim() }),
      });
      setRes(await r.json());
    } catch (e) {
      setRes({ erro: String(e) });
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-neutral-200 p-4">
      <p className="text-[13px] text-neutral-700">
        Tenta inscrever nos dois endereços possíveis: pelo ID da Página e pelo ID da
        conta do Instagram. Sem inscrição, a Meta aceita o endereço do webhook e
        nunca envia evento.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          type="password"
          value={chave}
          onChange={(e) => setChave(e.target.value)}
          placeholder="CRON_SECRET"
          className="min-w-0 flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-[13px] outline-none focus:border-neutral-900"
        />
        <button
          type="button"
          onClick={assinar}
          disabled={carregando || !chave.trim()}
          className="rounded-lg bg-neutral-900 px-3.5 py-2 text-[13px] font-medium text-white transition hover:bg-neutral-700 disabled:opacity-40"
        >
          {carregando ? "Tentando..." : "Assinar webhooks"}
        </button>
      </div>

      {res && (
        <div
          className={`mt-3 rounded-lg px-3 py-2.5 text-[12px] leading-relaxed ${
            res.ok ? "bg-emerald-50 text-emerald-900" : "bg-rose-50 text-rose-900"
          }`}
        >
          {res.pagina && (
            <p>
              Página: <strong>{res.pagina.nome}</strong> · Instagram:{" "}
              <code>{res.instagram_id}</code>
            </p>
          )}
          <Tentativa titulo="Pelo ID da Página" dados={res.via_pagina} />
          <Tentativa titulo="Pelo ID do Instagram" dados={res.via_instagram} />
          {res.escopos && res.escopos.length > 0 && (
            <p className="mt-2 opacity-70">Permissões do token: {res.escopos.join(", ")}</p>
          )}
          {res.erro && <p className="mt-2">{res.erro}</p>}
          {res.dica && <p className="mt-2">{res.dica}</p>}
        </div>
      )}
    </div>
  );
}
