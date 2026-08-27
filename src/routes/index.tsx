import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  Maximize2,
  Minus,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Redo2,
  Scissors,
  Undo2,
} from "lucide-react";
import { VennCanvas, type Viewport } from "@/components/venn/VennCanvas";
import { SetCard } from "@/components/venn/SetCard";
import { ShortcutsHelp } from "@/components/venn/ShortcutsHelp";
import { useVennDiagram } from "@/hooks/useVennDiagram";
import {
  WORLD_H,
  WORLD_W,
  circleOf,
  findSet,
  flattenParents,
  parseElements,
  totalSize,
  type Diagram,
  type VennSet,
} from "@/lib/venn-model";
import { intersectionPathD } from "@/lib/venn-geometry";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Diagramas de Venn — editor visual de conjuntos" },
      {
        name: "description",
        content:
          "Crie conjuntos, arraste os círculos, extraia interseções com recorte exato e exporte seu diagrama de Venn em SVG ou PNG.",
      },
      { property: "og:title", content: "Diagramas de Venn — editor visual de conjuntos" },
      {
        property: "og:description",
        content:
          "Editor de diagramas de Venn com recorte geométrico exato, atalhos de teclado e exportação em SVG e PNG.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: VennPage,
});

const DEFAULT_VIEW: Viewport = { x: 0, y: 0, w: WORLD_W, h: WORLD_H };

function VennPage() {
  const { diagram, actions, commit, pushHistory, undo, redo, canUndo, canRedo } = useVennDiagram();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [viewport, setViewport] = useState<Viewport>(DEFAULT_VIEW);
  const [canvasHeight, setCanvasHeight] = useState(620);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [newName, setNewName] = useState("");
  const [newElements, setNewElements] = useState("");
  const [newQty, setNewQty] = useState(0);
  const [interQty, setInterQty] = useState(0);
  const svgRef = useRef<SVGSVGElement>(null);
  const diagramRef = useRef(diagram);
  diagramRef.current = diagram;
  const dragSnapshot = useRef<Diagram | null>(null);

  const selectedSets = useMemo(
    () => diagram.sets.filter((s) => selected.has(s.id)),
    [diagram.sets, selected],
  );

  const toggleSelect = useCallback((id: string | null, additive: boolean) => {
    setSelected((prev) => {
      if (!id) return new Set();
      const next = new Set(additive ? prev : []);
      if (additive && prev.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleDragStart = useCallback(() => {
    dragSnapshot.current = diagramRef.current;
  }, []);

  const handleDragMove = useCallback(
    (id: string, cx: number, cy: number) => {
      if (dragSnapshot.current) {
        pushHistory(dragSnapshot.current);
        dragSnapshot.current = null;
      }
      actions.patchLive(id, { cx, cy });
    },
    [actions, pushHistory],
  );

  const liveSnapshot = useRef<Diagram | null>(null);
  const livePatch = useCallback(
    (id: string, patch: Partial<VennSet>) => {
      if (!liveSnapshot.current) liveSnapshot.current = diagramRef.current;
      actions.patchLive(id, patch);
    },
    [actions],
  );
  const commitLive = useCallback(() => {
    if (liveSnapshot.current) {
      pushHistory(liveSnapshot.current);
      liveSnapshot.current = null;
    }
  }, [pushHistory]);

  const deleteSelected = useCallback(() => {
    if (selected.size === 0) return;
    actions.remove([...selected]);
    setSelected(new Set());
  }, [actions, selected]);

  // keyboard shortcuts
  useEffect(() => {
    const isTyping = () => {
      const el = document.activeElement;
      if (!el) return false;
      const tag = el.tagName.toLowerCase();
      return tag === "input" || tag === "textarea" || (el as HTMLElement).isContentEditable;
    };
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z") {
        if (isTyping()) return;
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && e.key.toLowerCase() === "y") {
        if (isTyping()) return;
        e.preventDefault();
        redo();
        return;
      }
      if (isTyping()) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        deleteSelected();
        return;
      }
      if (e.key === "Escape") {
        setSelected(new Set());
        return;
      }
      if (mod && e.key.toLowerCase() === "a") {
        e.preventDefault();
        setSelected(new Set(diagramRef.current.sets.map((s) => s.id)));
        return;
      }
      if (e.key.startsWith("Arrow") && selected.size > 0) {
        e.preventDefault();
        const step = e.shiftKey ? 24 : 6;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        commit((d) => ({
          ...d,
          sets: d.sets.map((s) =>
            selected.has(s.id) && s.kind === "basic" ? { ...s, cx: s.cx + dx, cy: s.cy + dy } : s,
          ),
        }));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, deleteSelected, selected, commit]);

  const zoomBy = (factor: number) => {
    setViewport((vp) => {
      const nextW = Math.min(4000, Math.max(300, vp.w * factor));
      const k = nextW / vp.w;
      const cx = vp.x + vp.w / 2;
      const cy = vp.y + vp.h / 2;
      const nextH = vp.h * k;
      return { x: cx - nextW / 2, y: cy - nextH / 2, w: nextW, h: nextH };
    });
  };

  const fitToContent = () => {
    const basics = diagram.sets.filter((s) => s.kind === "basic");
    if (basics.length === 0) {
      setViewport(DEFAULT_VIEW);
      return;
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    basics.forEach((s) => {
      minX = Math.min(minX, s.cx - s.r);
      minY = Math.min(minY, s.cy - s.r);
      maxX = Math.max(maxX, s.cx + s.r);
      maxY = Math.max(maxY, s.cy + s.r);
    });
    const pad = 60;
    const w = Math.max(300, maxX - minX + pad * 2);
    const h = Math.max(200, maxY - minY + pad * 2);
    const ratio = WORLD_W / WORLD_H;
    const finalW = Math.max(w, h * ratio);
    const finalH = finalW / ratio;
    setViewport({
      x: (minX + maxX) / 2 - finalW / 2,
      y: (minY + maxY) / 2 - finalH / 2,
      w: finalW,
      h: finalH,
    });
  };

  const startResize = (e: React.PointerEvent) => {
    const startY = e.clientY;
    const startH = canvasHeight;
    const move = (ev: PointerEvent) => {
      setCanvasHeight(Math.min(1400, Math.max(320, startH + (ev.clientY - startY))));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const canExtract = useMemo(() => {
    if (selectedSets.length < 2) return false;
    const basicIds = [...new Set(selectedSets.flatMap((s) => flattenParents(diagram, s.id)))];
    if (basicIds.length < 2) return false;
    const circles = basicIds
      .map((id) => findSet(diagram, id))
      .filter(Boolean)
      .map((s) => circleOf(s as VennSet));
    return intersectionPathD(circles) !== null;
  }, [selectedSets, diagram]);

  const extractIntersection = () => {
    actions.addDerived(
      selectedSets.map((s) => s.id),
      interQty,
    );
    setInterQty(0);
    setSelected(new Set());
  };

  const exportSvg = () => {
    const svg = svgRef.current;
    if (!svg) return;
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("width", String(Math.round(viewport.w)));
    clone.setAttribute("height", String(Math.round(viewport.h)));
    inlineVars(clone);
    const blob = new Blob([new XMLSerializer().serializeToString(clone)], {
      type: "image/svg+xml;charset=utf-8",
    });
    downloadBlob(blob, "diagrama-venn.svg");
  };

  const exportPng = () => {
    const svg = svgRef.current;
    if (!svg) return;
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const w = Math.round(viewport.w);
    const h = Math.round(viewport.h);
    clone.setAttribute("width", String(w));
    clone.setAttribute("height", String(h));
    inlineVars(clone);
    const data = new XMLSerializer().serializeToString(clone);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = w * 2;
      canvas.height = h * 2;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (blob) downloadBlob(blob, "diagrama-venn.png");
      });
    };
    img.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(data)))}`;
  };

  return (
    <main className="mx-auto max-w-[1500px] px-5 pb-16 pt-7">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <svg viewBox="0 0 44 44" className="size-11 shrink-0" aria-hidden>
            <circle cx="17" cy="20" r="13" fill="#E2725B" fillOpacity="0.55" stroke="#E2725B" />
            <circle cx="27" cy="20" r="13" fill="#2D9CDB" fillOpacity="0.55" stroke="#2D9CDB" />
          </svg>
          <div>
            <h1 className="text-[30px]">Diagramas de Venn</h1>
            <p className="mt-1 text-sm text-ink-soft">
              crie conjuntos, arraste os círculos e recorte interseções como novos conjuntos
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn-soft" onClick={undo} disabled={!canUndo} title="Ctrl + Z">
            <Undo2 className="size-4" /> Desfazer
          </button>
          <button className="btn-soft" onClick={redo} disabled={!canRedo} title="Ctrl + Y">
            <Redo2 className="size-4" /> Refazer
          </button>
          <button className="btn-soft" onClick={exportSvg}>
            <Download className="size-4" /> SVG
          </button>
          <button className="btn-primary" onClick={exportPng}>
            <Download className="size-4" /> PNG
          </button>
        </div>
      </header>

      <div
        className="grid items-start gap-5"
        style={{ gridTemplateColumns: sidebarOpen ? "320px minmax(0,1fr)" : "minmax(0,1fr)" }}
      >
        {sidebarOpen && (
          <aside className="space-y-4">
            <section className="panel">
              <h2 className="mb-3 text-base">Novo conjunto</h2>
              <label className="mb-1 block text-xs font-semibold text-ink-soft">Nome</label>
              <input
                className="field-input mb-2.5"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="ex: Frutas"
              />
              <label className="mb-1 block text-xs font-semibold text-ink-soft">
                Elementos nomeados (opcional)
              </label>
              <textarea
                className="field-input mb-2.5 min-h-[52px] font-mono text-[12.5px]"
                value={newElements}
                onChange={(e) => setNewElements(e.target.value)}
                placeholder="maçã, banana, uva"
              />
              <div className="mb-3 flex items-center gap-2">
                <label className="flex-1 text-[11.5px] text-ink-soft">+ elementos sem nome</label>
                <input
                  type="number"
                  min={0}
                  value={newQty}
                  onChange={(e) => setNewQty(Math.max(0, Number(e.target.value) || 0))}
                  className="w-16 rounded-md border border-border bg-field px-2 py-1 font-mono text-[12.5px]"
                />
              </div>
              <button
                className="btn-primary w-full"
                onClick={() => {
                  actions.addBasic({
                    name: newName,
                    elements: parseElements(newElements),
                    count: newQty,
                  });
                  setNewName("");
                  setNewElements("");
                  setNewQty(0);
                }}
              >
                <Plus className="size-4" /> Criar conjunto
              </button>
            </section>

            <section className="panel">
              <h2 className="mb-2 text-base">Conjuntos</h2>
              <p className="mb-3 text-[11.5px] leading-relaxed text-ink-faint">
                Conjuntos só com quantidade mostram o número dentro da área. Interseções extraídas
                aparecem com barra lateral e recortam permanentemente os pais.
              </p>
              {diagram.sets.length === 0 ? (
                <p className="text-[12.5px] text-ink-faint">Nenhum conjunto ainda.</p>
              ) : (
                diagram.sets.map((s) => (
                  <SetCard
                    key={s.id}
                    set={s}
                    diagram={diagram}
                    selected={selected.has(s.id)}
                    onSelect={toggleSelect}
                    onLivePatch={livePatch}
                    onCommitLive={commitLive}
                    onDelete={(id) => {
                      actions.remove([id]);
                      setSelected(new Set());
                    }}
                  />
                ))
              )}
            </section>
          </aside>
        )}

        <div>
          <section className="panel">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  className="btn-soft"
                  onClick={() => setSidebarOpen((v) => !v)}
                  title="Recolher painel"
                >
                  {sidebarOpen ? (
                    <PanelLeftClose className="size-4" />
                  ) : (
                    <PanelLeftOpen className="size-4" />
                  )}
                </button>
                <button className="btn-soft" onClick={() => zoomBy(1 / 1.25)} title="Aproximar">
                  <Plus className="size-4" />
                </button>
                <button className="btn-soft" onClick={() => zoomBy(1.25)} title="Afastar">
                  <Minus className="size-4" />
                </button>
                <button className="btn-soft" onClick={fitToContent}>
                  <Maximize2 className="size-4" /> Ajustar
                </button>
                <button className="btn-soft" onClick={() => setCanvasHeight((h) => h + 200)}>
                  Aumentar altura
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {selectedSets.length > 0 && (
                  <span className="font-mono text-[11.5px] text-ink-faint">
                    {selectedSets.map((s) => s.name).join(" ∩ ")}
                  </span>
                )}
                <input
                  type="number"
                  min={0}
                  value={interQty}
                  onChange={(e) => setInterQty(Math.max(0, Number(e.target.value) || 0))}
                  className="w-16 rounded-md border border-border bg-field px-2 py-1 font-mono text-[12.5px]"
                  title="Elementos sem nome na interseção"
                />
                <button className="btn-primary" onClick={extractIntersection} disabled={!canExtract}>
                  <Scissors className="size-4" /> Extrair interseção
                </button>
              </div>
            </div>

            <VennCanvas
              diagram={diagram}
              selected={selected}
              viewport={viewport}
              height={canvasHeight}
              onViewportChange={setViewport}
              onSelect={toggleSelect}
              onDragStart={handleDragStart}
              onDragMove={handleDragMove}
              svgRef={svgRef}
            />

            <div
              onPointerDown={startResize}
              className="mx-auto mt-1.5 h-2.5 w-28 cursor-ns-resize rounded-full bg-border hover:bg-accent-soft"
              title="Arraste para mudar a altura da área de edição"
            />

            <ShortcutsHelp />
          </section>

          <section className="panel mt-4">
            <h2 className="mb-2 text-base">Resumo</h2>
            {diagram.sets.length === 0 ? (
              <p className="text-[12.5px] text-ink-faint">
                Crie conjuntos para ver os totais aqui.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {diagram.sets.map((s) => (
                  <span
                    key={s.id}
                    className="flex items-center gap-2 rounded-lg border border-border bg-field px-2.5 py-1 font-mono text-[11.5px]"
                  >
                    <span
                      className="size-2.5 rounded-full"
                      style={{ backgroundColor: s.color }}
                    />
                    {s.name}: {totalSize(s)}
                  </span>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function inlineVars(svg: SVGSVGElement) {
  const styles = getComputedStyle(document.documentElement);
  const map: Record<string, string> = {
    "var(--color-panel)": styles.getPropertyValue("--panel").trim() || "#fff",
    "var(--color-border)": styles.getPropertyValue("--border").trim() || "#d7e0e9",
    "var(--color-ink)": styles.getPropertyValue("--ink").trim() || "#1e2a33",
    "var(--color-ink-faint)": styles.getPropertyValue("--ink-faint").trim() || "#93a2af",
  };
  svg.querySelectorAll("*").forEach((el) => {
    ["fill", "stroke"].forEach((attr) => {
      const v = el.getAttribute(attr);
      if (v && map[v]) el.setAttribute(attr, map[v]!);
    });
  });
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
