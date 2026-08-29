import { useEffect, useMemo, useRef, type PointerEvent as ReactPointerEvent } from "react";
import {
  circlePathD,
  intersectionPathD,
  regionAnchors,
  shapeWithHoles,
  type Circle,
  type Pt,
} from "@/lib/venn-geometry";
import {
  circleOf,
  darken,
  findSet,
  flattenParents,
  type Diagram,
  type VennSet,
} from "@/lib/venn-model";

export interface Viewport {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface ShapeInfo {
  set: VennSet;
  basicIds: string[];
  circles: Circle[];
  path: string | null;
  holes: string[];
  nameAt: Pt | null;
  chips: Array<{ text: string; at: Pt }>;
  countAt: Pt | null;
  countValue: number;
  countBig: boolean;
}

interface Props {
  diagram: Diagram;
  selected: Set<string>;
  viewport: Viewport;
  height: number;
  onViewportChange: (v: Viewport) => void;
  onSelect: (id: string | null, additive: boolean) => void;
  onDragStart: () => void;
  onDragMove: (id: string, cx: number, cy: number) => void;
  svgRef: React.RefObject<SVGSVGElement | null>;
}

const MIN_ZOOM_W = 300;
const MAX_ZOOM_W = 4000;

export function VennCanvas({
  diagram,
  selected,
  viewport,
  height,
  onViewportChange,
  onSelect,
  onDragStart,
  onDragMove,
  svgRef,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; dx: number; dy: number; moved: boolean } | null>(null);
  const panRef = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);
  const stateRef = useRef({ viewport, onViewportChange });
  stateRef.current = { viewport, onViewportChange };

  const shapes = useMemo(() => buildShapes(diagram), [diagram]);

  // wheel zoom (native, non-passive)
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const { viewport: vp, onViewportChange: change } = stateRef.current;
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
      const rect = el.getBoundingClientRect();
      const factor = Math.exp(dy * 0.0015);
      const nextW = Math.min(MAX_ZOOM_W, Math.max(MIN_ZOOM_W, vp.w * factor));
      const k = nextW / vp.w;
      const px = (e.clientX - rect.left) / rect.width;
      const py = (e.clientY - rect.top) / rect.height;
      const wx = vp.x + px * vp.w;
      const wy = vp.y + py * vp.h;
      change({
        x: wx - px * nextW,
        y: wy - py * vp.h * k,
        w: nextW,
        h: vp.h * k,
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const toWorld = (clientX: number, clientY: number): Pt => {
    const el = wrapRef.current;
    if (!el) return { x: 0, y: 0 };
    const rect = el.getBoundingClientRect();
    return {
      x: viewport.x + ((clientX - rect.left) / rect.width) * viewport.w,
      y: viewport.y + ((clientY - rect.top) / rect.height) * viewport.h,
    };
  };

  const handleShapePointerDown = (e: ReactPointerEvent, info: ShapeInfo) => {
    e.stopPropagation();
    if (info.set.kind !== "basic") {
      onSelect(info.set.id, e.shiftKey);
      return;
    }
    const p = toWorld(e.clientX, e.clientY);
    onDragStart();
    dragRef.current = {
      id: info.set.id,
      dx: p.x - info.set.cx,
      dy: p.y - info.set.cy,
      moved: false,
    };
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const shift = e.shiftKey;

    const move = (ev: globalThis.PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const wp = toWorld(ev.clientX, ev.clientY);
      d.moved = true;
      onDragMove(d.id, wp.x - d.dx, wp.y - d.dy);
    };
    const up = () => {
      const d = dragRef.current;
      dragRef.current = null;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      if (d && !d.moved) onSelect(d.id, shift);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const handleBackgroundPointerDown = (e: ReactPointerEvent) => {
    const start = { x: e.clientX, y: e.clientY, vx: viewport.x, vy: viewport.y };
    panRef.current = start;
    const el = wrapRef.current;
    let moved = false;
    const move = (ev: globalThis.PointerEvent) => {
      if (!el || !panRef.current) return;
      const rect = el.getBoundingClientRect();
      const dx = ((ev.clientX - start.x) / rect.width) * viewport.w;
      const dy = ((ev.clientY - start.y) / rect.height) * viewport.h;
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) moved = true;
      onViewportChange({ ...viewport, x: start.vx - dx, y: start.vy - dy });
    };
    const up = () => {
      panRef.current = null;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      if (!moved) onSelect(null, false);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const missing = shapes.filter((s) => s.set.kind === "derived" && !s.path);

  return (
    <div>
      <div
        ref={wrapRef}
        className="relative overflow-hidden rounded-[10px] border border-border bg-canvas"
        style={{
          height,
          touchAction: "none",
          backgroundImage:
            "linear-gradient(var(--color-grid-line) 1px, transparent 1px), linear-gradient(90deg, var(--color-grid-line) 1px, transparent 1px)",
          backgroundSize: "22px 22px, 22px 22px",
        }}
      >
        <svg
          ref={svgRef}
          className="h-full w-full select-none"
          viewBox={`${viewport.x} ${viewport.y} ${viewport.w} ${viewport.h}`}
          preserveAspectRatio="xMidYMid meet"
          onPointerDown={handleBackgroundPointerDown}
        >
          <rect
            x={viewport.x}
            y={viewport.y}
            width={viewport.w}
            height={viewport.h}
            fill="transparent"
          />
          {shapes.map((info) =>
            info.path ? (
              <path
                key={`shape-${info.set.id}`}
                className="venn-shape"
                d={shapeWithHoles(info.path, info.holes)}
                fillRule="evenodd"
                fill={info.set.color}
                fillOpacity={selected.has(info.set.id) ? 0.4 : 0.24}
                stroke={info.set.color}
                strokeWidth={selected.has(info.set.id) ? 3.5 : 2}
                strokeDasharray={selected.has(info.set.id) ? "8 5" : undefined}
                onPointerDown={(e) => handleShapePointerDown(e, info)}
              />
            ) : null,
          )}

          {shapes.map((info) => {
            if (!info.path) return null;
            const ink = darken(info.set.color);
            return (
              <g key={`labels-${info.set.id}`} pointerEvents="none">
                {info.nameAt && (
                  <g>
                    <rect
                      x={info.nameAt.x - (info.set.name.length * 8 + 18) / 2}
                      y={info.nameAt.y - 16}
                      width={info.set.name.length * 8 + 18}
                      height={24}
                      rx={7}
                      fill="var(--color-panel)"
                      fillOpacity={info.set.kind === "derived" ? 0.92 : 0.7}
                      stroke={info.set.kind === "derived" ? ink : "none"}
                      strokeWidth={1.2}
                    />
                  <text
                    x={info.nameAt.x}
                    y={info.nameAt.y}
                    textAnchor="middle"
                    fill={ink}
                    fontFamily="Fraunces, Georgia, serif"
                    fontStyle="italic"
                    fontWeight={600}
                    fontSize={17}
                  >
                    {info.set.name}
                  </text>
                  </g>
                )}
                {info.countAt && info.countValue > 0 && (
                  <text
                    x={info.countAt.x}
                    y={info.countAt.y}
                    textAnchor="middle"
                    fill={ink}
                    fontFamily="IBM Plex Mono, monospace"
                    fontWeight={600}
                    fontSize={info.countBig ? 44 : 15}
                    opacity={info.countBig ? 0.9 : 0.75}
                  >
                    {info.countBig ? info.countValue : `+${info.countValue}`}
                  </text>
                )}
                {info.chips.map((chip, i) => (
                  <g key={i}>
                    <rect
                      x={chip.at.x - (chip.text.length * 6.2 + 14) / 2}
                      y={chip.at.y - 10}
                      width={chip.text.length * 6.2 + 14}
                      height={20}
                      rx={6}
                      fill="var(--color-panel)"
                      stroke="var(--color-border)"
                    />
                    <text
                      x={chip.at.x}
                      y={chip.at.y + 4}
                      textAnchor="middle"
                      fill="var(--color-ink)"
                      fontFamily="IBM Plex Mono, monospace"
                      fontSize={11}
                    >
                      {chip.text}
                    </text>
                  </g>
                ))}
              </g>
            );
          })}

          {diagram.sets.length === 0 && (
            <text
              x={viewport.x + viewport.w / 2}
              y={viewport.y + viewport.h / 2}
              textAnchor="middle"
              fill="var(--color-ink-faint)"
              fontFamily="Inter, sans-serif"
              fontSize={16}
            >
              Crie um conjunto para começar
            </text>
          )}
        </svg>
      </div>

      {missing.length > 0 && (
        <div className="mt-3 rounded-[10px] border border-dashed border-danger/40 bg-danger-soft px-3.5 py-3">
          <h3 className="font-sans text-[12.5px] font-bold text-danger">
            {missing.length} interseção{missing.length === 1 ? "" : "s"} sem área visível
          </h3>
          <p className="mt-1 text-[12px] leading-relaxed text-ink-soft">
            Arraste os conjuntos até eles se sobreporem de novo — enquanto isso os pais voltam
            inteiros:{" "}
            {missing.map((m) => m.set.name).join(", ")}
          </p>
        </div>
      )}
    </div>
  );
}

function buildShapes(diagram: Diagram): ShapeInfo[] {
  const basics = diagram.sets.filter((s) => s.kind === "basic");
  const derived = diagram.sets.filter((s) => s.kind === "derived");

  const derivedResolved = derived.map((d) => {
    const basicIds = flattenParents(diagram, d.id);
    const circles = basicIds
      .map((id) => findSet(diagram, id))
      .filter(Boolean)
      .map((s) => circleOf(s as VennSet));
    const path = circles.length >= 2 ? intersectionPathD(circles) : null;
    return { set: d, basicIds, circles, path };
  });

  const infoFor = (set: VennSet, basicIds: string[], circles: Circle[], path: string | null) => {
    // holes = extracted intersections that are strict sub-regions of this shape
    const own = new Set(basicIds);
    const holeSources = derivedResolved.filter((o) => {
      if (o.set.id === set.id || !o.path) return false;
      if (o.basicIds.length <= own.size) return false;
      return basicIds.every((id) => o.basicIds.includes(id));
    });
    const holes = holeSources.map((h) => h.path!) as string[];

    const spec = { circles, holes: holeSources.map((h) => h.circles) };
    const namedCount = set.elements.length;
    const wantsBigNumber = namedCount === 0 && set.count > 0;
    const wanted = 1 + namedCount + (set.count > 0 && !wantsBigNumber ? 1 : 0);
    const anchors = path ? regionAnchors(spec, wanted, 8, 62) : [];

    const nameAt = anchors[0] ?? null;
    let countAt: Pt | null = null;
    const chips: Array<{ text: string; at: Pt }> = [];
    if (wantsBigNumber) {
      countAt = nameAt ? { x: nameAt.x, y: nameAt.y + 40 } : null;
    } else {
      set.elements.forEach((el, i) => {
        const at = anchors[i + 1];
        if (at) chips.push({ text: el, at });
      });
      if (set.count > 0) {
        const at = anchors[namedCount + 1];
        if (at) countAt = at;
      }
    }

    return {
      set,
      basicIds,
      circles,
      path,
      holes,
      nameAt,
      chips,
      countAt,
      countValue: set.count,
      countBig: wantsBigNumber,
    } satisfies ShapeInfo;
  };

  const basicShapes = basics.map((s) => infoFor(s, [s.id], [circleOf(s)], circlePathD(circleOf(s))));
  const derivedShapes = derivedResolved.map((d) =>
    infoFor(d.set, d.basicIds, d.circles, d.path),
  );

  return [...basicShapes, ...derivedShapes];
}
