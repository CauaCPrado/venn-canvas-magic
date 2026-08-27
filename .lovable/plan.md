# Editor de Diagramas de Venn

Um site de página única para criar, editar e manipular diagramas de Venn diretamente no navegador, sem login e sem backend.

## O que o usuário poderá fazer

- Escolher entre 2 ou 3 conjuntos (círculos) no diagrama.
- Editar o nome de cada conjunto e o texto de cada região (incluindo interseções).
- Arrastar cada círculo para reposicionar e usar um controle de tamanho (raio) por círculo.
- Alterar a cor de cada conjunto e a opacidade da mistura, com uma paleta pronta.
- Editar o título do diagrama.
- Desfazer/refazer as últimas alterações e resetar para o layout padrão.
- Exportar o diagrama como SVG ou PNG, e salvar automaticamente o trabalho no navegador (localStorage), para continuar depois.

## Layout

```text
+------------------------------------------------+
|  Cabeçalho: título editável + Exportar SVG/PNG |
+------------------+-----------------------------+
|                  |  Painel lateral             |
|   Canvas SVG     |  - Conjuntos (nome, cor,    |
|   (círculos      |    tamanho)                 |
|   arrastáveis)   |  - Textos das regiões       |
|                  |  - Aparência (opacidade,    |
|                  |    fundo, rótulos)          |
+------------------+-----------------------------+
```

## Design

Estilo editorial e limpo: fundo claro neutro, tipografia com contraste entre um display serifado para títulos e uma sans para a interface, acentos em tons de teal/âmbar/coral para os conjuntos. Sem gradientes roxos genéricos. Todos os tokens de cor definidos no design system em `src/styles.css`.

## Detalhes técnicos

- Rota única em `src/routes/index.tsx` (substitui o placeholder), com `head()` próprio (título, descrição, og/twitter).
- Estado do diagrama num hook `useVennDiagram` (conjuntos, posições, cores, textos, histórico undo/redo), persistido em localStorage lido dentro de `useEffect` para evitar mismatch de hidratação.
- Canvas em SVG puro: círculos com `mix-blend-mode: multiply`, arraste via eventos de ponteiro (pointerdown/move/up) com coordenadas convertidas para o viewBox.
- Rótulos das regiões posicionados por cálculo geométrico simples (centros e pontos médios das interseções), com possibilidade de ajuste ao arrastar os círculos.
- Exportação: serializar o `<svg>` para arquivo `.svg`; para PNG, desenhar o SVG num `<canvas>` e baixar via `toDataURL`.
- Componentes em `src/components/venn/` (VennCanvas, SetControls, RegionLabelsPanel, AppearancePanel, ExportMenu), usando shadcn (Slider, Input, Popover, Button, Tabs).
- Sem backend: nada de banco de dados nesta etapa. Contas e diagramas salvos na nuvem podem vir depois.
