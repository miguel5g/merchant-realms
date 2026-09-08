# Merchant Realms

> Domine a cadeia de suprimentos, domine o mundo.

Protótipo multiplayer (p5.js + Fastify).

```
npm install
npm start          # http://localhost:3000 (modo padrão)
npm run dev        # modo desenvolvimento com recarregamento automático
```

### Produção com PM2

```bash
# Iniciar em produção
npm run pm2:start
# ou: npx pm2 start ecosystem.config.js --env production

# Acompanhar logs
npm run pm2:logs

# Reiniciar
npm run pm2:restart

# Parar
npm run pm2:stop
```


Abra a URL em mais de uma aba (ou em outra máquina na rede, pelo IP) para jogar junto.

## Servidor

Variáveis de ambiente:

| variável       | padrão          | o que faz |
|----------------|-----------------|-----------|
| `PORT`         | 3000            | porta HTTP/WebSocket |
| `SEED`         | 1337            | seed do mundo (mesma seed = mesmo mapa) |
| `SERVER_NAME`  | Vale do Norte   | nome mostrado no menu |
| `MAX_PLAYERS`  | 50              | limite de jogadores |
| `PEERS`        | (vazio)         | URLs de outros servidores, separadas por vírgula, para aparecerem na lista do menu |
| `ADMINS`       | (vazio)         | nomes de jogadores com acesso aos comandos de administrador, separados por vírgula |

Exemplo com dois servidores na mesma máquina:

```
SERVER_NAME="Costa de Sal" SEED=42 PORT=3001 npm start
PEERS=http://localhost:3001 npm start
```

O mundo (`world.json`) e os perfis (`players.json`, por nome) são salvos a cada 10 s e ao encerrar com Ctrl+C.
Um dia de jogo dura 10 minutos reais; a cada dia novo cada jogador online recebe 10 coroas.

## Controles

WASD move · botão esquerdo coloca o item selecionado · botão direito quebra bloco/recurso (segure)
1–8 ou scroll seleciona na hotbar · E inventário e fabricação · Enter chat · T jogadores · P perfil · Esc fecha

Para negociar: T → clique no jogador → Negociar (precisa estar a até 5 tiles).

Para guardar coisas: botão esquerdo em um baú já colocado abre os 48 slots dele
junto com o seu inventário. Clique pega e solta a pilha, Shift+clique manda a
pilha inteira para o outro lado, Esc fecha. Cada baú tem seu próprio conteúdo,
salvo no mundo, e só pode ser quebrado depois de esvaziado.

## Comandos de chat

Digite `/` no chat para abrir a lista de comandos. O autocompletar sugere os
valores de cada campo (jogadores online, itens, blocos, coordenadas):
**Tab** completa, **↑↓** escolhem, **Esc** fecha. `<obrigatório>` e `[opcional]`.

| comando | o que faz |
|---------|-----------|
| `/w <jogador> <mensagem>` | sussurra para alguém |
| `/r <mensagem>`           | responde o último sussurro |
| `/g` · `/l` · `/t` `<mensagem>` | fala em global, local (20 tiles) ou comércio |
| `/kick <jogador> [motivo]` | expulsa um jogador do servidor |
| `/give <jogador> <item> [quantidade]` | entrega um item (1 se a quantidade for omitida) |
| `/place <x> <z> <bloco>`  | coloca um bloco em qualquer ponto do mundo |
| `/tp <x> <z>`             | você vai para a coordenada |
| `/tp <destino>`           | você vai até o jogador |
| `/tp <jogador> <destino>` | leva um jogador até outro |
| `/tp <jogador> <x> <z>`   | leva um jogador para a coordenada |

`/kick`, `/give`, `/place` e `/tp` são de administrador: só funcionam para
nomes listados em `ADMINS` e nem aparecem no autocompletar de quem não é. Itens e blocos aceitam
o nome com ou sem acento (`bau` acha `baú`) e com espaços (`placa de ferro`).
`/place` não tem limite de alcance: a única recusa é colocar um bloco sólido
num tile onde há um jogador de pé.

O `/tp` escolhe a forma pelo formato dos argumentos: **argumento só de dígitos
é coordenada, qualquer outro é nome de jogador** (ou seja, um jogador chamado
só com números não pode ser alvo do `/tp`). Enquanto se digita, o autocompletar
mostra as formas ainda possíveis e vai eliminando as que não encaixam mais.
Se a coordenada pedida cair na água, numa árvore ou dentro de um muro, o
teleporte vai para o chão firme mais próximo (até 6 tiles) — senão quem chegasse
lá ficaria travado, sem conseguir andar.

```
ADMINS="Miguel,Chefe" npm start
```

## Estrutura

```
shared/constants.js   definições, itens, blocos, receitas, perícias e constantes
shared/PerlinNoise.js classe de geração determinística de terreno
shared/Inventory.js   classe de inventário e gerenciamento de pilhas
shared/Crafting.js    classe e regras de receitas e fabricação
shared/Progression.js classe de níveis, títulos, perícias e conquistas
shared/GameTime.js    classe de ciclo de tempo e relógio
shared/World.js       classe de gestão e manipulação do mundo
shared/Commands.js    registro dos comandos de chat: argumentos, análise e valores válidos
shared/game.js        agregador e compatibilidade Node.js / browser
server.js             Fastify: estáticos, WebSocket, validação, chat, comércio, dia/noite, persistência
public/index.html     telas (menu, HUD, inventário, comércio, chat, perfil)
public/style.css      tokens visuais do design
public/client.js      renderização p5 + interface + rede
```
