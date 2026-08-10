import Link from "next/link";
import { db } from "@/lib/supabase";
import { SubscribeButton } from "@/components/SubscribeButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "Atividade — IG Auto" };

type Evento = {
  id: number;
  kind: string;
  ig_user_id: string | null;
  signature_ok: boolean | null;
  created_at: string;
};

type ItemFila = {
  id: string;
  kind: string;
  recipient_type: string;
  status: string;
  attempts: number;
  last_error: string | null;
  run_after: string;
  sent_at: string | null;
  created_at: string;
};

type Automacao = { id: string; name: string; active: boolean; keywords: string[] | null };

async function carregar() {
  try {
    const supabase = db();
    const [ev, fila, autos, contatos] = await Promise.all([
      supabase.from("events").select("*").order("created_at", { ascending: false }).limit(15),
      supabase.from("queue").select("*").order("created_at", { ascending: false }).limit(15),
      supabase.from("automations").select("id,name,active,keywords"),
      supabase.from("contacts").select("id", { count: "exact", head: true }),
    ]);

    return {
      eventos: (ev.data ?? []) as Evento[],
      fila: (fila.data ?? []) as ItemFila[],
      automacoes: (autos.data ?? []) as Automacao[],
      contatos: contatos.count ?? 0,
      erro: null as string | null,
    };
  } catch (err) {
    return { eventos: [], fila: [], automacoes: [], contatos: 0, erro: String(err) };
  }
}

const CORES: Record<string, string> = {
  sent: "bg-emerald-100 text-emerald-800",
  pending: "bg-amber-100 text-amber-800",
  sending: "bg-sky-100 text-sky-800",
  failed: "bg-rose-100 text-rose-800",
  skipped: "bg-neutral-200 text-neutral-700",
};

function hora(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default async function AtividadePage() {
  const { eventos, fila, automacoes, contatos, erro } = await carregar();
  const ativas = automacoes.filter((a) => a.active);

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <Link href="/" className="text-[13px] text-neutral-500 underline">
        ← Painel
      </Link>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight text-neutral-900">
        Atividade
      </h1>
      <p className="mt-1.5 text-[15px] text-neutral-600">
        O que a Meta mandou, e o que o worker fez com isso. Recarregue para atualizar.
      </p>

      {erro && (
        <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[14px] text-rose-900">
          {erro}
        </div>
      )}

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { rotulo: "Automações ativas", valor: ativas.length, alerta: ativas.length === 0 },
          { rotulo: "Eventos recebidos", valor: eventos.length, alerta: eventos.length === 0 },
          { rotulo: "Itens na fila", valor: fila.length, alerta: false },
          { rotulo: "Contatos", valor: contatos, alerta: false },
        ].map((c) => (
          <div
            key={c.rotulo}
            className={`rounded-xl border px-4 py-3 ${
              c.alerta ? "border-amber-300 bg-amber-50" : "border-neutral-200"
            }`}
          >
            <p className="text-[22px] font-semibold text-neutral-900">{c.valor}</p>
            <p className="text-[12px] text-neutral-600">{c.rotulo}</p>
          </div>
        ))}
      </div>

      {ativas.length === 0 && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
          Sem automação ativa, nenhum comentário ou DM vira resposta. Abra o{" "}
          <Link href="/builder" className="underline">
            builder
          </Link>
          , clique em Salvar e depois em Publicar.
        </p>
      )}

      {eventos.length === 0 && ativas.length > 0 && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
          A automação está ativa mas nenhum evento chegou. O problema está entre a
          Meta e o webhook: confira a assinatura da Página e o campo de webhook no
          painel da Meta.
        </p>
      )}

      <section className="mt-8">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-neutral-500">
          Entrega de eventos
        </h2>
        <SubscribeButton />
      </section>

      <section className="mt-8">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-neutral-500">
          Automações
        </h2>
        <ul className="mt-3 divide-y divide-neutral-200 rounded-xl border border-neutral-200">
          {automacoes.length === 0 && (
            <li className="px-4 py-3 text-[14px] text-neutral-500">
              Nenhuma automação gravada.
            </li>
          )}
          {automacoes.map((a) => (
            <li key={a.id} className="flex items-center gap-3 px-4 py-3">
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  a.active ? "bg-emerald-100 text-emerald-800" : "bg-neutral-200 text-neutral-600"
                }`}
              >
                {a.active ? "ativa" : "pausada"}
              </span>
              <span className="text-[14px] text-neutral-900">{a.name}</span>
              <span className="truncate text-[12px] text-neutral-500">
                {(a.keywords ?? []).join(", ") || "sem palavras-chave"}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-neutral-500">
          Últimos eventos da Meta
        </h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-neutral-200">
          <table className="w-full text-[13px]">
            <thead className="bg-neutral-50 text-left text-[12px] text-neutral-600">
              <tr>
                <th className="px-4 py-2">Quando</th>
                <th className="px-4 py-2">Tipo</th>
                <th className="px-4 py-2">De</th>
                <th className="px-4 py-2">Assinatura</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {eventos.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-4 text-neutral-500">
                    Nada recebido ainda.
                  </td>
                </tr>
              )}
              {eventos.map((e) => (
                <tr key={e.id}>
                  <td className="whitespace-nowrap px-4 py-2 text-neutral-600">
                    {hora(e.created_at)}
                  </td>
                  <td className="px-4 py-2 text-neutral-900">{e.kind}</td>
                  <td className="px-4 py-2 font-mono text-[11px] text-neutral-600">
                    {e.ig_user_id ?? "—"}
                  </td>
                  <td className="px-4 py-2">{e.signature_ok ? "ok" : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-neutral-500">
          Fila de envio
        </h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-neutral-200">
          <table className="w-full text-[13px]">
            <thead className="bg-neutral-50 text-left text-[12px] text-neutral-600">
              <tr>
                <th className="px-4 py-2">Quando</th>
                <th className="px-4 py-2">O quê</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Tent.</th>
                <th className="px-4 py-2">Erro</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {fila.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-4 text-neutral-500">
                    Fila vazia.
                  </td>
                </tr>
              )}
              {fila.map((q) => (
                <tr key={q.id}>
                  <td className="whitespace-nowrap px-4 py-2 text-neutral-600">
                    {hora(q.created_at)}
                  </td>
                  <td className="px-4 py-2 text-neutral-900">{q.kind}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] ${
                        CORES[q.status] ?? "bg-neutral-100 text-neutral-700"
                      }`}
                    >
                      {q.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-neutral-600">{q.attempts}</td>
                  <td className="max-w-[280px] truncate px-4 py-2 text-[12px] text-rose-700">
                    {q.last_error ?? ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
