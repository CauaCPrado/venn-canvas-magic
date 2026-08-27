const SHORTCUTS: Array<[string, string]> = [
  ["Delete", "excluir conjuntos selecionados"],
  ["Ctrl + Z", "desfazer"],
  ["Ctrl + Y", "refazer"],
  ["Esc", "limpar seleção"],
  ["Ctrl + A", "selecionar todos"],
  ["Shift + clique", "seleção múltipla"],
  ["Setas", "mover conjunto selecionado"],
  ["Scroll / +  −", "zoom no canvas"],
];

export function ShortcutsHelp() {
  return (
    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
      {SHORTCUTS.map(([key, label]) => (
        <span key={key} className="flex items-center gap-1.5 text-[11px] text-ink-faint">
          <kbd className="rounded border border-border bg-field px-1.5 py-0.5 font-mono text-[10px] text-ink-soft">
            {key}
          </kbd>
          {label}
        </span>
      ))}
    </div>
  );
}
