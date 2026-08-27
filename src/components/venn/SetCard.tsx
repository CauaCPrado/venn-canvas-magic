import { Trash2 } from "lucide-react";
import { findSet, parseElements, totalSize, type Diagram, type VennSet } from "@/lib/venn-model";

interface Props {
  set: VennSet;
  diagram: Diagram;
  selected: boolean;
  onSelect: (id: string, additive: boolean) => void;
  onPatch: (id: string, patch: Partial<VennSet>) => void;
  onLivePatch: (id: string, patch: Partial<VennSet>) => void;
  onCommitLive: () => void;
  onDelete: (id: string) => void;
}

export function SetCard({
  set,
  diagram,
  selected,
  onSelect,
  onPatch,
  onLivePatch,
  onCommitLive,
  onDelete,
}: Props) {
  const derived = set.kind === "derived";
  return (
    <div
      onClick={(e) => onSelect(set.id, e.shiftKey)}
      className={`mb-2.5 cursor-pointer rounded-[11px] border bg-field p-3 transition ${
        selected ? "border-accent shadow-[0_0_0_3px_var(--color-accent-soft)]" : "border-border"
      } ${derived ? "border-l-[3px] border-l-ink" : ""}`}
    >
      <div className="mb-2 flex items-center gap-2">
        <input
          type="color"
          value={set.color}
          onChange={(e) => onLivePatch(set.id, { color: e.target.value })}
          onBlur={onCommitLive}
          className="size-5 shrink-0 cursor-pointer rounded-full border-0 bg-transparent p-0"
          title="Trocar cor"
        />
        <input
          type="text"
          value={set.name}
          onChange={(e) => onLivePatch(set.id, { name: e.target.value })}
          onBlur={onCommitLive}
          className="min-w-0 flex-1 border-0 bg-transparent font-display text-sm font-semibold text-ink outline-none"
        />
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(set.id);
          }}
          className="shrink-0 rounded-md p-1.5 text-ink-faint hover:bg-danger-soft hover:text-danger"
          title="Excluir (ou tecla Delete)"
        >
          <Trash2 className="size-4" />
        </button>
      </div>

      {derived && (
        <div className="mb-2 font-mono text-[11px] text-ink-faint">
          ∩ de {set.parentIds.map((pid) => findSet(diagram, pid)?.name ?? "—").join(", ")}
        </div>
      )}

      <textarea
        value={set.elements.join(", ")}
        onChange={(e) => onLivePatch(set.id, { elements: parseElements(e.target.value) })}
        onBlur={onCommitLive}
        placeholder="elementos nomeados, separados por vírgula (opcional)"
        className="field-input min-h-[52px] resize-y font-mono text-[12.5px] leading-relaxed"
      />

      <div className="mt-2 flex items-center gap-2">
        <label className="flex-1 text-[11.5px] text-ink-soft">+ elementos sem nome</label>
        <input
          type="number"
          min={0}
          value={set.count}
          onChange={(e) =>
            onLivePatch(set.id, { count: Math.max(0, Math.floor(Number(e.target.value) || 0)) })
          }
          onBlur={onCommitLive}
          className="w-16 rounded-md border border-border bg-panel px-2 py-1 font-mono text-[12.5px]"
        />
      </div>

      {!derived && (
        <div className="mt-2 flex items-center gap-2">
          <span className="w-12 text-[11px] text-ink-faint">raio</span>
          <input
            type="range"
            min={60}
            max={340}
            value={set.r}
            onChange={(e) => onLivePatch(set.id, { r: Number(e.target.value) })}
            onPointerUp={onCommitLive}
            className="flex-1 accent-[var(--color-accent)]"
          />
        </div>
      )}

      <div className="mt-1.5 font-mono text-[11px] text-ink-faint">
        {totalSize(set)} elemento{totalSize(set) === 1 ? "" : "s"}
        {set.count > 0 && set.elements.length > 0
          ? ` (${set.elements.length} nomeados + ${set.count} sem nome)`
          : ""}
      </div>
      <span className="sr-only">{onPatch ? "" : ""}</span>
    </div>
  );
}
