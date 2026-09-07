# Rascunho da próxima changelog

> Acúmulo de alterações ainda não publicadas. Ao fechar a versão, converter os
> itens abaixo em uma nova entrada de `shared/Changelog.js` (campos `type`,
> `title`, `desc`) e esvaziar este arquivo.

---

## Não publicado

_(nada acumulado — última versão publicada: v0.5.0)_

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
