import type { Edge, Node } from "@xyflow/react";

/** Como a palavra-chave é comparada com o texto que a pessoa mandou. */
export type MatchType = "contains" | "exact" | "any";

export type TriggerData = {
  /** Comentário em post ou Reel. */
  comment: boolean;
  /** Resposta a story (chega como message.reply_to.story). */
  storyReply: boolean;
  /** DM comum. */
  dm: boolean;
  keywords: string[];
  matchType: MatchType;
  /** Post específico. Vazio = vale para qualquer post. */
  mediaId: string;
};

/** Resposta pública no próprio comentário. Sorteamos uma das variações. */
export type PublicReplyData = { variations: string[] };

/** DM de boas-vindas. Os botões viram quick replies. */
export type DmData = { text: string; quickReplies: string[] };

/** Mensagem com botão de link (abre fora do Instagram). */
export type LinkData = { text: string; buttonLabel: string; url: string };

export type DelayData = { seconds: number };

/** Lembrete disparado por tempo — não dá para saber se a pessoa clicou. */
export type ReminderData = { text: string; delayMinutes: number };

/** Post-it de anotação. Não envia nada, só documenta o fluxo. */
export type NoteData = { text: string };

export type AppNode =
  | Node<TriggerData, "trigger">
  | Node<PublicReplyData, "publicReply">
  | Node<DmData, "dm">
  | Node<LinkData, "link">
  | Node<DelayData, "delay">
  | Node<ReminderData, "reminder">
  | Node<NoteData, "note">;

export type NodeKind = NonNullable<AppNode["type"]>;

export type FlowDoc = { nodes: AppNode[]; edges: Edge[] };

type NodeMeta = {
  title: string;
  /** Cor da borda esquerda e do cabeçalho do card. */
  accent: string;
  hint: string;
  /** Só pode existir um gatilho por automação. */
  unique?: boolean;
};

export const NODE_META: Record<NodeKind, NodeMeta> = {
  trigger: {
    title: "Quando...",
    accent: "#f43f5e",
    hint: "O que dispara a automação",
    unique: true,
  },
  publicReply: {
    title: "Resposta pública",
    accent: "#8b5cf6",
    hint: "Responde no próprio comentário",
  },
  dm: {
    title: "Enviar DM",
    accent: "#0ea5e9",
    hint: "Mensagem no direct com botões",
  },
  link: {
    title: "Mensagem com link",
    accent: "#22c55e",
    hint: "Texto + botão que abre uma URL",
  },
  delay: { title: "Esperar", accent: "#f59e0b", hint: "Pausa antes do próximo passo" },
  reminder: {
    title: "Lembrete",
    accent: "#ec4899",
    hint: "Cutucada por tempo, se a pessoa sumir",
  },
  note: { title: "Anotação", accent: "#a8a29e", hint: "Post-it, não envia nada" },
};

/** Ordem em que os blocos aparecem na paleta lateral. */
export const PALETTE: NodeKind[] = [
  "trigger",
  "publicReply",
  "dm",
  "link",
  "delay",
  "reminder",
  "note",
];

export function emptyDataFor(kind: NodeKind): AppNode["data"] {
  switch (kind) {
    case "trigger":
      return {
        comment: true,
        storyReply: false,
        dm: false,
        keywords: [],
        matchType: "contains",
        mediaId: "",
      } satisfies TriggerData;
    case "publicReply":
      return { variations: ["Te mandei no direct! 👀"] } satisfies PublicReplyData;
    case "dm":
      return { text: "", quickReplies: [] } satisfies DmData;
    case "link":
      return { text: "", buttonLabel: "Abrir", url: "" } satisfies LinkData;
    case "delay":
      return { seconds: 3 } satisfies DelayData;
    case "reminder":
      return { text: "", delayMinutes: 60 } satisfies ReminderData;
    case "note":
      return { text: "Escreva aqui..." } satisfies NoteData;
  }
}

/**
 * Fluxo piloto — espelha a prospecção que você já roda no ManyChat:
 * comentário com palavra-chave -> resposta pública -> DM com botão ->
 * espera -> link do case -> lembrete.
 */
export const PILOT_FLOW: FlowDoc = {
  nodes: [
    {
      id: "trigger-1",
      type: "trigger",
      position: { x: 0, y: 180 },
      data: {
        comment: true,
        storyReply: true,
        dm: true,
        keywords: ["análise", "analise", "eu quero", "euquero"],
        matchType: "contains",
        mediaId: "",
      },
    },
    {
      id: "note-1",
      type: "note",
      position: { x: 20, y: 470 },
      data: {
        text:
          "A resposta privada de comentário fura a janela de 24h — mas só 1 vez por comentário e em até 7 dias.",
      },
    },
    {
      id: "public-1",
      type: "publicReply",
      position: { x: 360, y: 200 },
      data: {
        variations: [
          "Acabei de te mandar no direct 👀",
          "Chamei você na DM! 📩",
          "Já está no seu direct ✅",
        ],
      },
    },
    {
      id: "dm-1",
      type: "dm",
      position: { x: 700, y: 140 },
      data: {
        text:
          "Olá {{primeiro_nome}}! Prazer, tudo bem? Me chamo Arthur Moura.\n\nPosso te mostrar como posicionar seu negócio?",
        quickReplies: ["Sim, me mostre!", "Agora não"],
      },
    },
    {
      id: "note-2",
      type: "note",
      position: { x: 700, y: 430 },
      data: {
        text:
          "Esta é a primeira mensagem que a pessoa vê. Ela PRECISA de um botão: é o toque no botão que abre a janela de 24h e libera o resto da sequência.",
      },
    },
    {
      id: "delay-1",
      type: "delay",
      position: { x: 1050, y: 180 },
      data: { seconds: 3 },
    },
    {
      id: "link-1",
      type: "link",
      position: { x: 1290, y: 140 },
      data: {
        text:
          "Ótima escolha, {{primeiro_nome}}! Esse aqui foi feito em 7 dias para posicionar um advogado especialista em Direito Imobiliário.",
        buttonLabel: "Ver o case",
        url: "https://exemplo.com/cases",
      },
    },
    {
      id: "reminder-1",
      type: "reminder",
      position: { x: 1650, y: 180 },
      data: {
        text:
          "{{primeiro_nome}}, ainda quer a análise gratuita de posicionamento? Respondo hoje ainda.",
        delayMinutes: 60,
      },
    },
  ],
  edges: [
    { id: "e1", source: "trigger-1", target: "public-1" },
    { id: "e2", source: "public-1", target: "dm-1" },
    { id: "e3", source: "dm-1", target: "delay-1" },
    { id: "e4", source: "delay-1", target: "link-1" },
    { id: "e5", source: "link-1", target: "reminder-1" },
  ],
};

const MATCH_LABEL: Record<MatchType, string> = {
  contains: "contém",
  exact: "exata",
  any: "qualquer",
};

export function matchLabel(m: MatchType) {
  return MATCH_LABEL[m];
}

/** Minutos -> "1h 30min", para caber no card. */
export function humanDelay(minutes: number) {
  if (minutes < 60) return `${minutes}min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}min` : `${h}h`;
}
