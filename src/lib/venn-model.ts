import type { Circle } from "./venn-geometry";

export type SetKind = "basic" | "derived";

export interface VennSet {
  id: string;
  kind: SetKind;
  name: string;
  color: string;
  elements: string[];
  count: number;
  // basic only
  cx: number;
  cy: number;
  r: number;
  // derived only
  parentIds: string[];
  // derived only: free translation away from the geometric intersection
  offsetX?: number;
  offsetY?: number;
}

export const MAX_BASIC_SETS = 3;

export function basicCount(d: Diagram) {
  return d.sets.filter((s) => s.kind === "basic").length;
}

/**
 * "Somente X": total of X minus the exclusive values of every derived set whose
 * basic ancestors strictly contain X's ancestors (computed recursively, bottom-up,
 * so a triple intersection is never subtracted twice).
 */
export function exclusiveSize(d: Diagram, id: string, memo = new Map<string, number>()): number {
  const cached = memo.get(id);
  if (cached !== undefined) return cached;
  const s = findSet(d, id);
  if (!s) return 0;
  const own = flattenParents(d, id);
  const key = basicKey(own);
  const seenKeys = new Set<string>();
  let sub = 0;
  d.sets.forEach((o) => {
    if (o.kind !== "derived" || o.id === id) return;
    const ob = flattenParents(d, o.id);
    if (ob.length <= own.length || !own.every((x) => ob.includes(x))) return;
    const ok = basicKey(ob);
    if (ok === key || seenKeys.has(ok)) return;
    seenKeys.add(ok);
    sub += exclusiveSize(d, o.id, memo);
  });
  const v = totalSize(s) - sub;
  memo.set(id, v);
  return v;
}

/** union total without double counting = sum of all exclusive regions (negatives clamp to 0) */
export function unionTotal(d: Diagram) {
  const memo = new Map<string, number>();
  const seen = new Set<string>();
  let sum = 0;
  d.sets.forEach((s) => {
    const k = basicKey(flattenParents(d, s.id));
    if (seen.has(k)) return;
    seen.add(k);
    sum += Math.max(0, exclusiveSize(d, s.id, memo));
  });
  return sum;
}

export interface Diagram {
  sets: VennSet[];
  nextId: number;
  colorIdx: number;
}

export const WORLD_W = 1400;
export const WORLD_H = 900;

export const PALETTE = [
  "#E2725B",
  "#2D9CDB",
  "#E3B23C",
  "#8E6FCE",
  "#3FA772",
  "#D45A88",
  "#4E8FE0",
  "#C77B3B",
];

export function parseElements(raw: string) {
  const seen = new Set<string>();
  const out: string[] = [];
  raw
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((v) => {
      if (!seen.has(v)) {
        seen.add(v);
        out.push(v);
      }
    });
  return out;
}

export function totalSize(s: VennSet) {
  return s.elements.length + s.count;
}

export function findSet(d: Diagram, id: string) {
  return d.sets.find((s) => s.id === id);
}

export function blendColors(hexes: string[]) {
  let r = 0;
  let g = 0;
  let b = 0;
  hexes.forEach((h) => {
    const n = parseInt(h.slice(1), 16);
    r += (n >> 16) & 255;
    g += (n >> 8) & 255;
    b += n & 255;
  });
  const n = hexes.length || 1;
  const hex = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v / n)))
      .toString(16)
      .padStart(2, "0");
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

export function darken(hex: string, amount = 55) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, ((n >> 16) & 255) - amount);
  const g = Math.max(0, ((n >> 8) & 255) - amount);
  const b = Math.max(0, (n & 255) - amount);
  return `rgb(${r},${g},${b})`;
}

/** all basic ancestors of a set */
export function flattenParents(d: Diagram, id: string, seen = new Set<string>()): string[] {
  if (seen.has(id)) return [];
  seen.add(id);
  const s = findSet(d, id);
  if (!s) return [];
  if (s.kind !== "derived") return [id];
  const out: string[] = [];
  s.parentIds.forEach((pid) => out.push(...flattenParents(d, pid, seen)));
  return [...new Set(out)];
}

export function circleOf(s: VennSet): Circle {
  return { cx: s.cx, cy: s.cy, r: s.r };
}

export function emptyDiagram(): Diagram {
  return { sets: [], nextId: 1, colorIdx: 0 };
}

export function createBasicSet(
  d: Diagram,
  opts: { name?: string; elements?: string[]; count?: number },
): Diagram {
  if (basicCount(d) >= MAX_BASIC_SETS) return d;
  const id = `s${d.nextId}`;
  const color = PALETTE[d.colorIdx % PALETTE.length]!;
  const idx = d.sets.filter((s) => s.kind === "basic").length;
  // first three sets sit on a triangle so they already share a common area
  const angle = -Math.PI / 2 + (idx % 3) * ((Math.PI * 2) / 3);
  const ring = 115 + Math.floor(idx / 3) * 90;
  const centerX = WORLD_W / 2 + Math.floor(idx / 3) * 40;
  const centerY = WORLD_H / 2;
  const set: VennSet = {
    id,
    kind: "basic",
    name: opts.name?.trim() || `Conjunto ${d.nextId}`,
    color,
    elements: opts.elements ?? [],
    count: Math.max(0, Math.floor(opts.count ?? 0)),
    cx: centerX + Math.cos(angle) * ring,
    cy: centerY + Math.sin(angle) * ring,
    r: 170,
    parentIds: [],
  };
  return { sets: [...d.sets, set], nextId: d.nextId + 1, colorIdx: d.colorIdx + 1 };
}

export function createDerivedSet(d: Diagram, parentIds: string[], count: number): Diagram {
  const parents = parentIds.map((id) => findSet(d, id)).filter(Boolean) as VennSet[];
  if (parents.length < 2) return d;
  const id = `s${d.nextId}`;
  const joined = parents.map((p) => p.name).join("");
  const name = joined.length <= 16 ? joined : parents.map((p) => p.name).join(" ∩ ");
  let common = parents[0]!.elements.slice();
  for (let i = 1; i < parents.length; i++) {
    const s = new Set(parents[i]!.elements);
    common = common.filter((e) => s.has(e));
  }
  const set: VennSet = {
    id,
    kind: "derived",
    name,
    color: blendColors(parents.map((p) => p.color)),
    elements: common,
    count: Math.max(0, Math.floor(count)),
    cx: 0,
    cy: 0,
    r: 0,
    parentIds: [...parentIds],
    offsetX: 0,
    offsetY: 0,
  };
  return { ...d, sets: [...d.sets, set], nextId: d.nextId + 1 };
}

export function deleteSets(d: Diagram, ids: string[]): Diagram {
  const toRemove = new Set(ids);
  let changed = true;
  while (changed) {
    changed = false;
    d.sets.forEach((s) => {
      if (
        s.kind === "derived" &&
        !toRemove.has(s.id) &&
        s.parentIds.some((pid) => toRemove.has(pid))
      ) {
        toRemove.add(s.id);
        changed = true;
      }
    });
  }
  return { ...d, sets: d.sets.filter((s) => !toRemove.has(s.id)) };
}

export function updateSet(d: Diagram, id: string, patch: Partial<VennSet>): Diagram {
  return { ...d, sets: d.sets.map((s) => (s.id === id ? { ...s, ...patch } : s)) };
}

/** key of a derived slice = sorted basic ancestors */
export function basicKey(ids: string[]) {
  return [...new Set(ids)].sort().join("|");
}
