/* ============================================================
   server.js — servidor autoritativo (Fastify + WebSocket).
   Regras vêm de shared/game.js. Aqui: rede, validação,
   chat, comércio, tempo, progressão e persistência.
   ============================================================ */
const path = require('path');
const fs = require('fs');
const Fastify = require('fastify');
const G = require('./shared/game.js');

const PORT = +process.env.PORT || 3000;
const SEED = +process.env.SEED || 1337;
const SERVER_NAME = process.env.SERVER_NAME || 'Vale do Norte';
const MAX_PLAYERS = +process.env.MAX_PLAYERS || 50;
const PEERS = (process.env.PEERS || '').split(',').map(s => s.trim()).filter(Boolean); // outros servidores, só para listar no menu
const ADMINS = new Set((process.env.ADMINS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean)); // nomes com acesso a /kick, /give e /place
const WORLD_FILE = path.join(__dirname, 'world.json');
const PLAYERS_FILE = path.join(__dirname, 'players.json');

/* ---------- estado ---------- */
const world = new G.World(SEED);
const chests = new Map();       // "x,y" -> Inventory de 48 slots, um por baú colocado
let epoch = Date.now();
if (fs.existsSync(WORLD_FILE)) {
  const snap = JSON.parse(fs.readFileSync(WORLD_FILE, 'utf8'));
  world.load(snap); if (snap.epoch) epoch = snap.epoch;
  loadChests(snap.chests);
  console.log(`mundo carregado: ${world.overrides.size} tiles alterados, ${chests.size} baús, dia ${G.gameTime(Date.now(), epoch).day}`);
}
const genNext = new Map();      // "x,y" -> timestamp do próximo ciclo de produção
for (const [x, y] of world.generators()) armGenerator(x, y);

const profiles = fs.existsSync(PLAYERS_FILE) ? JSON.parse(fs.readFileSync(PLAYERS_FILE, 'utf8')) : {};
let dirty = false;
const players = new Map();      // id -> player online
const trades = new Map();       // tradeId -> trade
const chatLog = [];             // últimas mensagens públicas
let nextId = 1, nextTrade = 1, lastDay = G.gameTime(Date.now(), epoch).day;

const newStats = () => ({ mined:0, ore:0, wood:0, stone:0, built:0, crafted:0, trades:0, canceled:0, chunks:[], playMs:0, maxDay:0, maxCoins:0, with:{} });

/* ---------- helpers ---------- */
function send(p, type, data = {}) { if (p.socket.readyState === 1) p.socket.send(JSON.stringify({ type, ...data })); }
function broadcast(type, data, filter) { for (const p of players.values()) if (!filter || filter(p)) send(p, type, data); }
function tileMsg(x, y) { return { x, y, t: world.tile(x, y), amount: world.amount(x, y) }; }
function publicInfo(p) { return { id:p.id, name:p.name, col:p.col, x:Math.round(p.x), y:Math.round(p.y), item:p.inv.slots[p.sel]?.item || null, level:G.levelFromXp(p.xp) }; }
function sendInv(p) { send(p, 'inv', { slots:p.inv.slots, equip:p.equip }); }
function sendMe(p) { send(p, 'me', { coins:p.coins, xp:p.xp, energy:Math.round(p.energy), stats:p.stats, col:p.col, achievements:achievementsOf(p) }); }
function achievementsOf(p) { return G.ACHIEVEMENTS.filter(a => a.test(p.stats)).map(a => a.id); }
function sys(text, p, extra = {}) { const m = { type:'sys', text, day:now().day, ...extra }; if (p) send(p, 'sys', m); else broadcast('sys', m); }
function now() { return G.gameTime(Date.now(), epoch); }
function isAdmin(name) { return ADMINS.has(String(name).toLowerCase()); }
function findByName(name) { name = name.toLowerCase(); for (const p of players.values()) if (p.name.toLowerCase() === name) return p; return null; }
function gainXp(p, n) { const before = G.levelFromXp(p.xp); p.xp += n; const after = G.levelFromXp(p.xp); if (after > before) sys(`Você chegou ao nível ${after} — ${G.titleFor(after)}.`, p); }
function checkAchievements(p) {
  const had = p.ach, have = achievementsOf(p);
  for (const id of have) if (!had.includes(id)) { const a = G.ACHIEVEMENTS.find(a => a.id === id); sys(`Conquista: ${a.label} — ${a.desc}`, p); }
  p.ach = have;
}
function touch(p) { checkAchievements(p); sendMe(p); dirty = true; }

/* ---------- estruturas geradoras (blueprints) ---------- */
function genDef(x, y) { return G.GEN_BY_TILE[world.tile(x, y)] || null; }
function armGenerator(x, y) {
  const def = genDef(x, y);
  if (def) genNext.set(`${x},${y}`, Date.now() + def.interval);
  else genNext.delete(`${x},${y}`);
}
function tickGenerators() {
  const nowMs = Date.now();
  for (const [k, at] of genNext) {
    const [x, y] = k.split(',').map(Number);
    const def = genDef(x, y);
    if (!def) { genNext.delete(k); continue; }     // estrutura removida
    if (nowMs < at) continue;
    genNext.set(k, nowMs + def.interval);
    const stock = world.amount(x, y);
    if (stock >= def.cap) continue;                // cheia: espera ser recolhida
    world.setAmount(x, y, Math.min(def.cap, stock + def.n));
    broadcast('tile', tileMsg(x, y));
    dirty = true;
  }
}

/* ---------- baús ----------
   O conteúdo mora aqui, indexado pelo tile, e não no item: cada baú posto no
   mundo tem seu próprio inventário, salvo junto com world.json. O cliente
   recebe só a contagem de pilhas de cada baú (para o painel de inspeção) e o
   conteúdo completo apenas do baú que ele tem aberto. */
const CH = 200;                 // deslocamento dos índices de slot do baú nas mensagens

function ckey(x, y) { return `${x},${y}`; }
function isChest(x, y) { return world.tile(x, y) === G.T.CHEST; }
function chestItem(item) { return G.ITEMS[item]?.place === G.T.CHEST; }
function chestUsed(x, y) { const c = chests.get(ckey(x, y)); return c ? c.used() : 0; }
function chestAt(x, y) {
  const k = ckey(x, y);
  if (!chests.has(k)) chests.set(k, new G.Inventory(G.CHEST_SLOTS));
  return chests.get(k);
}
function chestViewers(x, y) {
  const out = [];
  for (const o of players.values()) if (o.chest && o.chest.x === x && o.chest.y === y) out.push(o);
  return out;
}
function closeChest(p, reason) {
  if (!p.chest) return;
  p.chest = null;
  send(p, 'chest_close', { reason });
}
// Baú aberto por p, revalidado (o tile ainda é um baú e ele continua perto).
function openChestOf(p) {
  if (!p.chest) return null;
  const { x, y } = p.chest;
  if (!isChest(x, y)) { closeChest(p, 'gone'); return null; }
  if (G.dist(p.x, p.y, x * G.TILE + G.TILE / 2, y * G.TILE + G.TILE / 2) > G.CHEST_DIST) { closeChest(p, 'far'); return null; }
  return chestAt(x, y);
}
// Reenvia o conteúdo para quem está com ele aberto e a contagem para todo mundo.
function pushChest(x, y) {
  const slots = chestAt(x, y).slots;
  for (const o of chestViewers(x, y)) send(o, 'chest', { x, y, slots });
  broadcast('chest_n', { x, y, n: chestUsed(x, y) });
  dirty = true;
}
// Baú destruído ou sobrescrito: apaga o conteúdo e fecha a janela de quem olhava.
function dropChest(x, y) {
  const had = chests.delete(ckey(x, y));
  const viewers = chestViewers(x, y);
  for (const o of viewers) closeChest(o, 'gone');
  if (had || viewers.length) broadcast('chest_n', { x, y, n: 0 });
}
function chestCounts() {
  const out = [];
  for (const [k, c] of chests) if (c.used()) out.push([...k.split(',').map(Number), c.used()]);
  return out;
}
function loadChests(list) {
  for (const [x, y, slots] of list || []) {
    if (!isChest(x, y)) { console.log(`baú salvo em ${x},${y} sem tile de baú — conteúdo descartado`); continue; }
    const c = new G.Inventory(G.CHEST_SLOTS);
    (slots || []).slice(0, G.CHEST_SLOTS).forEach((s, i) => { if (s && G.ITEMS[s.item] && !chestItem(s.item)) c.slots[i] = s; });
    if (c.used()) chests.set(ckey(x, y), c);
  }
}

/* ---------- ocupação de tiles ---------- */
// Jogador em cima do tile (x, y), ou null. Impede soterrar alguém.
function playerOnTile(x, y) {
  const pr = 9;
  for (const o of players.values()) {
    if (o.x + pr > x * G.TILE && o.x - pr < (x + 1) * G.TILE && o.y + pr > y * G.TILE && o.y - pr < (y + 1) * G.TILE) return o;
  }
  return null;
}

/* ---------- comércio ---------- */
function tradeOf(p) { return p.tradeId ? trades.get(p.tradeId) : null; }
function tradeState(t, p) {
  const other = t.a === p ? t.b : t.a;
  const mine = t.side[p.id], theirs = t.side[other.id];
  return {
    partnerId: other.id, partnerName: other.name, partnerCol: other.col,
    mine:   { items: mine.items, coins: mine.coins, conf: mine.conf },
    theirs: { items: theirs.items, coins: theirs.coins, conf: theirs.conf },
    partnerStats: { trades: other.stats.trades, canceled: other.stats.canceled, level: G.levelFromXp(other.xp) },
    dist: Math.round(G.dist(p.x, p.y, other.x, other.y) / G.TILE),
  };
}
function pushTrade(t) { send(t.a, 'trade', tradeState(t, t.a)); send(t.b, 'trade', tradeState(t, t.b)); }
function unconfirm(t) { t.side[t.a.id].conf = false; t.side[t.b.id].conf = false; }
function endTrade(t, reason, by) {
  for (const p of [t.a, t.b]) {
    const side = t.side[p.id];
    for (const s of side.items) { const rest = p.inv.put(s); if (rest) p.coins += (G.ITEMS[s.item].value || 0) * rest; } // devolve; se não couber, converte em coroas
    p.tradeId = null; sendInv(p);
    send(p, 'trade_end', { reason, by: by?.name });
  }
  if (by) { by.stats.canceled++; touch(by); }
  trades.delete(t.id);
}
function completeTrade(t) {
  const { a, b } = t, sa = t.side[a.id], sb = t.side[b.id];
  if (sa.coins > a.coins || sb.coins > b.coins) { unconfirm(t); return pushTrade(t); }
  const ca = a.inv.clone(), cb = b.inv.clone();
  const okA = sb.items.every(s => ca.put(s) === 0), okB = sa.items.every(s => cb.put(s) === 0);
  if (!okA || !okB) { unconfirm(t); sys('Sem espaço no inventário para concluir a troca.', okA ? b : a); return pushTrade(t); }
  a.inv = ca; b.inv = cb;
  a.coins += sb.coins - sa.coins; b.coins += sa.coins - sb.coins;
  for (const p of [a, b]) {
    const o = p === a ? b : a;
    p.stats.trades++; p.stats.with[o.name] = (p.stats.with[o.name] || 0) + 1; p.stats.maxCoins = Math.max(p.stats.maxCoins, p.coins);
    gainXp(p, G.XP.trade); p.tradeId = null; sendInv(p); touch(p);
    send(p, 'trade_end', { reason:'ok' });
    sys(`Troca com ${o.name} concluída.`, p);
  }
  trades.delete(t.id);
}

/* ---------- comandos de chat ----------
   As definições vivem em shared/Commands.js (o cliente usa as mesmas
   para autocompletar). Aqui fica só a execução, que é autoritativa:
   o cliente manda a linha crua e o servidor decide o que acontece. */
const COORD_LIMIT = 1e6;

function kick(target, reason, by) {
  target.kicked = { reason, by: by.name };
  send(target, 'kicked', { reason, by: by.name });
  sys(`${target.name} foi expulso por ${by.name}${reason ? ` — ${reason}` : ''}.`);
  console.log(`kick: ${by.name} -> ${target.name}${reason ? ` (${reason})` : ''}`);
  try { target.socket.close(4001, 'kicked'); } catch { /* já caiu */ }
}

// Tile caminhável mais próximo de (x, z) — teleportar para dentro de água ou
// de um muro deixaria o jogador preso, já que ele não conseguiria mais andar.
function freeTileNear(x, z, raio = 6) {
  if (world.walkable(x, z)) return [x, z];
  for (let r = 1; r <= raio; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;   // só a borda do anel
        if (world.walkable(x + dx, z + dz)) return [x + dx, z + dz];
      }
    }
  }
  return null;
}

const commands = {
  kick(p, v) {
    const target = findByName(v.jogador);
    if (!target) return sys(`Ninguém online com o nome "${v.jogador}".`, p);
    if (target === p) return sys('Você não pode expulsar a si mesmo.', p);
    kick(target, (v.motivo || '').trim(), p);
  },

  give(p, v) {
    const target = findByName(v.jogador);
    if (!target) return sys(`Ninguém online com o nome "${v.jogador}".`, p);
    const item = G.resolveItem(v.item);
    if (!item) return sys(`Item desconhecido: "${v.item}".`, p);
    const n = v.quantidade === undefined ? 1 : parseInt(v.quantidade, 10);
    if (!Number.isInteger(n) || n < 1 || n > 999) return sys('Quantidade inválida — use de 1 a 999.', p);

    const rest = target.inv.add(item, n);
    const got = n - rest;
    const label = G.ITEMS[item].label;
    if (!got) return sys(`O inventário de ${target.name} está cheio.`, p);
    sendInv(target); dirty = true;
    sys(`${got}× ${label} entregue a ${target.name}${rest ? ` (${rest} não coube no inventário)` : ''}.`, p);
    if (target !== p) sys(`Você recebeu ${got}× ${label} de ${p.name}.`, target);
    console.log(`give: ${p.name} -> ${target.name}: ${got}x ${item}`);
  },

  place(p, v) {
    const x = Number(v.x), y = Number(v.z);
    if (!Number.isInteger(x) || !Number.isInteger(y) || Math.abs(x) > COORD_LIMIT || Math.abs(y) > COORD_LIMIT) {
      return sys('Coordenadas inválidas — use números inteiros de tile (ex: /place 12 -40 muro).', p);
    }
    const name = G.resolveBlock(v.bloco);
    if (!name) return sys(`Bloco desconhecido: "${v.bloco}". Disponíveis: ${G.BLOCK_NAMES.join(', ')}.`, p);
    const tile = G.BLOCKS[name];
    const blocked = !G.tileWalkable(tile) && playerOnTile(x, y);
    if (blocked) return sys(`${blocked.name} está em cima de ${x}, ${y} — não dá para bloquear o tile.`, p);
    const guardado = chestUsed(x, y);
    if (guardado) return sys(`O baú em ${x}, ${y} tem ${guardado} pilha${guardado > 1 ? 's' : ''} dentro — esvazie antes de substituí-lo.`, p);

    world.set(x, y, tile);
    if (tile !== G.T.CHEST) dropChest(x, y);
    armGenerator(x, y);
    broadcast('tile', tileMsg(x, y));
    dirty = true;
    sys(`${G.BLOCK_LABEL[name]} colocado em ${x}, ${y}.`, p);
    console.log(`place: ${p.name} -> ${name} em ${x},${y}`);
  },

  /* As quatro formas do /tp caem todas aqui: `jogador` ausente significa quem
     digitou, e `destino` ausente significa que o alvo são as coordenadas. */
  tp(p, v) {
    const alvo = v.jogador === undefined ? p : findByName(v.jogador);
    if (!alvo) return sys(`Ninguém online com o nome "${v.jogador}".`, p);

    let x, y, onde, destino = null;

    if (v.destino !== undefined) {
      destino = findByName(v.destino);
      if (!destino) return sys(`Ninguém online com o nome "${v.destino}".`, p);
      if (destino === alvo) return sys(alvo === p ? 'Você já está onde queria chegar.' : `${alvo.name} já está lá.`, p);
      x = destino.x; y = destino.y;
      onde = `até ${destino.name}`;
    } else {
      const tx = Number(v.x), tz = Number(v.z);
      if (!Number.isInteger(tx) || !Number.isInteger(tz) || Math.abs(tx) > COORD_LIMIT || Math.abs(tz) > COORD_LIMIT) {
        return sys('Coordenadas inválidas — use números inteiros de tile (ex: /tp 12 -40).', p);
      }
      const spot = freeTileNear(tx, tz);
      if (!spot) return sys(`Não há chão firme perto de ${tx}, ${tz}.`, p);
      const [fx, fz] = spot;
      x = fx * G.TILE + G.TILE / 2; y = fz * G.TILE + G.TILE / 2;
      onde = fx === tx && fz === tz
        ? `para ${tx}, ${tz}`
        : `para ${fx}, ${fz} (${tx}, ${tz} não dava pé)`;
    }

    alvo.x = x; alvo.y = y; alvo.tpAt = Date.now();
    send(alvo, 'pos', { x, y });
    dirty = true;

    if (alvo === p) {
      sys(`Você foi ${onde}.`, p);
    } else {
      sys(`${alvo.name} foi ${onde}.`, p);
      sys(`Você foi teletransportado ${onde} por ${p.name}.`, alvo);
    }
    if (destino && destino !== p && destino !== alvo) sys(`${alvo.name} foi teletransportado até você.`, destino);
    console.log(`tp: ${p.name} -> ${alvo.name} ${onde}`);
  },
};

/* ---------- handlers ---------- */
const handlers = {
  move(p, m) {
    if (typeof m.x !== 'number' || typeof m.y !== 'number') return;
    // Logo após um teleporte, o cliente ainda manda a posição antiga (ele só
    // souber da nova quando o 'pos' chegar). Nesse intervalo o servidor manda
    // de volta onde ele realmente está, em vez de desfazer o teleporte.
    if (Date.now() - p.tpAt < 250) return send(p, 'pos', { x:p.x, y:p.y });
    if (Math.hypot(m.x - p.x, m.y - p.y) > G.TILE * 4) return send(p, 'pos', { x:p.x, y:p.y });
    const tx = Math.floor(m.x / G.TILE), ty = Math.floor(m.y / G.TILE);
    if (!world.walkable(tx, ty)) return send(p, 'pos', { x:p.x, y:p.y });
    p.x = m.x; p.y = m.y;
    const ck = Math.floor(tx / G.CHUNK) + ',' + Math.floor(ty / G.CHUNK);
    if (!p.stats.chunks.includes(ck)) { p.stats.chunks.push(ck); touch(p); }
  },
  sel(p, m) { if (Number.isInteger(m.sel) && m.sel >= 0 && m.sel < 8) p.sel = m.sel; },
  mine(p, m) {
    const { x, y } = m;
    if (!Number.isInteger(x) || !Number.isInteger(y) || !G.inReach(p.x, p.y, x, y)) return;
    const res = G.RES[world.tile(x, y)];
    if (!res || !p.inv.hasSpace(res.item) || p.energy < 1) return;
    const nowMs = Date.now();
    // Baú com coisas dentro não quebra. Devolve a contagem real para o cliente,
    // que pode estar defasada e é o que faz o cursor dele bloquear a quebra.
    const guardado = chestUsed(x, y);
    if (guardado) {
      send(p, 'chest_n', { x, y, n: guardado });
      if (nowMs - p.lastChestWarn > 3000) { p.lastChestWarn = nowMs; sys(`Esvazie o baú antes de quebrá-lo — ainda há ${guardado} pilha${guardado > 1 ? 's' : ''} lá dentro.`, p); }
      return;
    }
    if (nowMs - p.lastMine < G.mineTime(res, p.equip) * 0.8) return;
    p.lastMine = nowMs;
    const wasChest = isChest(x, y);
    const item = world.mine(x, y);
    if (item && wasChest && !isChest(x, y)) dropChest(x, y);
    // Estrutura geradora sem estoque: devolve o estado real para o cliente
    // re-sincronizar (o cache local dele pode estar defasado).
    if (!item) { if (res.gen) send(p, 'tile', tileMsg(x, y)); return; }
    p.inv.add(item, 1); p.energy -= 1;
    const tool = res.tool && p.equip[res.tool];
    if (tool && --tool.dur <= 0) { p.equip[res.tool] = null; sys(`Sua ${G.ITEMS[tool.item].label.toLowerCase()} quebrou.`, p); }
    p.stats.mined++; if (res.skill) p.stats[res.skill]++;
    gainXp(p, G.XP.mine);
    broadcast('tile', tileMsg(x, y));
    sendInv(p); touch(p);
  },
  place(p, m) {
    const { x, y } = m, s = p.inv.slots[p.sel];
    if (!s || !G.ITEMS[s.item]?.place) return sendInv(p);
    if (!Number.isInteger(x) || !Number.isInteger(y) || !G.inReach(p.x, p.y, x, y) || !world.placeable(x, y)) return sendInv(p);
    if (playerOnTile(x, y)) return sendInv(p);
    const taken = p.inv.take(p.sel, 1);
    if (!taken) return sendInv(p);
    world.set(x, y, G.ITEMS[taken.item].place);
    armGenerator(x, y);
    p.stats.built++; gainXp(p, G.XP.build);
    broadcast('tile', tileMsg(x, y));
    sendInv(p); touch(p);
  },
  /* ---------- baús ----------
     Índices de slot: 0..31 são do inventário do jogador e CH+0..CH+47 do baú,
     então um só handler serve para mover dentro de um lado ou entre os dois. */
  chest_open(p, m) {
    const { x, y } = m;
    if (!Number.isInteger(x) || !Number.isInteger(y)) return;
    if (!isChest(x, y) || !G.inReach(p.x, p.y, x, y)) return;
    p.chest = { x, y };
    send(p, 'chest', { x, y, slots: chestAt(x, y).slots, open:true });
  },
  chest_close(p) { p.chest = null; },
  chest_move(p, m) {
    const c = openChestOf(p); if (!c) return;
    const { from, to } = m;
    if (!Number.isInteger(from) || !Number.isInteger(to) || from === to) return;
    const src = from >= CH ? c : p.inv, si = from >= CH ? from - CH : from;
    const dst = to   >= CH ? c : p.inv, di = to   >= CH ? to   - CH : to;
    if (si < 0 || si >= src.slots.length || di < 0 || di >= dst.slots.length) return;
    const s = src.slots[si]; if (!s) return;
    if (dst === c && chestItem(s.item)) return sys('Um baú não cabe dentro de outro baú.', p);
    src.transfer(dst, si, di);
    if (src === p.inv || dst === p.inv) sendInv(p);
    if (src === c || dst === c) pushChest(p.chest.x, p.chest.y);
  },
  // Shift+clique: manda a pilha inteira para o outro lado, empilhando no que já existe.
  chest_quick(p, m) {
    const c = openChestOf(p); if (!c) return;
    const i = m.i;
    if (!Number.isInteger(i)) return;
    if (i >= CH) {
      const si = i - CH;
      if (si >= c.slots.length || !c.slots[si]) return;
      if (!c.push(p.inv, si)) return sys('Seu inventário está cheio.', p);
    } else {
      if (i < 0 || i >= p.inv.slots.length) return;
      const s = p.inv.slots[i]; if (!s) return;
      if (chestItem(s.item)) return sys('Um baú não cabe dentro de outro baú.', p);
      if (!p.inv.push(c, i)) return sys('O baú está cheio.', p);
    }
    sendInv(p); pushChest(p.chest.x, p.chest.y);
  },

  craft(p, m) {
    const r = G.RECIPES[m.k]; if (!r) return;
    let n = Math.min(Math.max(1, m.n | 0), 100), done = 0;
    while (n-- > 0 && G.craft(p.inv, r, p.coins)) { done++; p.coins -= r.coins || 0; }
    if (done) { p.stats.crafted += done; gainXp(p, G.XP.craft * done); sendInv(p); touch(p); }
  },
  swap(p, m) {
    const { from, to } = m;
    if (!Number.isInteger(from) || !Number.isInteger(to)) return;
    const eq = i => i === 100 ? 'pick' : i === 101 ? 'axe' : null;
    if (eq(from) && eq(to)) return;
    if (eq(from)) {                                  // desequipar
      const key = eq(from), tool = p.equip[key]; if (!tool) return;
      if (to >= 0 && to < 32) { if (p.inv.slots[to] && G.ITEMS[p.inv.slots[to].item].tool !== key) return; const prev = p.inv.slots[to]; p.inv.slots[to] = tool; p.equip[key] = prev || null; }
    } else if (eq(to)) {                             // equipar
      const key = eq(to), s = p.inv.slots[from]; if (!s || G.ITEMS[s.item].tool !== key) return;
      p.inv.slots[from] = p.equip[key]; p.equip[key] = s;
    } else p.inv.move(from, to);
    sendInv(p);
  },
  split(p, m) { if (Number.isInteger(m.slot)) { p.inv.split(m.slot); sendInv(p); } },
  color(p, m) { if (Number.isInteger(m.i) && G.PALETTE[m.i]) { p.col = G.PALETTE[m.i]; sendMe(p); dirty = true; } },

  chat(p, m) {
    const text = String(m.text || '').trim().slice(0, 200); if (!text) return;
    const ch = ['global', 'local', 'trade', 'whisper'].includes(m.ch) ? m.ch : 'global';
    const msg = { ch, from:p.name, fromId:p.id, col:p.col, text, day:now().day };
    if (ch === 'whisper') {
      const to = findByName(String(m.to || '')); if (!to) return sys(`Ninguém online com o nome "${m.to}".`, p);
      msg.to = to.name; msg.toId = to.id; send(to, 'chat', msg); send(p, 'chat', msg); return;
    }
    if (ch === 'local') return broadcast('chat', msg, o => G.dist(o.x, o.y, p.x, p.y) <= G.LOCAL_CHAT_DIST);
    chatLog.push(msg); if (chatLog.length > 60) chatLog.shift();
    broadcast('chat', msg);
  },

  cmd(p, m) {
    const text = String(m.text || '').trim().slice(0, 200);
    const r = G.parseCommand(text);
    if (!r.ok) return sys(r.error, p);
    if (r.def.scope !== 'server') return sys(`"/${r.def.name}" não é um comando de servidor.`, p);
    if (r.def.admin && !p.admin) return sys('Comando restrito a administradores.', p);
    const fn = commands[r.def.name];
    if (fn) fn(p, r.values);
  },

  trade_req(p, m) {
    const o = players.get(m.id); if (!o || o === p) return;
    if (p.tradeId) return sys('Você já está em uma troca.', p);
    if (o.tradeId) return sys(`${o.name} já está negociando com outra pessoa.`, p);
    if (G.dist(p.x, p.y, o.x, o.y) > G.TRADE_DIST) return sys(`${o.name} está longe demais — chegue a ${G.TRADE_DIST / G.TILE} tiles.`, p);
    o.tradeReqFrom = p.id;
    send(o, 'trade_req', { from:p.name, fromId:p.id });
    sys(`Pedido de troca enviado para ${o.name}.`, p);
  },
  trade_accept(p, m) {
    const o = players.get(m.id); if (!o || o.id !== p.tradeReqFrom) return;
    p.tradeReqFrom = null;
    if (p.tradeId || o.tradeId) return;
    if (G.dist(p.x, p.y, o.x, o.y) > G.TRADE_DIST) return sys('Longe demais para negociar.', p);
    const t = { id:nextTrade++, a:o, b:p, side:{ [o.id]:{ items:[], coins:0, conf:false }, [p.id]:{ items:[], coins:0, conf:false } } };
    trades.set(t.id, t); o.tradeId = p.tradeId = t.id;
    pushTrade(t);
  },
  trade_decline(p, m) { const o = players.get(m.id); if (o && o.id === p.tradeReqFrom) { p.tradeReqFrom = null; sys(`${p.name} recusou a troca.`, o); } },
  trade_add(p, m) {
    const t = tradeOf(p); if (!t) return;
    const side = t.side[p.id], s = p.inv.slots[m.slot]; if (!s) return;
    const n = Math.min(s.n, Math.max(1, m.n | 0));
    const taken = p.inv.take(m.slot, n);
    const same = taken.dur === undefined && side.items.find(x => x.item === taken.item);
    if (same) same.n += taken.n; else if (side.items.length < 8) side.items.push(taken); else { p.inv.put(taken); return; }
    unconfirm(t); sendInv(p); pushTrade(t);
  },
  trade_remove(p, m) {
    const t = tradeOf(p); if (!t) return;
    const side = t.side[p.id], s = side.items[m.i]; if (!s) return;
    if (!p.inv.hasSpace(s.item, s.n)) return;
    p.inv.put(s); side.items.splice(m.i, 1);
    unconfirm(t); sendInv(p); pushTrade(t);
  },
  trade_coins(p, m) {
    const t = tradeOf(p); if (!t) return;
    t.side[p.id].coins = Math.max(0, Math.min(p.coins, m.n | 0));
    unconfirm(t); pushTrade(t);
  },
  trade_confirm(p) {
    const t = tradeOf(p); if (!t) return;
    t.side[p.id].conf = true;
    if (t.side[t.a.id].conf && t.side[t.b.id].conf) completeTrade(t); else pushTrade(t);
  },
  trade_cancel(p) { const t = tradeOf(p); if (t) endTrade(t, 'cancel', p); },
};

/* ---------- servidor ---------- */
const app = Fastify({ logger:false });
app.register(require('@fastify/websocket'));
app.addHook('onSend', (req, reply, payload, done) => { reply.header('Access-Control-Allow-Origin', '*'); done(); }); // permite listar outros servidores no menu
app.register(require('@fastify/static'), { root:path.join(__dirname, 'public'), prefix:'/' });
app.register(require('@fastify/static'), { root:path.join(__dirname, 'shared'), prefix:'/shared/', decorateReply:false });

app.get('/status', async () => ({ name:SERVER_NAME, online:players.size, max:MAX_PLAYERS, seed:SEED, day:now().day, tiles:world.overrides.size }));
app.get('/servers', async () => [{ name:SERVER_NAME, url:'', online:players.size, max:MAX_PLAYERS, seed:SEED, day:now().day }, ...PEERS.map(u => ({ url:u }))]);

app.register(async function (f) {
  f.get('/ws', { websocket:true }, (socket, req) => {
    const rawName = String(req.query.nome || '');
    const valid = G.validatePlayerName(rawName);
    if (!valid.ok) {
      socket.send(JSON.stringify({ type:'reject', reason: valid.reason }));
      return socket.close();
    }
    const name = valid.name;
    if (players.size >= MAX_PLAYERS) { socket.send(JSON.stringify({ type:'reject', reason:'Servidor cheio.' })); return socket.close(); }
    if (findByName(name)) { socket.send(JSON.stringify({ type:'reject', reason:`O nome "${name}" já está em uso neste servidor.` })); return socket.close(); }

    const [sx, sy] = world.findSpawn();
    const saved = profiles[name] || profiles[name.replace(/_/g, ' ')] || {};
    const p = {
      id:nextId++, name, socket, sel:0, lastMine:0, energy:100, tradeId:null, tradeReqFrom:null, joinedAt:Date.now(), lastSaveMs:Date.now(),
      admin: isAdmin(name), kicked: null, tpAt: 0, chest: null, lastChestWarn: 0,
      col: saved.col || G.PALETTE[nextId % G.PALETTE.length],
      x: saved.x ?? sx, y: saved.y ?? sy,
      inv: new G.Inventory(32), equip: saved.equip || { pick:null, axe:null },
      coins: saved.coins ?? 50, xp: saved.xp || 0, stats: { ...newStats(), ...(saved.stats || {}) },
    };
    if (saved.slots) p.inv.slots = saved.slots;
    if (!world.walkable(Math.floor(p.x / G.TILE), Math.floor(p.y / G.TILE))) { p.x = sx; p.y = sy; }
    p.ach = achievementsOf(p);
    players.set(p.id, p);
    console.log(`+ ${p.name} (#${p.id})${p.admin ? ' [admin]' : ''} — ${players.size} online`);

    const tm = now();
    send(p, 'init', {
      id:p.id, name:p.name, col:p.col, seed:SEED, x:p.x, y:p.y, server:SERVER_NAME, max:MAX_PLAYERS, epoch, admin:p.admin,
      world: world.snapshot(),
      chests: chestCounts(),
      players: [...players.values()].filter(o => o !== p).map(publicInfo),
      slots:p.inv.slots, equip:p.equip, coins:p.coins, xp:p.xp, energy:p.energy, stats:p.stats, achievements:p.ach,
      chat: chatLog.slice(-30), time:{ day:tm.day, min:tm.min },
    });
    broadcast('join', publicInfo(p), o => o !== p);
    sys(`${p.name} entrou.`, null, { exceptId:p.id });
    sys(`Bem-vindo a ${SERVER_NAME}. Dia ${tm.day}.`, p);
    if (p.admin) sys(`Você é administrador aqui: ${G.COMMANDS.filter(c => c.admin).map(c => '/' + c.name).join(' · ')}.`, p);

    socket.on('message', raw => {
      let m; try { m = JSON.parse(raw); } catch { return; }
      const h = handlers[m.type]; if (h) h(p, m);
    });
    socket.on('close', () => {
      const t = tradeOf(p); if (t) endTrade(t, 'left', null);
      p.stats.playMs += Date.now() - p.lastSaveMs;
      profiles[name] = profileOf(p); dirty = true;
      players.delete(p.id);
      broadcast('leave', { id:p.id });
      if (!p.kicked) sys(`${p.name} saiu.`);
      console.log(`- ${p.name} (#${p.id}) — ${players.size} online`);
    });
  });
});

function profileOf(p) { return { col:p.col, x:p.x, y:p.y, slots:p.inv.slots, equip:p.equip, coins:p.coins, xp:p.xp, stats:p.stats }; }

/* ---------- ticks ---------- */
setInterval(() => { if (players.size) broadcast('players', { list:[...players.values()].map(publicInfo) }); }, 50);

setInterval(() => {
  const tm = now(), nowMs = Date.now();
  for (const p of players.values()) {
    // energia regenera quando não está minerando
    if (nowMs - p.lastMine > 1500 && p.energy < 100) { p.energy = Math.min(100, p.energy + 1.5); sendMe(p); }
    p.stats.playMs += nowMs - p.lastSaveMs; p.lastSaveMs = nowMs;
    if (tm.day > p.stats.maxDay) { p.stats.maxDay = tm.day; touch(p); }
    if (p.chest) openChestOf(p);              // longe demais ou baú sumiu: fecha

  }
  // trocas cancelam se alguém se afastar
  for (const t of [...trades.values()]) if (G.dist(t.a.x, t.a.y, t.b.x, t.b.y) > G.TRADE_DIST + G.TILE) endTrade(t, 'far', null);
  tickGenerators();
  broadcast('time', { day:tm.day, min:tm.min });
  if (tm.day !== lastDay) {
    lastDay = tm.day;
    for (const p of players.values()) { p.coins += G.DAILY_COINS; p.stats.maxCoins = Math.max(p.stats.maxCoins, p.coins); touch(p); }
    sys(`Dia ${tm.day} começou. Cada jogador recebeu ${G.DAILY_COINS} coroas.`);
  }
}, 1000);

// Escrita atômica: grava num arquivo temporário e troca com rename, que no
// mesmo filesystem é atômico. Evita que um processo morto no meio do save
// deixe o JSON truncado (foi o que corrompeu world.json antes).
function writeFileAtomic(file, data) {
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, file);
}

function save() {
  for (const p of players.values()) profiles[p.name] = profileOf(p);
  if (!dirty && !players.size) return;
  const cs = [...chests].filter(([, c]) => c.used()).map(([k, c]) => [...k.split(',').map(Number), c.slots]);
  writeFileAtomic(WORLD_FILE, JSON.stringify({ ...world.snapshot(), epoch, chests:cs }));
  writeFileAtomic(PLAYERS_FILE, JSON.stringify(profiles));
  dirty = false;
}
setInterval(save, 10000);
process.on('SIGINT', () => { save(); process.exit(); });
process.on('SIGTERM', () => { save(); process.exit(); });

app.listen({ port:PORT, host:'0.0.0.0' }).then(() => console.log(`${SERVER_NAME} em http://localhost:${PORT}  (seed ${SEED}, dia ${lastDay})`));
