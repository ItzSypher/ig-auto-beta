"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import type {
  AppNode,
  DelayData,
  DmData,
  LinkData,
  NodeKind,
  NoteData,
  PublicReplyData,
  ReminderData,
  TriggerData,
} from "@/lib/flow";
import { NODE_META, humanDelay, matchLabel } from "@/lib/flow";

/** Realça {{variavel}} dentro do texto da mensagem, como o ManyChat faz. */
function RichText({ text }: { text: string }) {
  if (!text.trim()) {
    return <span className="italic text-neutral-400">Mensagem vazia</span>;
  }
  const parts = text.split(/(\{\{[^}]+\}\})/g);
  return (
    <>
      {parts.map((part, i) =>
        /^\{\{[^}]+\}\}$/.test(part) ? (
          <span
            key={i}
            className="rounded bg-sky-100 px-1 py-px font-medium text-sky-700"
          >
            {part.slice(2, -2).replace(/_/g, " ")}
          </span>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

function Shell({
  kind,
  selected,
  children,
  /** O gatilho não recebe conexão de entrada. */
  withTarget = true,
  withSource = true,
}: {
  kind: NodeKind;
  selected?: boolean;
  children: React.ReactNode;
  withTarget?: boolean;
  withSource?: boolean;
}) {
  const meta = NODE_META[kind];
  return (
    <div
      className={`w-[268px] overflow-hidden rounded-xl border bg-white text-[13px] shadow-sm transition ${
        selected
          ? "border-neutral-900 shadow-lg ring-2 ring-neutral-900/10"
          : "border-neutral-200 hover:border-neutral-300"
      }`}
      style={{ borderLeft: `4px solid ${meta.accent}` }}
    >
      {withTarget && (
        <Handle
          type="target"
          position={Position.Left}
          className="!h-2.5 !w-2.5 !border-2 !border-white !bg-neutral-400"
        />
      )}
      <div className="flex items-center gap-2 border-b border-neutral-100 px-3 py-2">
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ background: meta.accent }}
        />
        <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
          {meta.title}
        </span>
      </div>
      <div className="space-y-2 px-3 py-2.5">{children}</div>
      {withSource && (
        <Handle
          type="source"
          position={Position.Right}
          className="!h-2.5 !w-2.5 !border-2 !border-white !bg-neutral-400"
        />
      )}
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-700">
      {children}
    </span>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-[12px] italic text-neutral-400">{children}</p>;
}

export function TriggerNode({ data, selected }: NodeProps<AppNode & { type: "trigger" }>) {
  const d = data as TriggerData;
  const sources = [
    d.comment && "Comentário em post/Reel",
    d.storyReply && "Resposta a story",
    d.dm && "DM recebida",
  ].filter(Boolean) as string[];

  return (
    <Shell kind="trigger" selected={selected} withTarget={false}>
      {sources.length === 0 ? (
        <Empty>Nenhuma origem marcada</Empty>
      ) : (
        <ul className="space-y-1">
          {sources.map((s) => (
            <li
              key={s}
              className="rounded-md bg-rose-50 px-2 py-1.5 text-[12px] text-rose-900"
            >
              {s}
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-1 pt-0.5">
        <Pill>match: {matchLabel(d.matchType)}</Pill>
        {d.mediaId ? <Pill>post fixo</Pill> : <Pill>qualquer post</Pill>}
      </div>
      {d.matchType !== "any" &&
        (d.keywords.length === 0 ? (
          <Empty>Sem palavras-chave</Empty>
        ) : (
          <div className="flex flex-wrap gap-1">
            {d.keywords.map((k) => (
              <span
                key={k}
                className="rounded border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 text-[11px] text-neutral-700"
              >
                {k}
              </span>
            ))}
          </div>
        ))}
    </Shell>
  );
}

export function PublicReplyNode({
  data,
  selected,
}: NodeProps<AppNode & { type: "publicReply" }>) {
  const d = data as PublicReplyData;
  const list = d.variations.filter((v) => v.trim());
  return (
    <Shell kind="publicReply" selected={selected}>
      {list.length === 0 ? (
        <Empty>Sem variações</Empty>
      ) : (
        <>
          {list.slice(0, 3).map((v, i) => (
            <p
              key={i}
              className="rounded-md bg-violet-50 px-2 py-1.5 text-[12px] text-violet-900"
            >
              {v}
            </p>
          ))}
          {list.length > 3 && (
            <p className="text-[11px] text-neutral-500">+{list.length - 3} variações</p>
          )}
        </>
      )}
      <p className="text-[11px] text-neutral-500">Sorteia 1 para não parecer robô.</p>
    </Shell>
  );
}

export function DmNode({ data, selected }: NodeProps<AppNode & { type: "dm" }>) {
  const d = data as DmData;
  const buttons = d.quickReplies.filter((b) => b.trim());
  return (
    <Shell kind="dm" selected={selected}>
      <p className="whitespace-pre-wrap rounded-md bg-sky-50 px-2 py-1.5 text-[12px] leading-snug text-sky-950">
        <RichText text={d.text} />
      </p>
      {buttons.length === 0 ? (
        <Empty>Sem botão — a janela de 24h não abre</Empty>
      ) : (
        <div className="space-y-1">
          {buttons.map((b) => (
            <div
              key={b}
              className="rounded-md border border-sky-200 bg-white px-2 py-1.5 text-center text-[12px] font-medium text-sky-700"
            >
              {b}
            </div>
          ))}
        </div>
      )}
    </Shell>
  );
}

export function LinkNode({ data, selected }: NodeProps<AppNode & { type: "link" }>) {
  const d = data as LinkData;
  return (
    <Shell kind="link" selected={selected}>
      <p className="whitespace-pre-wrap rounded-md bg-emerald-50 px-2 py-1.5 text-[12px] leading-snug text-emerald-950">
        <RichText text={d.text} />
      </p>
      <div className="rounded-md border border-emerald-200 bg-white px-2 py-1.5 text-center text-[12px] font-medium text-emerald-700">
        {d.buttonLabel || "Botão sem rótulo"}
      </div>
      <p className="truncate text-[11px] text-neutral-500">{d.url || "URL vazia"}</p>
    </Shell>
  );
}

export function DelayNode({ data, selected }: NodeProps<AppNode & { type: "delay" }>) {
  const d = data as DelayData;
  return (
    <Shell kind="delay" selected={selected}>
      <p className="text-center text-[13px] font-medium text-amber-700">
        Esperando {d.seconds}s
      </p>
    </Shell>
  );
}

export function ReminderNode({
  data,
  selected,
}: NodeProps<AppNode & { type: "reminder" }>) {
  const d = data as ReminderData;
  return (
    <Shell kind="reminder" selected={selected}>
      <p className="whitespace-pre-wrap rounded-md bg-pink-50 px-2 py-1.5 text-[12px] leading-snug text-pink-950">
        <RichText text={d.text} />
      </p>
      <p className="text-[11px] text-neutral-500">
        Dispara {humanDelay(d.delayMinutes)} depois, por tempo.
      </p>
    </Shell>
  );
}

export function NoteNode({ data, selected }: NodeProps<AppNode & { type: "note" }>) {
  const d = data as NoteData;
  return (
    <div
      className={`w-[240px] rounded-lg border px-3 py-2.5 text-[12px] leading-snug shadow-sm transition ${
        selected
          ? "border-amber-400 ring-2 ring-amber-200"
          : "border-amber-200 hover:border-amber-300"
      }`}
      style={{ background: "#fdf6e3" }}
    >
      <p className="whitespace-pre-wrap text-amber-900">{d.text}</p>
    </div>
  );
}

export const nodeTypes = {
  trigger: TriggerNode,
  publicReply: PublicReplyNode,
  dm: DmNode,
  link: LinkNode,
  delay: DelayNode,
  reminder: ReminderNode,
  note: NoteNode,
};
