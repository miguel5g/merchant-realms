# Rascunho da próxima changelog

> Acúmulo de alterações ainda não publicadas. Ao fechar a versão, converter os
> itens abaixo em uma nova entrada de `shared/Changelog.js` (campos `type`,
> `title`, `desc`) e esvaziar este arquivo.

---

## Não publicado

### novo — Categoria Blueprints na Fabricação

Nova aba **Blueprints** ao lado de Básico, Metais e Construção. Blueprints são
comprados **apenas com coroas** e não consomem nenhum material: o painel de
detalhes troca a lista de materiais por custo em coroas, produção da estrutura e
estoque máximo, e o botão passa a ser "Comprar ×1". A contagem `×N` na lista
mostra quantos o jogador consegue pagar com as coroas que tem.

### novo — Madeireira: primeira estrutura geradora

Blueprint da **Madeireira** por 120 coroas. É de **uso único**: ao ser colocada
no mundo (botão esquerdo), o blueprint é consumido e vira uma estrutura fixa que
produz **1 madeira a cada 15 segundos**, sozinha, acumulando até **24 unidades**.

O recurso **fica acumulado na estrutura até ser recolhido** — segure o botão
direito sobre a madeireira, como em qualquer recurso. Diferente de árvores e
rochas, ela **não é destruída ao esvaziar**: continua de pé e volta a produzir.
A produção continua enquanto o servidor está no ar e é retomada automaticamente
quando ele reinicia (estrutura e estoque são salvos no mundo).

### correcao — Coleta travada quando o estoque do cliente ficava defasado

A coleta dependia do estoque que o **cliente** tinha em cache. Se o navegador
perdesse as atualizações da estrutura (página aberta durante um reinício do
servidor, pacote não aplicado, sessão antiga), ele continuava achando que a
madeireira estava vazia e **bloqueava o envio da coleta** — a estrutura enchia
até o teto e segurar o botão direito não fazia absolutamente nada, sem nenhuma
mensagem de erro.

Agora o servidor é a autoridade sobre o estoque: mesmo achando que a estrutura
está vazia, o cliente tenta recolher uma vez por segundo. Se houver estoque de
verdade, a primeira tentativa já traz o valor correto e a coleta destrava
sozinha. Do outro lado, quando a coleta não rende nada o servidor devolve o
estado real do tile, então o cliente se corrige em vez de ficar preso.

### melhoria — Painel de inspeção reconhece estruturas geradoras

Ao mirar uma madeireira, o painel abaixo do minimapa mostra taxa de produção,
estoque atual sobre o máximo, barra de progresso e o aviso "produzindo — nada
para recolher ainda" quando ela está vazia. O realce amarelo do cursor não
aparece mais sobre uma estrutura sem estoque.

### melhoria — Bancada de trabalho removida do jogo

A **bancada de trabalho** foi removida por completo: receita, item de
inventário, entidade colocável, arte no mundo/minimapa e a única instância que
existia no mapa. A fabricação nunca exigiu estação — nenhuma outra receita tinha
a bancada como pré-requisito — e agora isso está explícito na interface
("na mão · sem estação"). Mundos salvos antes da mudança descartam a bancada
automaticamente ao carregar, e o terreno original volta no lugar.

### correcao — Janelas de troca e fabricação com conteúdo saindo para fora

Duas interfaces vazavam do próprio quadro em telas menores.

Na **troca**, o grid do inventário tinha largura fixa maior que a coluna que o
continha, então a janela ganhava barra de rolagem horizontal *e* vertical — era
preciso rolar para ver os 32 slots. Agora os slots são elásticos: o grid ocupa
exatamente o espaço disponível e as 4 linhas aparecem inteiras, sem rolagem
nenhuma, de 900×560 até 1920×1080.

Na **fabricação**, o painel de detalhes de um blueprint pedia mais altura do que
a janela tinha, e o excesso escorria para fora da borda — a dica "Shift+clique
fabrica o máximo", o total de coroas e a linha "Uso · único" apareciam por cima
ou abaixo do quadro. O conteúdo do detalhe passou a ficar contido, com os botões
Comprar/×10 sempre fixos no rodapé do painel.

Junto disso, as duas janelas ficaram um pouco maiores, as abas de categoria
quebram linha quando não cabem, e o nome de uma receita longa agora quebra em
duas linhas em vez de ser cortado com reticências.

---

## Notas técnicas (não vão para a changelog)

**Como adicionar um novo blueprint:** basta uma entrada em `GENERATORS`, em
[shared/constants.js](shared/constants.js). O item de inventário, a receita paga
em coroas e a estrutura colocável são gerados a partir dela:

```js
const GENERATORS = {
  madeireira: {
    tile: T.MADEIREIRA,  // id novo em T
    label: 'Madeireira',
    item: 'madeira',     // recurso produzido
    n: 1,                // unidades por ciclo
    interval: 15000,     // ms entre ciclos
    cap: 24,             // estoque máximo
    time: 260,           // ms por unidade ao recolher
    cost: 120,           // preço em coroas
    col: '#6b4a2f',
    desc: '...',
  },
};
```

Falta só desenhar o tile em `drawTile()` e a cor do minimapa em `MMCOL`
([public/js/renderer.js](public/js/renderer.js)).

**Pendências conhecidas:**

- Não há como demolir uma estrutura de blueprint depois de colocada — ela é
  permanente e bloqueia passagem, como um muro. Vale decidir se some sem
  devolver nada, se devolve o blueprint, ou se precisa de um gesto próprio
  (ex.: shift + botão direito) para não ser demolida por acidente durante a
  coleta.
- A madeireira produz para quem chegar primeiro: não tem dono nem controle de
  acesso.
- Recolher gasta 1 de energia por unidade, igual a minerar.
