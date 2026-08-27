import { useCallback, useEffect, useState } from "react";
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

export function useVennDiagram() {
  const [diagram, setDiagram] = useState<Diagram>(emptyDiagram);
  const [past, setPast] = useState<Diagram[]>([]);
  const [future, setFuture] = useState<Diagram[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Diagram;
        if (parsed && Array.isArray(parsed.sets)) setDiagram(parsed);
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

  /** change that enters the undo history */
  const commit = useCallback((updater: (d: Diagram) => Diagram) => {
    setDiagram((current) => {
      const next = updater(current);
      if (next === current) return current;
      setPast((p) => [...p.slice(-59), current]);
      setFuture([]);
      return next;
    });
  }, []);

  /** live change (drag in progress) — no history entry */
  const preview = useCallback((updater: (d: Diagram) => Diagram) => {
    setDiagram((current) => updater(current));
  }, []);

  /** push a snapshot taken before a live change sequence */
  const pushHistory = useCallback((snapshot: Diagram) => {
    setPast((p) => [...p.slice(-59), snapshot]);
    setFuture([]);
  }, []);

  const undo = useCallback(() => {
    setPast((p) => {
      if (p.length === 0) return p;
      const prev = p[p.length - 1]!;
      setDiagram((current) => {
        setFuture((f) => [current, ...f.slice(0, 59)]);
        return prev;
      });
      return p.slice(0, -1);
    });
  }, []);

  const redo = useCallback(() => {
    setFuture((f) => {
      if (f.length === 0) return f;
      const next = f[0]!;
      setDiagram((current) => {
        setPast((p) => [...p, current]);
        return next;
      });
      return f.slice(1);
    });
  }, []);

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
