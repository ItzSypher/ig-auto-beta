"use client";

import type {
  AppNode,
  DelayData,
  DmData,
  LinkData,
  MatchType,
  NoteData,
  PublicReplyData,
  ReminderData,
  TriggerData,
} from "@/lib/flow";
import { NODE_META } from "@/lib/flow";

type Patch = (data: Record<string, unknown>) => void;

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-[12px] font-medium text-neutral-700">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-neutral-500">{hint}</span>}
    </label>
  );
}

const inputCls =
  "w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-[13px] text-neutral-900 outline-none focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10";

function Check({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-neutral-200 px-2.5 py-2 text-[13px] hover:bg-neutral-50">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-neutral-900"
      />
      <span className="text-neutral-800">{label}</span>
    </label>
  );
}

/** Editor de lista de strings (palavras-chave, variações, botões). */
function StringList({
  items,
  onChange,
  placeholder,
  addLabel,
  multiline,
}: {
  items: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
  addLabel: string;
  multiline?: boolean;
}) {
  const set = (i: number, v: string) =>
    onChange(items.map((old, idx) => (idx === i ? v : old)));

  return (
    <div className="space-y-1.5">
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-1.5">
          {multiline ? (
            <textarea
              value={item}
              onChange={(e) => set(i, e.target.value)}
              placeholder={placeholder}
              rows={2}
              className={`${inputCls} resize-y`}
            />
          ) : (
            <input
              value={item}
              onChange={(e) => set(i, e.target.value)}
              placeholder={placeholder}
              className={inputCls}
            />
          )}
          <button
            type="button"
            onClick={() => onChange(items.filter((_, idx) => idx !== i))}
            aria-label="Remover"
            className="mt-0.5 rounded-lg border border-neutral-200 px-2 py-1.5 text-[13px] text-neutral-500 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600"
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, ""])}
        className="w-full rounded-lg border border-dashed border-neutral-300 px-2.5 py-1.5 text-[12px] text-neutral-600 hover:border-neutral-900 hover:text-neutral-900"
      >
        + {addLabel}
      </button>
    </div>
  );
}

function TriggerForm({ d, patch }: { d: TriggerData; patch: Patch }) {
  return (
    <>
      <Field label="O que dispara">
        <div className="space-y-1.5">
          <Check
            checked={d.comment}
            onChange={(v) => patch({ comment: v })}
            label="Comentário em post ou Reel"
          />
          <Check
            checked={d.storyReply}
            onChange={(v) => patch({ storyReply: v })}
            label="Resposta a story"
          />
          <Check checked={d.dm} onChange={(v) => patch({ dm: v })} label="DM recebida" />
        </div>
      </Field>

      <Field label="Tipo de match">
        <select
          value={d.matchType}
          onChange={(e) => patch({ matchType: e.target.value as MatchType })}
          className={inputCls}
        >
          <option value="contains">Contém a palavra</option>
          <option value="exact">Texto exato</option>
          <option value="any">Qualquer texto</option>
        </select>
      </Field>

      {d.matchType !== "any" && (
        <Field
          label="Palavras-chave"
          hint="Sem acento também: o motor compara em minúsculas e sem acentuação."
        >
          <StringList
            items={d.keywords}
            onChange={(v) => patch({ keywords: v })}
            placeholder="ex: análise"
            addLabel="palavra-chave"
          />
        </Field>
      )}

      <Field
        label="Post específico (opcional)"
        hint="Deixe vazio para valer em qualquer post. Os IDs das suas publicações estão em /midias."
      >
        <input
          value={d.mediaId}
          onChange={(e) => patch({ mediaId: e.target.value })}
          placeholder="17912345678901234"
          className={inputCls}
        />
      </Field>
    </>
  );
}

function PublicReplyForm({ d, patch }: { d: PublicReplyData; patch: Patch }) {
  return (
    <Field
      label="Variações da resposta pública"
      hint="Uma é sorteada a cada comentário. Repetir sempre o mesmo texto é o que marca a conta como spam."
    >
      <StringList
        items={d.variations}
        onChange={(v) => patch({ variations: v })}
        placeholder="Te mandei no direct!"
        addLabel="variação"
        multiline
      />
    </Field>
  );
}

function DmForm({ d, patch }: { d: DmData; patch: Patch }) {
  return (
    <>
      <Field
        label="Texto da mensagem"
        hint="Use {{primeiro_nome}} e {{usuario}} para personalizar."
      >
        <textarea
          value={d.text}
          onChange={(e) => patch({ text: e.target.value })}
          rows={6}
          placeholder="Olá {{primeiro_nome}}!"
          className={`${inputCls} resize-y`}
        />
      </Field>
      <Field
        label="Botões de resposta rápida"
        hint="O toque no botão é o que abre a janela de 24h. Sem botão, a sequência trava aqui."
      >
        <StringList
          items={d.quickReplies}
          onChange={(v) => patch({ quickReplies: v })}
          placeholder="Sim, me mostre!"
          addLabel="botão"
        />
      </Field>
    </>
  );
}

function LinkForm({ d, patch }: { d: LinkData; patch: Patch }) {
  return (
    <>
      <Field label="Texto">
        <textarea
          value={d.text}
          onChange={(e) => patch({ text: e.target.value })}
          rows={5}
          className={`${inputCls} resize-y`}
        />
      </Field>
      <Field label="Rótulo do botão">
        <input
          value={d.buttonLabel}
          onChange={(e) => patch({ buttonLabel: e.target.value })}
          placeholder="Ver o case"
          className={inputCls}
        />
      </Field>
      <Field
        label="URL"
        hint="Não dá para saber se a pessoa clicou — o Instagram não devolve esse evento."
      >
        <input
          value={d.url}
          onChange={(e) => patch({ url: e.target.value })}
          placeholder="https://..."
          className={inputCls}
        />
      </Field>
    </>
  );
}

function DelayForm({ d, patch }: { d: DelayData; patch: Patch }) {
  return (
    <Field label="Esperar (segundos)" hint="Dá ritmo de conversa humana entre as mensagens.">
      <input
        type="number"
        min={1}
        max={600}
        value={d.seconds}
        onChange={(e) => patch({ seconds: Math.max(1, Number(e.target.value) || 1) })}
        className={inputCls}
      />
    </Field>
  );
}

function ReminderForm({ d, patch }: { d: ReminderData; patch: Patch }) {
  return (
    <>
      <Field label="Texto do lembrete">
        <textarea
          value={d.text}
          onChange={(e) => patch({ text: e.target.value })}
          rows={4}
          className={`${inputCls} resize-y`}
        />
      </Field>
      <Field
        label="Atraso (minutos)"
        hint="Dispara por tempo. Só cabe dentro da janela de 24h — acima de 1440min a Meta bloqueia o envio."
      >
        <input
          type="number"
          min={1}
          max={1440}
          value={d.delayMinutes}
          onChange={(e) =>
            patch({ delayMinutes: Math.max(1, Number(e.target.value) || 1) })
          }
          className={inputCls}
        />
      </Field>
    </>
  );
}

function NoteForm({ d, patch }: { d: NoteData; patch: Patch }) {
  return (
    <Field label="Anotação" hint="Só para você se lembrar. Não é enviada para ninguém.">
      <textarea
        value={d.text}
        onChange={(e) => patch({ text: e.target.value })}
        rows={6}
        className={`${inputCls} resize-y`}
      />
    </Field>
  );
}

export function Inspector({
  node,
  onPatch,
  onDelete,
  onClose,
}: {
  node: AppNode | null;
  onPatch: Patch;
  onDelete: () => void;
  onClose: () => void;
}) {
  if (!node) {
    return (
      <aside className="hidden w-[320px] shrink-0 border-l border-neutral-200 bg-white p-5 lg:block">
        <p className="text-[13px] text-neutral-500">
          Clique em um bloco do fluxo para editar o conteúdo dele aqui.
        </p>
      </aside>
    );
  }

  const kind = node.type!;
  const meta = NODE_META[kind];

  return (
    <aside className="hidden w-[320px] shrink-0 flex-col border-l border-neutral-200 bg-white lg:flex">
      <header className="flex items-start justify-between gap-2 border-b border-neutral-200 px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: meta.accent }}
            />
            <h2 className="text-[14px] font-semibold text-neutral-900">{meta.title}</h2>
          </div>
          <p className="mt-0.5 text-[11px] text-neutral-500">{meta.hint}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar painel"
          className="rounded-md px-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
        >
          ×
        </button>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
        {kind === "trigger" && (
          <TriggerForm d={node.data as TriggerData} patch={onPatch} />
        )}
        {kind === "publicReply" && (
          <PublicReplyForm d={node.data as PublicReplyData} patch={onPatch} />
        )}
        {kind === "dm" && <DmForm d={node.data as DmData} patch={onPatch} />}
        {kind === "link" && <LinkForm d={node.data as LinkData} patch={onPatch} />}
        {kind === "delay" && <DelayForm d={node.data as DelayData} patch={onPatch} />}
        {kind === "reminder" && (
          <ReminderForm d={node.data as ReminderData} patch={onPatch} />
        )}
        {kind === "note" && <NoteForm d={node.data as NoteData} patch={onPatch} />}
      </div>

      <footer className="border-t border-neutral-200 px-5 py-3">
        <button
          type="button"
          onClick={onDelete}
          disabled={kind === "trigger"}
          className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-[13px] text-rose-600 transition hover:border-rose-300 hover:bg-rose-50 disabled:cursor-not-allowed disabled:border-neutral-200 disabled:bg-neutral-50 disabled:text-neutral-400"
        >
          {kind === "trigger" ? "O gatilho não pode ser removido" : "Excluir bloco"}
        </button>
      </footer>
    </aside>
  );
}
