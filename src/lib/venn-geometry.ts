export interface Circle {
  cx: number;
  cy: number;
  r: number;
}

export interface Pt {
  x: number;
  y: number;
}

const EPS = 1e-6;

export function dist(a: Pt, b: Pt) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function pointInCircle(p: Pt, c: Circle, eps = EPS) {
  const dx = p.x - c.cx;
  const dy = p.y - c.cy;
  return dx * dx + dy * dy <= (c.r + eps) * (c.r + eps);
}

export function pointInAll(p: Pt, circles: Circle[], eps = EPS) {
  return circles.every((c) => pointInCircle(p, c, eps));
}

export function circlePathD(c: Circle) {
  const { cx, cy, r } = c;
  return `M ${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx + r} ${cy} A ${r} ${r} 0 1 1 ${cx - r} ${cy} Z`;
}

function circleCirclePoints(a: Circle, b: Circle): Pt[] {
  const dx = b.cx - a.cx;
  const dy = b.cy - a.cy;
  const d = Math.hypot(dx, dy);
  if (d < EPS) return [];
  if (d > a.r + b.r - EPS) return [];
  if (d < Math.abs(a.r - b.r) + EPS) return [];
  const t = (a.r * a.r - b.r * b.r + d * d) / (2 * d);
  const hSq = a.r * a.r - t * t;
  if (hSq < 0) return [];
  const h = Math.sqrt(hSq);
  const mx = a.cx + (t * dx) / d;
  const my = a.cy + (t * dy) / d;
  const ox = (-dy * h) / d;
  const oy = (dx * h) / d;
  return [
    { x: mx + ox, y: my + oy },
    { x: mx - ox, y: my - oy },
  ];
}

function angleOn(c: Circle, p: Pt) {
  return Math.atan2(p.y - c.cy, p.x - c.cx);
}

function norm(a: number) {
  let v = a % (Math.PI * 2);
  if (v < 0) v += Math.PI * 2;
  return v;
}

/**
 * Exact boundary of the intersection of a list of circles, as an SVG path.
 * Returns null when the circles do not share any area.
 */
export function intersectionPathD(circles: Circle[]): string | null {
  if (circles.length === 0) return null;
  if (circles.length === 1) return circlePathD(circles[0]!);

  // one circle fully inside every other -> region is that circle
  for (const c of circles) {
    const contained = circles.every(
      (o) => o === c || Math.hypot(c.cx - o.cx, c.cy - o.cy) + c.r <= o.r + 1e-4,
    );
    if (contained) return circlePathD(c);
  }

  type Node = { p: Pt; on: number[] };
  const nodes: Node[] = [];
  const tol = 1e-3;
  for (let i = 0; i < circles.length; i++) {
    for (let j = i + 1; j < circles.length; j++) {
      for (const p of circleCirclePoints(circles[i]!, circles[j]!)) {
        let ok = true;
        for (let k = 0; k < circles.length; k++) {
          if (k === i || k === j) continue;
          if (!pointInCircle(p, circles[k]!, 1e-3)) {
            ok = false;
            break;
          }
        }
        if (!ok) continue;
        const existing = nodes.find((n) => dist(n.p, p) < tol);
        if (existing) {
          if (!existing.on.includes(i)) existing.on.push(i);
          if (!existing.on.includes(j)) existing.on.push(j);
        } else {
          nodes.push({ p, on: [i, j] });
        }
      }
    }
  }

  if (nodes.length < 2) return null;

  let sx = 0;
  let sy = 0;
  nodes.forEach((n) => {
    sx += n.p.x;
    sy += n.p.y;
  });
  const center = { x: sx / nodes.length, y: sy / nodes.length };
  nodes.sort(
    (a, b) =>
      Math.atan2(a.p.y - center.y, a.p.x - center.x) -
      Math.atan2(b.p.y - center.y, b.p.x - center.x),
  );

  let d = `M ${nodes[0]!.p.x.toFixed(3)} ${nodes[0]!.p.y.toFixed(3)}`;
  for (let n = 0; n < nodes.length; n++) {
    const from = nodes[n]!;
    const to = nodes[(n + 1) % nodes.length]!;
    const shared = from.on.filter((k) => to.on.includes(k));
    let chosen: { k: number; span: number } | null = null;
    for (const k of shared) {
      const c = circles[k]!;
      const a1 = angleOn(c, from.p);
      const a2 = angleOn(c, to.p);
      const span = norm(a2 - a1);
      const mid = a1 + span / 2;
      const mp = { x: c.cx + Math.cos(mid) * c.r, y: c.cy + Math.sin(mid) * c.r };
      if (pointInAll(mp, circles, 1e-3)) {
        if (!chosen || span < chosen.span) chosen = { k, span };
      }
    }
    if (!chosen) {
      d += ` L ${to.p.x.toFixed(3)} ${to.p.y.toFixed(3)}`;
      continue;
    }
    const c = circles[chosen.k]!;
    const large = chosen.span > Math.PI ? 1 : 0;
    d += ` A ${c.r.toFixed(3)} ${c.r.toFixed(3)} 0 ${large} 1 ${to.p.x.toFixed(3)} ${to.p.y.toFixed(3)}`;
  }
  return `${d} Z`;
}

/** base shape with holes punched out (rendered with fill-rule: evenodd) */
export function shapeWithHoles(base: string, holes: (string | null)[]) {
  return [base, ...holes.filter(Boolean)].join(" ");
}

export interface RegionSpec {
  /** point must be inside all of these */
  circles: Circle[];
  /** point must NOT be inside all circles of any of these groups */
  holes: Circle[][];
}

function bboxOf(circles: Circle[]) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  circles.forEach((c) => {
    minX = Math.min(minX, c.cx - c.r);
    minY = Math.min(minY, c.cy - c.r);
    maxX = Math.max(maxX, c.cx + c.r);
    maxY = Math.max(maxY, c.cy + c.r);
  });
  return { minX, minY, maxX, maxY };
}

export function inRegion(p: Pt, spec: RegionSpec) {
  if (!pointInAll(p, spec.circles)) return false;
  for (const h of spec.holes) {
    if (h.length && pointInAll(p, h, -0.5)) return false;
  }
  return true;
}

/**
 * Grid sample of a region with a chamfer distance transform, so labels can be
 * placed at the most "open" spots of an arbitrarily shaped slice.
 */
export function regionAnchors(spec: RegionSpec, count: number, step = 8): Pt[] {
  if (spec.circles.length === 0 || count <= 0) return [];
  const { minX, minY, maxX, maxY } = bboxOf(spec.circles);
  const w = Math.max(2, Math.ceil((maxX - minX) / step) + 1);
  const h = Math.max(2, Math.ceil((maxY - minY) / step) + 1);
  if (w * h > 400000) return [];
  const dist2 = new Float32Array(w * h);
  const BIG = 1e6;
  for (let gy = 0; gy < h; gy++) {
    for (let gx = 0; gx < w; gx++) {
      const p = { x: minX + gx * step, y: minY + gy * step };
      dist2[gy * w + gx] = inRegion(p, spec) ? BIG : 0;
    }
  }
  const D1 = 1;
  const D2 = Math.SQRT2;
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : dist2[y * w + x]!);
  for (let gy = 0; gy < h; gy++) {
    for (let gx = 0; gx < w; gx++) {
      const i = gy * w + gx;
      if (dist2[i] === 0) continue;
      dist2[i] = Math.min(
        dist2[i]!,
        at(gx - 1, gy) + D1,
        at(gx, gy - 1) + D1,
        at(gx - 1, gy - 1) + D2,
        at(gx + 1, gy - 1) + D2,
      );
    }
  }
  for (let gy = h - 1; gy >= 0; gy--) {
    for (let gx = w - 1; gx >= 0; gx--) {
      const i = gy * w + gx;
      if (dist2[i] === 0) continue;
      dist2[i] = Math.min(
        dist2[i]!,
        at(gx + 1, gy) + D1,
        at(gx, gy + 1) + D1,
        at(gx + 1, gy + 1) + D2,
        at(gx - 1, gy + 1) + D2,
      );
    }
  }

  const picks: Pt[] = [];
  const scores = Array.from(dist2);
  for (let n = 0; n < count; n++) {
    let best = -1;
    let bestVal = 0.4;
    for (let i = 0; i < scores.length; i++) {
      if (scores[i]! > bestVal) {
        bestVal = scores[i]!;
        best = i;
      }
    }
    if (best < 0) break;
    const bx = best % w;
    const by = Math.floor(best / w);
    picks.push({ x: minX + bx * step, y: minY + by * step });
    const clearCells = Math.max(2, Math.round(26 / step));
    for (let yy = by - clearCells; yy <= by + clearCells; yy++) {
      for (let xx = bx - clearCells; xx <= bx + clearCells; xx++) {
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        scores[yy * w + xx] = 0;
      }
    }
  }
  return picks;
}

export function regionExists(spec: RegionSpec) {
  return regionAnchors(spec, 1, 10).length > 0;
}
