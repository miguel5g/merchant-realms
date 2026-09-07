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

Chat: `/w nome msg` sussurra, `/r msg` responde, `/l` local (20 tiles), `/t` comércio, `/g` global.
Para negociar: T → clique no jogador → Negociar (precisa estar a até 5 tiles).

## Estrutura

```
shared/constants.js   definições, itens, blocos, receitas, perícias e constantes
shared/PerlinNoise.js classe de geração determinística de terreno
shared/Inventory.js   classe de inventário e gerenciamento de pilhas
shared/Crafting.js    classe e regras de receitas e fabricação
shared/Progression.js classe de níveis, títulos, perícias e conquistas
shared/GameTime.js    classe de ciclo de tempo e relógio
shared/World.js       classe de gestão e manipulação do mundo
shared/game.js        agregador e compatibilidade Node.js / browser
server.js             Fastify: estáticos, WebSocket, validação, chat, comércio, dia/noite, persistência
public/index.html     telas (menu, HUD, inventário, comércio, chat, perfil)
public/style.css      tokens visuais do design
public/client.js      renderização p5 + interface + rede
```
