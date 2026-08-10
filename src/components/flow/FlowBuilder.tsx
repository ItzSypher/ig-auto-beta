"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type OnSelectionChangeParams,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import {
  NODE_META,
  PALETTE,
  PILOT_FLOW,
  emptyDataFor,
  type AppNode,
  type DmData,
  type LinkData,
  type NodeKind,
  type ReminderData,
  type TriggerData,
} from "@/lib/flow";
import { flowToRow } from "@/lib/automation-mapper";
import { nodeTypes } from "./NodeCards";
import { Inspector } from "./Inspector";

const STORAGE_KEY = "ig-auto:pilot-flow";

type Problem = { level: "erro" | "aviso"; text: string };

/** Checagens que evitam publicar um fluxo que a Meta vai recusar ou que trava no meio. */
function validate(nodes: AppNode[], edges: Edge[]): Problem[] {
  const out: Problem[] = [];
  const trigger = nodes.find((n) => n.type === "trigger");

  if (!trigger) {
    out.push({ level: "erro", text: "O fluxo não tem um bloco de gatilho." });
  } else {
    const t = trigger.data as TriggerData;
    if (!t.comment && !t.storyReply && !t.dm) {
      out.push({ level: "erro", text: "O gatilho não tem nenhuma origem marcada." });
    }
    if (t.matchType !== "any" && t.keywords.filter((k) => k.trim()).length === 0) {
      out.push({ level: "erro", text: "O gatilho não tem palavras-chave." });
    }
  }

  const connected = new Set<string>();
  for (const e of edges) {
    connected.add(e.source);
    connected.add(e.target);
  }
  for (const n of nodes) {
    if (n.type === "note" || n.id === trigger?.id) continue;
    if (!connected.has(n.id)) {
      out.push({
        level: "aviso",
        text: `O bloco "${NODE_META[n.type as NodeKind].title}" está solto, sem ligação.`,
      });
    }
  }

  const firstDm = nodes.find((n) => n.type === "dm");
  if (firstDm) {
    const d = firstDm.data as DmData;
    if (d.quickReplies.filter((b) => b.trim()).length === 0) {
      out.push({
        level: "aviso",
        text: "A DM não tem botão. Sem o toque da pessoa, a janela de 24h não abre e os próximos passos não saem.",
      });
    }
    if (!d.text.trim()) {
      out.push({ level: "erro", text: "A DM está sem texto." });
    }
  }

  for (const n of nodes) {
    if (n.type === "link") {
      const d = n.data as LinkData;
      if (!/^https?:\/\/.+/i.test(d.url)) {
        out.push({ level: "erro", text: "O bloco de link está com uma URL inválida." });
      }
    }
    if (n.type === "reminder") {
      const d = n.data as ReminderData;
      if (d.delayMinutes > 1440) {
        out.push({
          level: "erro",
          text: "O lembrete passa de 1440min (24h) e cairia fora da janela.",
        });
      }
    }
  }

  return out;
}

function Canvas() {
  const [nodes, setNodes, onNodesChange] = useNodesState<AppNode>(PILOT_FLOW.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(PILOT_FLOW.edges);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState("AUTOMAÇÃO DE POSTS");
  const [live, setLive] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [automationId, setAutomationId] = useState<string | undefined>();
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [showJson, setShowJson] = useState(false);
  const { screenToFlowPosition } = useReactFlow();

  // Carrega a automação do banco. Sem ela o motor não tem o que casar, então
  // o que está na tela precisa ser o que está gravado.
  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const r = await fetch("/api/automations");
        const { automacao } = await r.json();
        if (cancelado || !automacao) return;

        setAutomationId(automacao.id);
        setName(automacao.name ?? "");
        setLive(Boolean(automacao.active));

        const flow = automacao.flow;
        if (Array.isArray(flow?.nodes) && flow.nodes.length > 0) {
          setNodes(flow.nodes);
          setEdges(Array.isArray(flow.edges) ? flow.edges : []);
        }
      } catch {
        // Banco fora do ar: segue com o piloto na tela, sem apagar nada.
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [setNodes, setEdges]);

  const onConnect = useCallback(
    (c: Connection) => setEdges((eds) => addEdge({ ...c, animated: true }, eds)),
    [setEdges],
  );

  const onSelectionChange = useCallback((p: OnSelectionChangeParams) => {
    setSelectedId(p.nodes.length === 1 ? p.nodes[0].id : null);
  }, []);

  const selected = useMemo(
    () => nodes.find((n) => n.id === selectedId) ?? null,
    [nodes, selectedId],
  );

  const patch = useCallback(
    (data: Record<string, unknown>) => {
      setNodes((ns) =>
        ns.map((n) =>
          n.id === selectedId ? ({ ...n, data: { ...n.data, ...data } } as AppNode) : n,
        ),
      );
    },
    [selectedId, setNodes],
  );

  const removeSelected = useCallback(() => {
    if (!selectedId) return;
    setNodes((ns) => ns.filter((n) => n.id !== selectedId));
    setEdges((es) => es.filter((e) => e.source !== selectedId && e.target !== selectedId));
    setSelectedId(null);
  }, [selectedId, setNodes, setEdges]);

  const addNode = useCallback(
    (kind: NodeKind) => {
      if (NODE_META[kind].unique && nodes.some((n) => n.type === kind)) return;
      // Solta o bloco novo perto do centro visível, com um respingo para não empilhar.
      const center = screenToFlowPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      });
      const node = {
        id: `${kind}-${Date.now()}`,
        type: kind,
        position: {
          x: center.x + (Math.random() - 0.5) * 120,
          y: center.y + (Math.random() - 0.5) * 120,
        },
        data: emptyDataFor(kind),
      } as AppNode;
      setNodes((ns) => [...ns, node]);
      setSelectedId(node.id);
    },
    [nodes, screenToFlowPosition, setNodes],
  );

  const save = useCallback(
    async (ativo = live) => {
      setSalvando(true);
      setErro(null);
      // Cópia local do rascunho: se a rede cair, o trabalho não se perde.
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ name, live: ativo, nodes, edges }));
      try {
        const r = await fetch("/api/automations", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            ...flowToRow(name, ativo, nodes, edges),
            ...(automationId ? { id: automationId } : {}),
          }),
        });
        const body = await r.json();
        if (!r.ok) throw new Error(body?.erro ?? `HTTP ${r.status}`);
        if (body.id) setAutomationId(body.id);
        setSavedAt(new Date().toLocaleTimeString("pt-BR"));
      } catch (e) {
        setErro(`Não salvou no banco: ${String(e)}`);
      } finally {
        setSalvando(false);
      }
    },
    [name, live, nodes, edges, automationId],
  );

  // Publicar sem gravar já causou confusão: a tela mostrava LIVE e o motor
  // não tinha automação nenhuma. Agora o toggle grava na hora.
  const togglePublish = useCallback(() => {
    const proximo = !live;
    setLive(proximo);
    void save(proximo);
  }, [live, save]);

  const reset = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setNodes(PILOT_FLOW.nodes);
    setEdges(PILOT_FLOW.edges);
    setName("AUTOMAÇÃO DE POSTS");
    setLive(false);
    setSelectedId(null);
    setSavedAt(null);
  }, [setNodes, setEdges]);

  const problems = useMemo(() => validate(nodes, edges), [nodes, edges]);
  const errors = problems.filter((p) => p.level === "erro").length;

  // Abrir enquadrando o fluxo inteiro deixa os cards ilegíveis num fluxo longo.
  // Enquadramos só o começo, em zoom de leitura; o resto fica a um arrasto.
  const focusNodes = useMemo(
    () =>
      PILOT_FLOW.nodes
        .filter((n) => n.type !== "note")
        .slice(0, 3)
        .map((n) => ({ id: n.id })),
    [],
  );

  return (
    <div className="flex h-dvh flex-col bg-neutral-50">
      <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-neutral-200 bg-white px-4 py-2.5">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="Nome da automação"
          className="min-w-0 flex-1 rounded-lg border border-transparent px-2 py-1 text-[15px] font-semibold text-neutral-900 outline-none hover:border-neutral-200 focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10"
        />

        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${
            live ? "bg-emerald-100 text-emerald-700" : "bg-neutral-100 text-neutral-500"
          }`}
        >
          {live ? "Live" : "Rascunho"}
        </span>

        <button
          type="button"
          onClick={togglePublish}
          disabled={!live && errors > 0}
          title={
            !live && errors > 0 ? "Corrija os erros do fluxo antes de publicar" : undefined
          }
          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-[13px] font-medium text-neutral-800 transition hover:border-neutral-900 disabled:cursor-not-allowed disabled:border-neutral-200 disabled:text-neutral-400"
        >
          {live ? "Pausar" : "Publicar"}
        </button>

        <button
          type="button"
          onClick={() => setShowJson((v) => !v)}
          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-[13px] text-neutral-700 transition hover:border-neutral-900"
        >
          JSON
        </button>

        <button
          type="button"
          onClick={reset}
          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-[13px] text-neutral-700 transition hover:border-neutral-900"
        >
          Restaurar piloto
        </button>

        <button
          type="button"
          onClick={() => void save()}
          disabled={salvando}
          className="rounded-lg bg-neutral-900 px-3.5 py-1.5 text-[13px] font-medium text-white transition hover:bg-neutral-700"
        >
          {salvando ? "Salvando..." : "Salvar"}
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        <nav className="w-[188px] shrink-0 space-y-1 overflow-y-auto border-r border-neutral-200 bg-white p-3">
          <p className="px-1 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
            Blocos
          </p>
          {PALETTE.map((kind) => {
            const meta = NODE_META[kind];
            const blocked = meta.unique && nodes.some((n) => n.type === kind);
            return (
              <button
                key={kind}
                type="button"
                onClick={() => addNode(kind)}
                disabled={blocked}
                title={blocked ? "Só pode existir um gatilho" : meta.hint}
                className="flex w-full items-center gap-2 rounded-lg border border-neutral-200 px-2.5 py-2 text-left text-[13px] text-neutral-800 transition hover:border-neutral-900 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-neutral-200 disabled:hover:bg-white"
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: meta.accent }}
                />
                {meta.title}
              </button>
            );
          })}

          <div className="pt-3">
            <p className="px-1 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
              Checagem
            </p>
            {problems.length === 0 ? (
              <p className="px-1 text-[12px] text-emerald-600">Fluxo sem problemas.</p>
            ) : (
              <ul className="space-y-1.5">
                {problems.map((p, i) => (
                  <li
                    key={i}
                    className={`rounded-lg px-2 py-1.5 text-[11px] leading-snug ${
                      p.level === "erro"
                        ? "bg-rose-50 text-rose-700"
                        : "bg-amber-50 text-amber-800"
                    }`}
                  >
                    {p.text}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </nav>

        <main className="relative min-w-0 flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onSelectionChange={onSelectionChange}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.2, maxZoom: 1, nodes: focusNodes }}
            minZoom={0.2}
            proOptions={{ hideAttribution: false }}
            defaultEdgeOptions={{ animated: true, style: { stroke: "#a3a3a3" } }}
          >
            <Background variant={BackgroundVariant.Dots} gap={18} size={1} color="#d4d4d4" />
            <Controls showInteractive={false} />
            <MiniMap pannable zoomable className="!bg-white" />
          </ReactFlow>

          {savedAt && (
            <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-neutral-900/85 px-3 py-1.5 text-[12px] text-white">
              Salvo no banco às {savedAt}
            </div>
          )}

          {erro && (
            <div className="absolute bottom-3 left-1/2 max-w-[90%] -translate-x-1/2 rounded-lg bg-rose-600 px-3 py-2 text-[12px] text-white">
              {erro}
            </div>
          )}

          {showJson && (
            <div className="absolute right-3 top-3 max-h-[70%] w-[420px] overflow-auto rounded-xl border border-neutral-300 bg-white p-3 shadow-lg">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[12px] font-semibold text-neutral-700">
                  Fluxo serializado
                </span>
                <button
                  type="button"
                  onClick={() => setShowJson(false)}
                  aria-label="Fechar JSON"
                  className="rounded px-1.5 text-neutral-400 hover:bg-neutral-100"
                >
                  ×
                </button>
              </div>
              <pre className="whitespace-pre-wrap break-all text-[10px] leading-snug text-neutral-700">
                {JSON.stringify({ name, live, nodes, edges }, null, 2)}
              </pre>
            </div>
          )}
        </main>

        <Inspector
          node={selected}
          onPatch={patch}
          onDelete={removeSelected}
          onClose={() => setSelectedId(null)}
        />
      </div>
    </div>
  );
}

export function FlowBuilder() {
  return (
    <ReactFlowProvider>
      <Canvas />
    </ReactFlowProvider>
  );
}
