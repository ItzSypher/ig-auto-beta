import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import type { AutomationRow } from "@/lib/automation-mapper";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Carrega a automação para o builder.
 *
 * Por ora existe uma só. Quando o builder ganhar lista de automações, isto
 * vira uma listagem e o id passa a vir na URL.
 */
export async function GET() {
  try {
    const { data, error } = await db()
      .from("automations")
      .select("*")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return NextResponse.json({ automacao: data ?? null });
  } catch (err) {
    console.error("falha ao carregar automação", err);
    return NextResponse.json({ erro: String(err) }, { status: 500 });
  }
}

/** Cria ou atualiza a automação do builder. */
export async function PUT(req: Request) {
  let row: AutomationRow & { id?: string };
  try {
    row = await req.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido" }, { status: 400 });
  }

  if (!row?.name) {
    return NextResponse.json({ erro: "nome obrigatório" }, { status: 400 });
  }

  try {
    const supabase = db();
    const { id, ...campos } = row;

    // Sem id no corpo, reaproveita a automação existente em vez de criar
    // uma segunda — duas ativas casando o mesmo comentário mandariam duas DMs.
    let alvo = id;
    if (!alvo) {
      const { data } = await supabase
        .from("automations")
        .select("id")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      alvo = data?.id as string | undefined;
    }

    const payload = { ...campos, updated_at: new Date().toISOString() };

    const { data, error } = alvo
      ? await supabase.from("automations").update(payload).eq("id", alvo).select("id").maybeSingle()
      : await supabase.from("automations").insert(payload).select("id").maybeSingle();

    if (error) throw error;
    return NextResponse.json({ ok: true, id: data?.id });
  } catch (err) {
    console.error("falha ao salvar automação", err);
    return NextResponse.json({ erro: String(err) }, { status: 500 });
  }
}
