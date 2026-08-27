# Editor de Diagramas de Venn — versão revisada

Site de página única (sem login e sem backend) para criar conjuntos, arrastá-los no canvas, extrair interseções como novos conjuntos e exportar o resultado. Base visual e de comportamento: o protótipo HTML enviado (Fraunces + Inter + IBM Plex Mono, fundo quadriculado azul-claro, painel lateral à esquerda, canvas à direita).

## Mudanças pedidas nesta revisão

### 1. Conjuntos sem elementos nomeados mostram só o número

- Se o conjunto tem apenas quantidade (sem nomes), o círculo exibe um número grande centralizado (ex: `12`) com a legenda do nome, em vez de espalhar bolinhas.
- Se o conjunto tem elementos nomeados, eles continuam aparecendo como chips posicionados na região correta.
- Caso misto (nomes + quantidade extra), aparecem os chips nomeados mais um contador discreto `+7` na mesma região.

### 2. Recorte permanente: o conjunto pai fica "mordido"

- Ao transformar uma interseção em conjunto próprio, a área da interseção é removida de verdade dos conjuntos pais: os pais passam a ser desenhados como forma recortada (círculo menos a lente), permanentemente.
- O recorte só volta ao normal quando a interseção é apagada ou a ação é desfeita (Ctrl+Z).
- Os elementos e o contador dos pais são reposicionados para caber apenas na área restante.

### 3. Formas geométricas exatas

- A interseção extraída tem a forma exata da área comum (lente entre 2 círculos, ou o polígono curvo formado por 3+ círculos), desenhada com arcos SVG reais — nada de aproximação por círculo cortado.
- A "mordida" no pai é o complemento exato dessa mesma forma, então as peças encaixam perfeitamente ao serem reposicionadas.
- Ao arrastar ou redimensionar um círculo, as formas são recalculadas ao vivo. Se a interseção deixar de existir geometricamente, o conjunto derivado fica marcado como "sem região" e o pai volta inteiro até haver sobreposição de novo.

### 4. Área de edição maior

- Canvas maior e responsivo, ocupando a largura disponível, com altura ajustável arrastando a borda inferior.
- Controles de zoom (`+`, `−`, "ajustar à tela") e navegação por arraste do fundo (pan), para trabalhar confortavelmente com muitos conjuntos.
- Botão para recolher o painel lateral e usar a tela inteira, além do modo tela cheia do canvas.

### 5. Atalhos de teclado

- `Delete` / `Backspace`: excluir os conjuntos selecionados no canvas (sem diálogo de confirmação, já que há desfazer).
- `Ctrl+Z` (`Cmd+Z`): desfazer. `Ctrl+Y` e `Ctrl+Shift+Z`: refazer.
- Extras coerentes: `Esc` limpa a seleção, `Ctrl+A` seleciona todos, setas movem o conjunto selecionado, `Shift+clique` para seleção múltipla.
- Os atalhos ficam desativados enquanto o foco está num campo de texto do painel.
- Uma lista dos atalhos aparece num painel de ajuda no rodapé do canvas.

## Detalhes técnicos

- Rota única em `src/routes/index.tsx` (substitui o placeholder), com `head()` próprio.
- Estado central num reducer (`sets`, `selection`, `viewport`) com pilhas de histórico `past`/`future` para undo/redo; cada ação estrutural (criar, excluir, extrair interseção, mover/redimensionar ao soltar) empurra um snapshot. Persistência em localStorage lida dentro de `useEffect`.
- Módulo de geometria `src/lib/venn-geometry.ts`: interseção círculo-círculo, ordenação dos pontos de borda, construção do path da região comum com comandos `A` (arcos) e construção do complemento via `fill-rule: evenodd` num único `<path>` por conjunto pai (subtraindo todas as regiões já extraídas).
- Posicionamento de rótulos/chips por amostragem em grade dentro da forma resultante (reaproveitando a abordagem do protótipo), com escolha do ponto mais distante dos já ocupados.
- Canvas SVG com `viewBox` controlado por estado de zoom/pan; arraste via eventos de ponteiro convertidos para coordenadas do viewBox.
- Design system em `src/styles.css` com os tokens do protótipo (oklch), fontes carregadas por `<link>` no `__root.tsx`.
- Componentes em `src/components/venn/`: `VennCanvas`, `SetCard`, `NewSetPanel`, `SelectionBar`, `OpsPanel`, `ShortcutsHelp`, `ExportMenu` (SVG e PNG).
