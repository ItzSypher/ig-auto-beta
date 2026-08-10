"use client";

import { useState } from "react";

type Resultado = {
  ok?: boolean;
  erro?: string;
  dica?: string;
  pagina?: { id: string; nome: string };
  aceitos?: string[];
  recusados?: { campo: string; motivo: string }[];
  escopos?: string[];
  tem_pages_manage_metadata?: boolean;
};

/**
 * Dispara a inscrição da Página no app sem precisar de console do navegador.
 * A chave é o CRON_SECRET — sem ela qualquer visitante mexeria na config.
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
        Inscreve a Página no app. Sem isso a Meta aceita o endereço do webhook e
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
          {carregando ? "Assinando..." : "Assinar webhooks"}
        </button>
      </div>

      {res && (
        <div
          className={`mt-3 rounded-lg px-3 py-2 text-[12px] ${
            res.ok ? "bg-emerald-50 text-emerald-900" : "bg-rose-50 text-rose-900"
          }`}
        >
          {res.pagina && (
            <p>
              Página: <strong>{res.pagina.nome}</strong>
            </p>
          )}
          {res.aceitos && res.aceitos.length > 0 && (
            <p>Assinados: {res.aceitos.join(", ")}</p>
          )}
          {res.recusados && res.recusados.length > 0 && (
            <p className="mt-1 opacity-80">
              Recusados: {res.recusados.map((r) => r.campo).join(", ")}
            </p>
          )}
          {res.escopos && res.escopos.length > 0 && (
            <p className="mt-1 opacity-80">
              Permissões do token: {res.escopos.join(", ")}
            </p>
          )}
          {res.tem_pages_manage_metadata === false && (
            <p className="mt-1 font-medium">
              Falta pages_manage_metadata no token — é ela que autoriza inscrever
              a Página.
            </p>
          )}
          {res.erro && <p>{res.erro}</p>}
          {res.dica && <p className="mt-1 opacity-80">{res.dica}</p>}
        </div>
      )}
    </div>
  );
}
