import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

/**
 * Cliente com a secret key. Passa por cima da RLS, então só pode ser usado
 * do servidor — nunca importe isto em componente com "use client".
 *
 * A criação é preguiçosa de propósito: no build a Vercel não expõe as
 * variáveis, e um client criado no topo do módulo derrubaria a compilação.
 */
export function db(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY precisam estar setadas.",
    );
  }

  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

/**
 * Apaga tudo que temos de uma pessoa. Usado pelo callback de exclusão de
 * dados da Meta e por pedidos manuais.
 *
 * A ordem importa: filas e eventos primeiro, contato por último, para não
 * depender de como as chaves estrangeiras foram declaradas.
 */
export async function deleteUserData(igUserId: string) {
  const supabase = db();

  const { data: contact } = await supabase
    .from("contacts")
    .select("id")
    .eq("ig_user_id", igUserId)
    .maybeSingle();

  if (contact?.id) {
    await supabase.from("queue").delete().eq("contact_id", contact.id);
  }
  await supabase.from("queue").delete().eq("recipient_value", igUserId);
  await supabase.from("events").delete().eq("ig_user_id", igUserId);
  await supabase.from("contacts").delete().eq("ig_user_id", igUserId);
}
