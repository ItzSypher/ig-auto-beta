import { LegalPage, P, Section } from "@/components/LegalPage";
import { db } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const metadata = { title: "Status da exclusão — VEMDM" };

async function lookup(code: string) {
  try {
    const { data } = await db()
      .from("events")
      .select("created_at")
      .eq("kind", "data_deletion")
      .contains("payload", { confirmation_code: code })
      .maybeSingle();
    return data;
  } catch {
    // Sem credenciais configuradas ou banco fora do ar.
    return null;
  }
}

export default async function StatusPage({
  searchParams,
}: {
  searchParams: Promise<{ codigo?: string }>;
}) {
  const { codigo } = await searchParams;
  const found = codigo ? await lookup(codigo) : null;

  return (
    <LegalPage title="Status da exclusão" updated="9 de agosto de 2026">
      {!codigo ? (
        <P>
          Esta página mostra o andamento de um pedido de exclusão. Abra o link
          completo que você recebeu, com o código de confirmação no fim.
        </P>
      ) : found ? (
        <Section title="Concluído">
          <P>
            O pedido <strong>{codigo}</strong> foi processado em{" "}
            {new Date(found.created_at as string).toLocaleString("pt-BR")}. Todos os
            seus registros foram apagados do nosso banco.
          </P>
          <P>
            As mensagens que já tinham sido entregues continuam na sua caixa de
            entrada do Instagram — essas ficam com a Meta, fora do nosso alcance.
          </P>
        </Section>
      ) : (
        <Section title="Código não encontrado">
          <P>
            Não localizamos o código <strong>{codigo}</strong>. Confira se o link
            foi copiado inteiro. Se o problema continuar, escreva para{" "}
            <a className="underline" href="mailto:arthurfoxinfo@gmail.com">
              arthurfoxinfo@gmail.com
            </a>
            .
          </P>
        </Section>
      )}
    </LegalPage>
  );
}
