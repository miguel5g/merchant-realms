# Rascunho da próxima changelog

> Acúmulo de alterações ainda não publicadas. Ao fechar a versão, converter os
> itens abaixo em uma nova entrada de `shared/Changelog.js` (campos `type`,
> `title`, `desc`) e esvaziar este arquivo.

---

## Não publicado

**novo · Baú funcional: 48 slots de armazenamento por baú**

O baú deixou de ser decorativo. Cada baú colocado no mundo ganhou um
inventário próprio de **48 pilhas (6×8)**, independente de todos os outros e
salvo junto com o mundo — o conteúdo continua lá depois de um reinício do
servidor.

- **Abrir**: **botão esquerdo** sobre um baú já posto. Não há conflito com os
  controles atuais: um tile ocupado por um baú não aceita nada por cima, então
  o botão esquerdo fica livre para abrir. **Esc** (ou o botão Fechar) fecha.
- A janela mostra o baú em cima e o seu inventário embaixo, na mesma tela.
  **Clique** pega a pilha e o **segundo clique** solta no slot de destino, em
  qualquer um dos dois lados; **Shift+clique** manda a pilha inteira direto
  para o outro lado, empilhando no que já estiver lá. O limite de empilhamento
  de cada item é respeitado — 50 de material por slot, ferramentas uma a uma.
- Dois jogadores podem mexer no mesmo baú ao mesmo tempo: quem está com a
  janela aberta vê o conteúdo mudar na hora.
- O painel de inspeção passa a mostrar quantas pilhas o baú guarda, com barra
  de ocupação, e o cursor destaca em amarelo um baú ao alcance.

**melhoria · Regras de segurança do baú**

- Um baú com qualquer coisa dentro **não pode ser quebrado**: o servidor recusa
  a quebra e avisa quantas pilhas ainda estão lá dentro. O `/place` também
  recusa sobrescrever um baú com conteúdo.
- Um baú não pode ser guardado dentro de outro baú.
- Se o jogador acabar a mais de **4 tiles** do baú com a janela aberta (um
  `/tp`, por exemplo), a janela fecha sozinha; o mesmo vale se o baú for
  destruído por outra pessoa enquanto alguém o olha.

**novo · Autocompletar de comandos no chat**

Digitar `/` no chat abre uma lista com todos os comandos disponíveis e o que
cada um faz. Escolhido o comando, a lista passa a sugerir os valores do campo
sob o cursor: jogadores online (com a cor e o nível de cada um), itens do jogo
(com o ícone colorido), blocos colocáveis e as coordenadas da própria posição
para o `/place` e o `/tp`. **Tab** completa a sugestão em destaque, **↑↓** escolhem outra,
**Esc** fecha a lista sem fechar o chat. Uma linha no topo mostra a assinatura
do comando — `/give <jogador> <item> [quantidade]` — com o campo atual
destacado, deixando claro o que ainda falta preencher (`<>` obrigatório,
`[]` opcional). A busca ignora acentos e maiúsculas (`bau` acha `baú`) e valores
com espaço são completados inteiros (`pla` → `placa de ferro`).

**novo · Comandos de administrador: /kick, /give e /place**

Três comandos novos para quem administra o servidor:

- `/kick <jogador> [motivo]` desconecta um jogador. O motivo aparece para quem
  foi expulso e é anunciado no chat para todo mundo. O progresso é salvo
  normalmente antes da desconexão.
- `/give <jogador> <item> [quantidade]` coloca um item direto no inventário de
  alguém (1 unidade se a quantidade for omitida, até 999). Ferramentas chegam
  com a durabilidade cheia e o servidor avisa se parte não coube no inventário.
- `/place <x> <z> <bloco>` coloca qualquer bloco do jogo em qualquer ponto do
  mundo, sem limite de alcance — inclusive terreno (água, areia, grama, pedra),
  recursos (árvore, rocha, ferro, cobre) e estruturas (muro, baú, madeireira).
  Uma madeireira colocada assim já entra produzindo. A única recusa é bloquear
  um tile onde há um jogador de pé.

Só quem está listado na variável `ADMINS` do servidor pode usá-los; para os
demais os comandos nem aparecem no autocompletar, e o servidor recusa de novo
caso alguém tente pela rede. Ao entrar, um administrador recebe no chat a lista
do que tem disponível.

**novo · /tp: teleporte para coordenada, para um jogador ou de um jogador para outro**

O `/tp` tem quatro formas e escolhe sozinho qual usar pelo que foi digitado:

- `/tp <x> <z>` leva você para a coordenada;
- `/tp <destino>` leva você até um jogador;
- `/tp <jogador> <destino>` leva um jogador até outro;
- `/tp <jogador> <x> <z>` leva um jogador para a coordenada — com o
  autocompletar sugerindo a sua própria posição, vira o atalho para "traga
  essa pessoa até mim".

A regra é simples: argumento só de dígitos é coordenada, qualquer outro é nome
de jogador. Enquanto se digita, o painel mostra as formas ainda possíveis, cada
uma com uma explicação, e vai eliminando as que não encaixam mais — o comando
se explica sozinho conforme é escrito. Se a coordenada pedida cair na água,
numa árvore ou dentro de um muro, o teleporte desvia para o chão firme mais
próximo e avisa; sem isso, quem chegasse lá ficaria travado sem conseguir andar.
Todo mundo envolvido é avisado no chat: quem foi movido, quem mandou mover e
quem recebeu alguém em cima.

**melhoria · Mensagem de saída mais clara ao ser expulso**

Quem é expulso volta ao menu com o motivo escrito na tela, em vez do
"Desconectado do servidor." genérico. No chat, quem foi expulso aparece como
expulso — não mais como se tivesse saído por conta própria.

**novo · Carvão: o minério comum da montanha**

Terceiro minério do jogo, ao lado do ferro e do cobre. Aparece só na rocha
alta, em veios com um canal de ruído próprio, e é o **mais comum dos três**:
ocupa cerca de **5,6% do mundo**, contra 4,3% do ferro e 3,7% do cobre — o
chão de pedra transitável da montanha cede espaço a ele (9,7% → 4,0%), mas as
faixas de ferro e de cobre continuam exatamente como eram.

- Cada bloco rende **10 carvões** e some ao esvaziar. Cada unidade leva
  **0,42s** (0,25s com picareta), mais rápida que a do ferro e a do cobre —
  são 4,2s por bloco inteiro, contra 6,4s de um bloco de ferro.
- Empilha **50 por slot**, como qualquer material, e conta para a perícia de
  **Mineração**, igual aos outros minérios.
- **Não é fundido em barra**: existe para ser queimado. Vai ser o combustível
  da fornalha.
- No mundo e no minimapa aparece como pepitas em cinza-ardósia escuro; no
  inventário tem ícone próprio na mesma cor.
- Entra no `/place carvao` e no `/give <jogador> carvao` sem nenhum ajuste no
  autocompletar.

**correcao · Mineração parava em silêncio com o inventário cheio**

Segurar o botão direito sobre um recurso que não cabia no inventário não fazia
nada: nenhum aviso, nenhum bloco quebrado, e o cursor ainda por cima ficava
**amarelo**, dizendo que dava para minerar. O painel de inspeção era o único
lugar que avisava ("inventário cheio"), e quem não estivesse olhando para ele
só via a mineração não acontecer.

O problema aparecia de vez em quando com item já conhecido e passou a aparecer
sempre com **item novo**: um inventário de 32 slots ocupados ainda aceita mais
ferro se houver uma pilha de ferro pela metade, mas não tem onde começar a
primeira pilha de carvão. Foi exatamente assim que o carvão apareceu como
"minerando e não vem nada".

- O cursor deixa de ficar amarelo quando o item não cabe.
- Um aviso na tela diz qual recurso não coube, no máximo uma vez a cada 4s.

---

## Notas técnicas (não vão para a changelog)

**Como adicionar um novo minério:** três entradas em
[shared/constants.js](shared/constants.js) — o id em `T`, o item em `ITEMS` e o
recurso em `RES` (com `skill:'ore'`) — mais a faixa de geração em `baseTile()`
([shared/World.js](shared/World.js)), o nome do bloco em `BLOCK_LABELS`
([shared/Commands.js](shared/Commands.js)) e a cor do minimapa em `MMCOL`
([public/js/renderer.js](public/js/renderer.js)). O `drawTile()` desenha
qualquer tile com `skill:'ore'` como pepitas na cor do item, então minério novo
já nasce com arte. Tudo o mais — limite de pilha, painel de inspeção, tooltip,
perícia, valor de troca, persistência — sai sozinho de `RES`/`ITEMS`.

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
([public/js/renderer.js](public/js/renderer.js)). O nome do bloco para o
`/place` sai sozinho da chave do `GENERATORS` (`madeireira`).

**Como adicionar um novo comando:** uma entrada em `COMMANDS`, em
[shared/Commands.js](shared/Commands.js). O autocompletar, a assinatura na
interface, as mensagens de erro de uso e a análise no servidor saem todos dela:

```js
{
  name: 'give', scope: 'server', admin: true,
  desc: 'Entrega um item para um jogador.',
  args: [
    { name: 'jogador', type: 'player' },              // tipo = o que autocompletar
    { name: 'item', type: 'item', greedy: true },     // greedy junta o resto (aceita espaços)
    { name: 'quantidade', type: 'int', opt: true, tail: true },  // opcional numérico no fim
  ],
}
```

- `scope: 'chat'` resolve no cliente (vira mensagem de canal); `scope: 'server'`
  manda a linha crua e o servidor executa — nesse caso, acrescentar a função em
  `commands` no [server.js](server.js).
- Para assinaturas alternativas, trocar `args` por `forms: [{ desc, args }, ...]`
  (como no `/tp`). A forma é escolhida pela quantidade de argumentos e pelo
  formato de cada um — `tokenFits()` decide, hoje pela regra "só dígitos =
  coordenada". Repetir o mesmo nome de argumento entre formas é proposital:
  quem executa lê `v.jogador`/`v.destino` e trata a ausência como padrão, sem
  precisar saber qual forma casou.
- `type` novo pede duas coisas: `optionsForArg()` em
  [public/js/ui/chatcmd.js](public/js/ui/chatcmd.js) (o que sugerir) e, se o
  valor puder ter espaço, `isComplete()` em `Commands.js` (para o argumento
  greedy saber quando terminou).

**Pendências conhecidas:**

- Não há como demolir uma estrutura de blueprint depois de colocada — ela é
  permanente e bloqueia passagem, como um muro. Vale decidir se some sem
  devolver nada, se devolve o blueprint, ou se precisa de um gesto próprio
  (ex.: shift + botão direito) para não ser demolida por acidente durante a
  coleta.
- A madeireira produz para quem chegar primeiro: não tem dono nem controle de
  acesso.
- Recolher gasta 1 de energia por unidade, igual a minerar.
- `ADMINS` é por nome de jogador, sem senha: quem entrar com um nome da lista é
  administrador. Só faz sentido enquanto não existir conta com autenticação.
- `/kick` não impede a pessoa de entrar de novo em seguida — não há banimento
  nem tempo de espera.
- Um jogador cujo nome seja só dígitos (`42`) não pode ser alvo do `/tp`: o
  argumento é lido como coordenada. Nomes assim são válidos no cadastro, então
  a saída seria pedir o nome com um prefixo ou aspas.
- O `/tp` não deixa rastro: não há histórico de para onde alguém foi levado
  além das linhas de log do servidor.
