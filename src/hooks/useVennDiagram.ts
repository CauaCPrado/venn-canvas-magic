import { useCallback, useEffect, useRef, useState } from "react";
import {
  createBasicSet,
  createDerivedSet,
  deleteSets,
  emptyDiagram,
  updateSet,
  type Diagram,
  type VennSet,
} from "@/lib/venn-model";

const STORAGE_KEY = "venn-diagram-v2";
const MAX_HISTORY = 80;

export function useVennDiagram() {
  const [diagram, setDiagram] = useState<Diagram>(emptyDiagram);
  const [past, setPast] = useState<Diagram[]>([]);
  const [future, setFuture] = useState<Diagram[]>([]);
  const [loaded, setLoaded] = useState(false);
  const current = useRef(diagram);
  current.current = diagram;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Diagram;
        if (parsed && Array.isArray(parsed.sets)) {
          current.current = parsed;
          setDiagram(parsed);
        }
      }
    } catch {
      /* ignore */
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(diagram));
    } catch {
      /* ignore */
    }
  }, [diagram, loaded]);

  const apply = useCallback((next: Diagram) => {
    current.current = next;
    setDiagram(next);
  }, []);

  /** change that enters the undo history */
  const commit = useCallback(
    (updater: (d: Diagram) => Diagram) => {
      const before = current.current;
      const next = updater(before);
      if (next === before) return;
      setPast((p) => [...p, before].slice(-MAX_HISTORY));
      setFuture([]);
      apply(next);
    },
    [apply],
  );

  /** live change (drag in progress) — no history entry */
  const preview = useCallback(
    (updater: (d: Diagram) => Diagram) => {
      apply(updater(current.current));
    },
    [apply],
  );

  /** push a snapshot taken before a live change sequence */
  const pushHistory = useCallback((snapshot: Diagram) => {
    setPast((p) => [...p, snapshot].slice(-MAX_HISTORY));
    setFuture([]);
  }, []);

  const undo = useCallback(() => {
    const p = pastRef.current;
    if (p.length === 0) return;
    const prev = p[p.length - 1]!;
    const nextFuture = [current.current, ...futureRef.current].slice(0, MAX_HISTORY);
    const nextPast = p.slice(0, -1);
    pastRef.current = nextPast;
    futureRef.current = nextFuture;
    setPast(nextPast);
    setFuture(nextFuture);
    apply(prev);
  }, [apply]);

  const redo = useCallback(() => {
    const f = futureRef.current;
    if (f.length === 0) return;
    const next = f[0]!;
    const nextPast = [...pastRef.current, current.current].slice(-MAX_HISTORY);
    const nextFuture = f.slice(1);
    pastRef.current = nextPast;
    futureRef.current = nextFuture;
    setPast(nextPast);
    setFuture(nextFuture);
    apply(next);
  }, [apply]);

  const actions = {
    addBasic: (opts: { name?: string; elements?: string[]; count?: number }) =>
      commit((d) => createBasicSet(d, opts)),
    addDerived: (parentIds: string[], count: number) =>
      commit((d) => createDerivedSet(d, parentIds, count)),
    remove: (ids: string[]) => commit((d) => deleteSets(d, ids)),
    patch: (id: string, p: Partial<VennSet>) => commit((d) => updateSet(d, id, p)),
    patchLive: (id: string, p: Partial<VennSet>) => preview((d) => updateSet(d, id, p)),
    reset: () => commit(() => emptyDiagram()),
  };

  return {
    diagram,
    loaded,
    actions,
    commit,
    pushHistory,
    undo,
    redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
  };
}
