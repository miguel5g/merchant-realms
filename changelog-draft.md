# Rascunho da próxima changelog

> Acúmulo de alterações ainda não publicadas. Ao fechar a versão, converter os
> itens abaixo em uma nova entrada de `shared/Changelog.js` (campos `type`,
> `title`, `desc`) e esvaziar este arquivo.

---

## Não publicado

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
