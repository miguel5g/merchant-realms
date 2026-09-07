# Draft de Notas de Atualização (Changelog)

Este documento reúne todas as alterações em desenvolvimento para a próxima versão do jogo. Quando a versão for finalizada, estas notas serão consolidadas na changelog oficial (`shared/Changelog.js`).

---

## [Em Desenvolvimento] — Controles e Interação com o Mundo

### Controles & Jogabilidade
- **Inversão dos Botões de Interação**:
  - **Botão Esquerdo (Colocar)**: Coloca o item atualmente selecionado na hotbar no mundo, se ele for do tipo colocável (muros de pedra, baús, bancadas de trabalho). Caso nenhum slot esteja selecionado, o slot esteja vazio ou o item não seja colocável, o clique é ignorado de forma segura sem gerar erros no console.
  - **Botão Direito (Quebrar / Minerar)**: Quebra blocos e extrai recursos sob o cursor (árvores, rochas, minérios, muros, baús e bancadas), independente de qual item esteja selecionado na barra de acesso rápido.

### Validação de Colocação e Inventário
- **Checagem Completa de Posicionamento**:
  - Validação se a célula alvo do mapa está livre (sem água, obstáculos naturais ou outras construções).
  - Validação de distância de alcance do jogador (raio de 3 tiles / `REACH`).
  - Validação de sobreposição com o jogador: impede a colocação de blocos caso a caixa de colisão do próprio jogador (ou de outros jogadores conectados) sobreponha o tile desejado, evitando que o jogador fique preso dentro de estruturas.
  - O consumo de 1 unidade do item no inventário ocorre apenas se todas as validações forem aprovadas com sucesso. Se qualquer condição falhar, nada é consumido.

### Interface & Ajuda
- **Atualização de Instruções e Tutoriais**:
  - Indicador da hotbar (`#hb-label`) atualizado para exibir `· botão esquerdo coloca` ao selecionar itens de construção.
  - Janela de controles do menu inicial atualizada com `botão esquerdo colocar item selecionado` e `botão direito quebrar bloco/recurso (segure)`.
  - Tooltip de construções no mundo atualizado para indicar `botão direito para quebrar`.
  - Descrição dos itens colocáveis (`shared/constants.js`) e documentação (`README.md`) alinhados com o novo esquema de botões.
  - Cursor visual no jogo agora suprime o realce amarelo de colocação quando a célula sobrepõe a posição do jogador.

- **Lista de Fabricação (Craft) Enxuta**:
  - **Listagem Simplificada**: A lista de receitas no menu de fabricação agora exibe de forma limpa apenas o nome do item e a quantidade máxima que pode ser fabricada (`×N`) com os recursos atuais. Os materiais exigidos foram removidos da listagem para evitar poluição visual.
  - **Painel de Detalhes Dinâmico**: Os materiais necessários (com quantidade exigida e quantidade que o jogador possui no formato `possui / exige` colorido em verde/vermelho) agora só são exibidos no painel de detalhes após um item ser selecionado na lista.
  - **Estado Inicial Claro**: Ao abrir a tela ou trocar de categoria sem item selecionado, o painel de detalhes exibe uma mensagem amigável instruindo o jogador a clicar em uma receita para ver requisitos e fabricar.
  - **Botões de Fabricação Integrados**: Mantidos os botões de fabricação (`Fabricar ×1` e `×10`, além de suporte a Shift+clique) no painel de detalhes.

- **Painel Fixo de Inspeção de Recursos**:
  - **Substituição do Tooltip Flutuante**: O antigo tooltip de recursos que seguia o cursor pelo mapa foi removido e substituído por um painel elegante com posição e largura constantes (166px), fixado diretamente abaixo do minimapa no canto superior direito.
  - **Identificação Visual Completa**: Exibe o ícone pixel art do item (`.icon`), nome em destaque dourado e identificador (`recurso natural` ou `construção`).
  - **Informações Detalhadas & Barra de Progresso**: Mostra o item extraído (`Dá: ...`), quantidade restante acompanhada de barra de progresso visual, tempo de extração (`X,Xs / un`) e indicação de ferramenta aceleradora (`machado/picareta acelera` ou `com ferramenta`).
  - **Alertas Contextuais Semânticos**: Alertas claros de status (`fora de alcance`, `inventário cheio` e `sem energia`) sem poluir a área central de visão do jogador.
  - **Comportamento Limpo & Não Intrusivo**: O painel se oculta instantaneamente ao mover o mouse para áreas sem recursos, ao passar sobre outros elementos da interface ou ao abrir modais/menus, mantendo a tela desobstruída e sem nunca sobrepor outros componentes da HUD.

