import Link from "next/link";
import { db } from "@/lib/supabase";

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
    key: "FB_APP_ID",
    label: "ID do app do Facebook",
    why: "Troca o token curto do Graph API Explorer por um permanente.",
  },
  {
    key: "FB_APP_SECRET",
    label: "Chave secreta do app do Facebook",
    why: "Valida a assinatura X-Hub-Signature-256 do webhook.",
  },
  {
    key: "IG_VERIFY_TOKEN",
    label: "Verify Token do webhook",
    why: "Responde o handshake GET que a Meta faz ao salvar o webhook.",
  },
  {
    key: "CRON_SECRET",
    label: "Segredo do cron",
    why: "Protege a drenagem da fila e a tela de conexão.",
  },
];

type Conta = {
  ig_username: string | null;
  ig_user_id: string | null;
  token_expires_at: string | null;
};

/** Lê a linha única de config. Devolve null se o banco não responder. */
async function contaConectada(): Promise<Conta | null> {
  try {
    const { data } = await db()
      .from("config")
      .select("ig_username, ig_user_id, token_expires_at")
      .eq("id", 1)
      .maybeSingle();
    return data?.ig_user_id ? (data as Conta) : null;
  } catch {
    return null;
  }
}

export default async function Home() {
  const status = CHECKS.map((c) => ({ ...c, ok: Boolean(process.env[c.key]) }));
  const missing = status.filter((s) => !s.ok).length;
  const conta = await contaConectada();

  return (
    <div className="mx-auto max-w-3xl px-6 py-14">
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">IG Auto</h1>
      <p className="mt-1.5 text-[15px] text-neutral-600">
        Comentário vira DM. Sem mensalidade, rodando em planos grátis.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link
          href="/builder"
          className="rounded-lg bg-neutral-900 px-4 py-2.5 text-[14px] font-medium text-white transition hover:bg-neutral-700"
        >
          Abrir o Flow Builder
        </Link>
        <Link
          href="/atividade"
          className="rounded-lg border border-neutral-300 px-4 py-2.5 text-[14px] font-medium text-neutral-800 transition hover:border-neutral-900"
        >
          Atividade
        </Link>
        <Link
          href="/midias"
          className="rounded-lg border border-neutral-300 px-4 py-2.5 text-[14px] font-medium text-neutral-800 transition hover:border-neutral-900"
        >
          Minhas publicações
        </Link>
      </div>

      <section className="mt-10">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-neutral-500">
          Conta do Instagram
        </h2>
        {conta ? (
          <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <p className="text-[14px] text-emerald-900">
              Conectada como <strong>@{conta.ig_username ?? conta.ig_user_id}</strong>
            </p>
            {conta.token_expires_at && (
              <p className="mt-0.5 text-[12px] text-emerald-700">
                Token válido até{" "}
                {new Date(conta.token_expires_at).toLocaleDateString("pt-BR")}
              </p>
            )}
          </div>
        ) : (
          <div className="mt-3 rounded-xl border border-neutral-200 px-4 py-3">
            <p className="text-[14px] text-neutral-700">Nenhuma conta conectada.</p>
            <p className="mt-0.5 text-[12px] text-neutral-500">
              Conecte pelo login do Facebook em{" "}
              <Link href="/conectar" className="underline hover:text-neutral-900">
                /conectar
              </Link>
              .
            </p>
          </div>
        )}
      </section>

      <section className="mt-8">
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
