import type { Edge } from "@xyflow/react";
import type {
  AppNode,
  DelayData,
  DmData,
  LinkData,
  MatchType,
  PublicReplyData,
  ReminderData,
  TriggerData,
} from "@/lib/flow";

/** Uma linha de `automations`, nos nomes reais do banco. */
export type AutomationRow = {
  id?: string;
  name: string;
  active: boolean;

  trigger_comment: boolean;
  trigger_story_reply: boolean;
  trigger_dm: boolean;

  keywords: string[];
  match_type: MatchType;
  media_id: string | null;

  public_replies: string[];

  welcome_dm: string | null;
  quick_reply_label: string | null;

  link_message: string | null;
  link_button_label: string | null;
  link_url: string | null;
  link_delay_seconds: number;

  reminder_message: string | null;
  reminder_delay_seconds: number;
  reminder_enabled: boolean;

  /** O grafo inteiro, para a tela reabrir igual ao que foi salvo. */
  flow: { nodes: AppNode[]; edges: Edge[] };
};

function nodeOf<T>(nodes: AppNode[], type: string): T | null {
  const found = nodes.find((n) => n.type === type);
  return found ? (found.data as T) : null;
}

/**
 * Achata o grafo do builder nas colunas de `automations`.
 *
 * O motor lê as colunas, não o grafo — elas são a interface com o backend.
 * O `flow` guarda o desenho para a tela reabrir do jeito que ficou.
 */
export function flowToRow(
  name: string,
  active: boolean,
  nodes: AppNode[],
  edges: Edge[],
): AutomationRow {
  const trigger = nodeOf<TriggerData>(nodes, "trigger");
  const publicReply = nodeOf<PublicReplyData>(nodes, "publicReply");
  const dm = nodeOf<DmData>(nodes, "dm");
  const link = nodeOf<LinkData>(nodes, "link");
  const delay = nodeOf<DelayData>(nodes, "delay");
  const reminder = nodeOf<ReminderData>(nodes, "reminder");

  const limpar = (list: string[] | undefined) =>
    (list ?? []).map((s) => s.trim()).filter(Boolean);

  const botoes = limpar(dm?.quickReplies);

  return {
    name: name.trim() || "Automação sem nome",
    active,

    trigger_comment: trigger?.comment ?? false,
    trigger_story_reply: trigger?.storyReply ?? false,
    trigger_dm: trigger?.dm ?? false,

    keywords: limpar(trigger?.keywords),
    match_type: trigger?.matchType ?? "contains",
    media_id: trigger?.mediaId?.trim() || null,

    public_replies: limpar(publicReply?.variations),

    welcome_dm: dm?.text?.trim() || null,
    // O banco guarda um rótulo só; o primeiro botão é o que abre a janela.
    quick_reply_label: botoes[0] ?? null,

    link_message: link?.text?.trim() || null,
    link_button_label: link?.buttonLabel?.trim() || null,
    link_url: link?.url?.trim() || null,
    link_delay_seconds: delay?.seconds ?? 0,

    reminder_message: reminder?.text?.trim() || null,
    reminder_delay_seconds: (reminder?.delayMinutes ?? 60) * 60,
    reminder_enabled: Boolean(reminder?.text?.trim()),

    flow: { nodes, edges },
  };
}
