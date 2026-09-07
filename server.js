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
const WORLD_FILE = path.join(__dirname, 'world.json');
const PLAYERS_FILE = path.join(__dirname, 'players.json');

/* ---------- estado ---------- */
const world = new G.World(SEED);
let epoch = Date.now();
if (fs.existsSync(WORLD_FILE)) {
  const snap = JSON.parse(fs.readFileSync(WORLD_FILE, 'utf8'));
  world.load(snap); if (snap.epoch) epoch = snap.epoch;
  console.log(`mundo carregado: ${world.overrides.size} tiles alterados, dia ${G.gameTime(Date.now(), epoch).day}`);
}
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
function findByName(name) { name = name.toLowerCase(); for (const p of players.values()) if (p.name.toLowerCase() === name) return p; return null; }
function gainXp(p, n) { const before = G.levelFromXp(p.xp); p.xp += n; const after = G.levelFromXp(p.xp); if (after > before) sys(`Você chegou ao nível ${after} — ${G.titleFor(after)}.`, p); }
function checkAchievements(p) {
  const had = p.ach, have = achievementsOf(p);
  for (const id of have) if (!had.includes(id)) { const a = G.ACHIEVEMENTS.find(a => a.id === id); sys(`Conquista: ${a.label} — ${a.desc}`, p); }
  p.ach = have;
}
function touch(p) { checkAchievements(p); sendMe(p); dirty = true; }

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

/* ---------- handlers ---------- */
const handlers = {
  move(p, m) {
    if (typeof m.x !== 'number' || typeof m.y !== 'number') return;
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
    if (nowMs - p.lastMine < G.mineTime(res, p.equip) * 0.8) return;
    p.lastMine = nowMs;
    const item = world.mine(x, y);
    if (!item) return;
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
    if (!s || !G.ITEMS[s.item]?.place) return;
    if (!Number.isInteger(x) || !Number.isInteger(y) || !G.inReach(p.x, p.y, x, y) || !world.placeable(x, y)) return;
    for (const o of players.values()) if (Math.floor(o.x / G.TILE) === x && Math.floor(o.y / G.TILE) === y) return;
    p.inv.remove(s.item, 1);
    world.set(x, y, G.ITEMS[s.item].place);
    p.stats.built++; gainXp(p, G.XP.build);
    broadcast('tile', tileMsg(x, y));
    sendInv(p); touch(p);
  },
  craft(p, m) {
    const r = G.RECIPES[m.k]; if (!r) return;
    let n = Math.min(Math.max(1, m.n | 0), 100), done = 0;
    while (n-- > 0 && G.craft(p.inv, r)) done++;
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
    const name = String(req.query.nome || '').trim().slice(0, 16).replace(/[<>]/g, '') || `jogador${nextId}`;
    if (players.size >= MAX_PLAYERS) { socket.send(JSON.stringify({ type:'reject', reason:'Servidor cheio.' })); return socket.close(); }
    if (findByName(name)) { socket.send(JSON.stringify({ type:'reject', reason:`O nome "${name}" já está em uso neste servidor.` })); return socket.close(); }

    const [sx, sy] = world.findSpawn();
    const saved = profiles[name] || {};
    const p = {
      id:nextId++, name, socket, sel:0, lastMine:0, energy:100, tradeId:null, tradeReqFrom:null, joinedAt:Date.now(), lastSaveMs:Date.now(),
      col: saved.col || G.PALETTE[nextId % G.PALETTE.length],
      x: saved.x ?? sx, y: saved.y ?? sy,
      inv: new G.Inventory(32), equip: saved.equip || { pick:null, axe:null },
      coins: saved.coins ?? 50, xp: saved.xp || 0, stats: { ...newStats(), ...(saved.stats || {}) },
    };
    if (saved.slots) p.inv.slots = saved.slots;
    if (!world.walkable(Math.floor(p.x / G.TILE), Math.floor(p.y / G.TILE))) { p.x = sx; p.y = sy; }
    p.ach = achievementsOf(p);
    players.set(p.id, p);
    console.log(`+ ${p.name} (#${p.id}) — ${players.size} online`);

    const tm = now();
    send(p, 'init', {
      id:p.id, name:p.name, col:p.col, seed:SEED, x:p.x, y:p.y, server:SERVER_NAME, max:MAX_PLAYERS, epoch,
      world: world.snapshot(),
      players: [...players.values()].filter(o => o !== p).map(publicInfo),
      slots:p.inv.slots, equip:p.equip, coins:p.coins, xp:p.xp, energy:p.energy, stats:p.stats, achievements:p.ach,
      chat: chatLog.slice(-30), time:{ day:tm.day, min:tm.min },
    });
    broadcast('join', publicInfo(p), o => o !== p);
    sys(`${p.name} entrou.`, null, { exceptId:p.id });
    sys(`Bem-vindo a ${SERVER_NAME}. Dia ${tm.day}.`, p);

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
      sys(`${p.name} saiu.`);
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
  }
  // trocas cancelam se alguém se afastar
  for (const t of [...trades.values()]) if (G.dist(t.a.x, t.a.y, t.b.x, t.b.y) > G.TRADE_DIST + G.TILE) endTrade(t, 'far', null);
  broadcast('time', { day:tm.day, min:tm.min });
  if (tm.day !== lastDay) {
    lastDay = tm.day;
    for (const p of players.values()) { p.coins += G.DAILY_COINS; p.stats.maxCoins = Math.max(p.stats.maxCoins, p.coins); touch(p); }
    sys(`Dia ${tm.day} começou. Cada jogador recebeu ${G.DAILY_COINS} coroas.`);
  }
}, 1000);

function save() {
  for (const p of players.values()) profiles[p.name] = profileOf(p);
  if (!dirty && !players.size) return;
  fs.writeFileSync(WORLD_FILE, JSON.stringify({ ...world.snapshot(), epoch }));
  fs.writeFileSync(PLAYERS_FILE, JSON.stringify(profiles));
  dirty = false;
}
setInterval(save, 10000);
process.on('SIGINT', () => { save(); process.exit(); });

app.listen({ port:PORT, host:'0.0.0.0' }).then(() => console.log(`${SERVER_NAME} em http://localhost:${PORT}  (seed ${SEED}, dia ${lastDay})`));
