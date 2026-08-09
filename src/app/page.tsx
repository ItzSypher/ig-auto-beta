import Link from "next/link";

// Sem isto o Next prerenderiza esta página no build e congela o resultado da
// checagem. Variável cadastrada depois do build continuaria aparecendo como
// "faltando" até o próximo deploy. Aqui a leitura acontece a cada request.
export const dynamic = "force-dynamic";

/** Só reporta presença/ausência — nenhum valor de credencial chega ao navegador. */
const CHECKS: { key: string; label: string; why: string }[] = [
  {
    key: "NEXT_PUBLIC_SUPABASE_URL",
    label: "Supabase URL",
    why: "Endereço do seu banco.",
  },
  {
    key: "SUPABASE_SERVICE_ROLE_KEY",
    label: "Supabase Service Role Key",
    why: "Acesso ao banco pelo servidor (as tabelas têm RLS sem políticas).",
  },
  {
    key: "IG_APP_SECRET",
    label: "Chave secreta do app do Instagram",
    why: "Valida a assinatura X-Hub-Signature-256 do webhook.",
  },
  {
    key: "IG_VERIFY_TOKEN",
    label: "Verify Token do webhook",
    why: "Responde o handshake GET que a Meta faz ao salvar o webhook.",
  },
  {
    key: "IG_ACCESS_TOKEN",
    label: "Token de acesso do Instagram",
    why: "Envia as respostas privadas e as DMs.",
  },
  {
    key: "CRON_SECRET",
    label: "Segredo do cron",
    why: "Protege o endpoint que drena a fila.",
  },
];

export default function Home() {
  const status = CHECKS.map((c) => ({ ...c, ok: Boolean(process.env[c.key]) }));
  const missing = status.filter((s) => !s.ok).length;

  return (
    <div className="mx-auto max-w-3xl px-6 py-14">
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">IG Auto</h1>
      <p className="mt-1.5 text-[15px] text-neutral-600">
        Comentário vira DM. Sem mensalidade, rodando em planos grátis.
      </p>

      <Link
        href="/builder"
        className="mt-6 inline-block rounded-lg bg-neutral-900 px-4 py-2.5 text-[14px] font-medium text-white transition hover:bg-neutral-700"
      >
        Abrir o Flow Builder
      </Link>

      <section className="mt-10">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-neutral-500">
          Configuração
        </h2>
        <ul className="mt-3 divide-y divide-neutral-200 rounded-xl border border-neutral-200">
          {status.map((s) => (
            <li key={s.key} className="flex items-start gap-3 px-4 py-3">
              <span
                aria-hidden
                className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                  s.ok ? "bg-emerald-500" : "bg-neutral-300"
                }`}
              />
              <div className="min-w-0">
                <p className="text-[14px] text-neutral-900">
                  {s.label}{" "}
                  <span
                    className={`ml-1 text-[12px] ${
                      s.ok ? "text-emerald-600" : "text-neutral-400"
                    }`}
                  >
                    {s.ok ? "configurado" : "faltando"}
                  </span>
                </p>
                <p className="text-[12px] text-neutral-500">{s.why}</p>
              </div>
            </li>
          ))}
        </ul>
        {missing > 0 && (
          <p className="mt-3 text-[13px] text-neutral-600">
            Faltam {missing} variáveis. O Flow Builder já funciona sem elas — o rascunho
            fica salvo no navegador até o banco entrar.
          </p>
        )}
      </section>

      {/* A Meta exige as duas URLs abaixo para publicar o app. */}
      <footer className="mt-10 flex gap-4 border-t border-neutral-200 pt-5 text-[13px] text-neutral-500">
        <Link href="/privacidade" className="underline hover:text-neutral-900">
          Política de Privacidade
        </Link>
        <Link href="/termos" className="underline hover:text-neutral-900">
          Termos de Serviço
        </Link>
        <Link href="/exclusao-de-dados" className="underline hover:text-neutral-900">
          Exclusão de dados
        </Link>
      </footer>
    </div>
  );
}
