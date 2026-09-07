/* ============================================================
   client.js — renderização (p5), interface (DOM) e rede.
   As regras vêm de Game (shared/game.js). Nada aqui altera o
   mundo ou o inventário diretamente: só pede ao servidor.
   ============================================================ */
const { TILE, CHUNK, CS, T, ITEMS, RES, RECIPES, RECIPE_CATS, PALETTE } = Game;
const HOTBAR = 8;
const COL = { [T.WATER]:[58,110,165], [T.SAND]:[217,198,143], [T.GRASS]:[111,154,74], [T.STONE]:[138,138,134] };
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));

/* ---------- estado ---------- */
let world = null, ws = null, connected = false, inGame = false;
const player = { id:0, name:'', col:PALETTE[0], x:0, y:0, r:10, speed:3.4, inv:new Game.Inventory(32), equip:{ pick:null, axe:null }, sel:0, coins:0, xp:0, energy:100, stats:{}, achievements:[] };
const others = new Map();
const chunkCache = new Map();
let mining = { x:null, y:null, t0:0 }, lastSent = { x:NaN, y:NaN };
let time = { day:1, min:360 }, serverInfo = { name:'', max:0, seed:1337 };
let heldFrom = null, craftCat = 'basico', craftSel = 0, chatTab = 'all', lastWhisper = null;
let chat = [], trade = null, camera = { x:0, y:0 };
const servers = { list:[], sel:0 };

/* ============================================================
   1a · MENU
   ============================================================ */
async function loadServers() {
  const box = $('#servers'); box.innerHTML = '';
  let list = [];
  try { list = await (await fetch('/servers')).json(); } catch { box.innerHTML = '<div class="srv off"><span>não foi possível listar servidores</span></div>'; return; }
  servers.list = [];
  for (const s of list) {
    const base = s.url || '';
    const t0 = performance.now();
    let st = null;
    try { st = await (await fetch(base + '/status', { mode:'cors' })).json(); } catch {}
    const ping = Math.round(performance.now() - t0);
    servers.list.push({ ...s, ...(st || {}), url:base, ping, ok:!!st });
  }
  servers.sel = servers.list.findIndex(s => s.ok);
  renderServers();
  const s = servers.list[servers.sel];
  if (s) { serverInfo.seed = s.seed; $('#menu-seed').textContent = `${s.name} · seed ${s.seed}`; if (!world) { world = new Game.World(s.seed); chunkCache.clear(); } }
}
function renderServers() {
  $('#servers').innerHTML = servers.list.map((s, i) => s.ok
    ? `<button class="srv ${i === servers.sel ? 'sel' : ''}" data-i="${i}"><span>${esc(s.name)}</span><span>${s.online} / ${s.max}</span><span>dia ${s.day}</span><span class="${s.ping < 120 ? 'green' : 'red'}">${s.ping} ms</span></button>`
    : `<div class="srv off"><span>${esc(s.url || 'servidor')}</span><span>—</span><span>—</span><span>offline</span></div>`).join('') || '<div class="srv off"><span>nenhum servidor disponível</span></div>';
  $('#servers').querySelectorAll('button.srv').forEach(b => b.onclick = () => { servers.sel = +b.dataset.i; renderServers(); });
}
$('#join').onclick = () => {
  const name = $('#name').value.trim();
  if (!name) return $('#menu-err').textContent = 'Escolha um nome antes de entrar.';
  const s = servers.list[servers.sel]; if (!s || !s.ok) return $('#menu-err').textContent = 'Selecione um servidor online.';
  localStorage.setItem('nome', name);
  $('#menu-err').textContent = 'conectando…';
  connect(s.url, name);
};
$('#name').value = localStorage.getItem('nome') || '';
$('#name').addEventListener('keydown', e => { if (e.key === 'Enter') $('#join').click(); });
$('#create').onclick = () => toast('Para criar um servidor: rode outra instância com PORT e SEED diferentes e liste em PEERS.');
$('#btn-controls').onclick = () => $('#controls').classList.toggle('hidden');
$('#btn-changelog').onclick = () => openChangelog();
$('#btn-credits').onclick = () => toast('Protótipo em p5.js + Fastify. Interface baseada no design "Terras Abertas".');
const menuVerEl = $('.ver'); if (menuVerEl) { menuVerEl.style.cursor = 'pointer'; menuVerEl.title = 'Ver changelog e novidades'; menuVerEl.onclick = () => openChangelog(); }
loadServers();

/* ============================================================
   REDE
   ============================================================ */
function connect(base, name) {
  const u = base ? new URL(base) : location;
  const proto = u.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${proto}://${u.host}/ws?nome=${encodeURIComponent(name)}`);
  ws.onmessage = e => onMessage(JSON.parse(e.data));
  ws.onclose = () => { if (inGame) { leaveGame('Desconectado do servidor.'); } else if (!$('#menu-err').textContent.includes('já') && !$('#menu-err').textContent.includes('cheio')) $('#menu-err').textContent = 'Conexão encerrada.'; connected = false; };
  ws.onerror = () => { $('#menu-err').textContent = 'Não foi possível conectar.'; };
}
function send(type, data = {}) { if (connected) ws.send(JSON.stringify({ type, ...data })); }
function leaveGame(msg) {
  inGame = false; connected = false; others.clear(); chat = []; trade = null;
  closeAll(); $('#hud').classList.add('hidden'); $('#menu').classList.remove('hidden');
  $('#menu-err').textContent = msg || ''; loadServers();
}

function onMessage(m) {
  switch (m.type) {
    case 'reject': $('#menu-err').textContent = m.reason; break;
    case 'init':
      world = new Game.World(m.seed); world.load(m.world); chunkCache.clear();
      Object.assign(player, { id:m.id, name:m.name, col:m.col, x:m.x, y:m.y, coins:m.coins, xp:m.xp, energy:m.energy, stats:m.stats, achievements:m.achievements, equip:m.equip });
      player.inv.slots = m.slots;
      others.clear(); for (const o of m.players) others.set(o.id, { ...o, tx:o.x, ty:o.y });
      serverInfo = { name:m.server, max:m.max, seed:m.seed }; time = m.time;
      chat = m.chat.map(c => ({ ...c }));
      connected = true; inGame = true;
      $('#menu').classList.add('hidden'); $('#hud').classList.remove('hidden'); $('#menu-err').textContent = '';
      $('#st-name').textContent = player.name;
      renderAll();
      break;
    case 'players':
      for (const o of m.list) {
        if (o.id === player.id) continue;
        const e = others.get(o.id);
        if (e) Object.assign(e, { tx:o.x, ty:o.y, item:o.item, col:o.col, level:o.level }); else others.set(o.id, { ...o, tx:o.x, ty:o.y });
      }
      if (!$('#players').classList.contains('hidden')) renderPlayers();
      break;
    case 'join':  others.set(m.id, { ...m, tx:m.x, ty:m.y }); renderPlayers(); break;
    case 'leave': others.delete(m.id); renderPlayers(); break;
    case 'tile': world.set(m.x, m.y, m.t); world.setAmount(m.x, m.y, m.amount); invalidateChunkAt(m.x, m.y); break;
    case 'inv': player.inv.slots = m.slots; player.equip = m.equip; renderHotbar(); renderInventory(); renderTradeInv(); break;
    case 'me':
      Object.assign(player, { coins:m.coins, xp:m.xp, energy:m.energy, stats:m.stats, col:m.col, achievements:m.achievements });
      renderStatus(); if (!$('#profile').classList.contains('hidden')) renderProfile(); $('#inv-coins').textContent = player.coins; $('#tr-mymax').textContent = 'de ' + player.coins;
      break;
    case 'pos': player.x = m.x; player.y = m.y; break;
    case 'time': time = { day:m.day, min:m.min }; renderStatus(); break;
    case 'chat': pushChat(m); break;
    case 'sys': if (m.exceptId === player.id) break; pushChat({ ch:'sys', text:m.text, day:m.day }); break;
    case 'trade_req': pushChat({ ch:'sys', text:`${m.from} quer negociar com você.`, day:time.day, action:{ id:m.fromId } }); break;
    case 'trade': trade = m; openTrade(); break;
    case 'trade_end':
      trade = null; $('#trade').classList.add('hidden');
      toast(m.reason === 'ok' ? 'Troca concluída.' : m.reason === 'far' ? 'Troca cancelada: alguém se afastou.' : m.reason === 'left' ? 'Troca cancelada: o outro jogador saiu.' : `Troca cancelada${m.by ? ' por ' + m.by : ''}.`);
      break;
  }
}

/* ============================================================
   p5 — MUNDO
   ============================================================ */
let cnv;
function setup() {
  cnv = createCanvas(windowWidth, windowHeight); cnv.elt.classList.add('p5Canvas');
  noSmooth(); textFont('VT323, monospace');
  document.oncontextmenu = e => { e.preventDefault(); };
}
function windowResized() { resizeCanvas(windowWidth, windowHeight); }
function uiOpen() { return !$('#inv').classList.contains('hidden') || !$('#trade').classList.contains('hidden') || !$('#profile').classList.contains('hidden') || !$('#changelog').classList.contains('hidden'); }
function typing() { const a = document.activeElement; return a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA'); }

function draw() {
  if (!world) return;
  if (inGame) {
    if (!uiOpen() && !typing()) handleMovement();
    if (!uiOpen()) handleMining(); else mining.t0 = 0;
    if (frameCount % 3 === 0 && (player.x !== lastSent.x || player.y !== lastSent.y)) { send('move', { x:+player.x.toFixed(1), y:+player.y.toFixed(1) }); lastSent = { x:player.x, y:player.y }; }
    for (const o of others.values()) { o.x += (o.tx - o.x) * 0.3; o.y += (o.ty - o.y) * 0.3; }
    camera.x = player.x; camera.y = player.y;
    if (frameCount % 24 === 0) renderMinimap();
    if (frameCount % 30 === 0) { $('#st-tile').textContent = `tile ${Math.floor(player.x / TILE)}, ${Math.floor(player.y / TILE)}`; $('#mm-fps').textContent = frameRate().toFixed(0) + ' fps'; }
  } else { camera.x = frameCount * 0.4; camera.y = Math.sin(frameCount * 0.002) * 200; }   // menu: câmera passeia
  if (frameCount % 120 === 0) unloadFarChunks();

  background(26, 29, 22);
  push();
  translate(Math.round(width / 2 - camera.x), Math.round(height / 2 - camera.y));
  const cx0 = Math.floor((camera.x - width / 2) / CS), cx1 = Math.floor((camera.x + width / 2) / CS);
  const cy0 = Math.floor((camera.y - height / 2) / CS), cy1 = Math.floor((camera.y + height / 2) / CS);
  for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) image(getChunk(cx, cy), cx * CS, cy * CS);
  if (inGame) {
    if (!uiOpen()) drawCursor();
    for (const o of others.values()) drawCharacter(o.x, o.y, o.col, o.name);
    drawCharacter(player.x, player.y, player.col, null);
  }
  pop();
  if (inGame && !uiOpen()) worldTooltip(); else if (inGame) hideTip();
}

/* chunks */
function getChunk(cx, cy) { const k = cx + ',' + cy; if (!chunkCache.has(k)) chunkCache.set(k, renderChunk(cx, cy)); return chunkCache.get(k); }
function invalidateChunkAt(tx, ty) { const k = Math.floor(tx / CHUNK) + ',' + Math.floor(ty / CHUNK); const g = chunkCache.get(k); if (g) { g.remove(); chunkCache.delete(k); } }
function unloadFarChunks() {
  const pcx = Math.floor(camera.x / CS), pcy = Math.floor(camera.y / CS);
  for (const [k, g] of chunkCache) { const [cx, cy] = k.split(',').map(Number); if (Math.abs(cx - pcx) > 4 || Math.abs(cy - pcy) > 4) { g.remove(); chunkCache.delete(k); } }
}
function renderChunk(cx, cy) {
  const g = createGraphics(CS, CS); g.noStroke();
  for (let ty = 0; ty < CHUNK; ty++) for (let tx = 0; tx < CHUNK; tx++) { const wx = cx * CHUNK + tx, wy = cy * CHUNK + ty; drawTile(g, world.tile(wx, wy), tx * TILE, ty * TILE, wx, wy); }
  return g;
}
function drawTile(g, t, px, py, wx, wy) {
  const ground = t < 10 ? t : world.groundUnder(wx, wy);
  const [r, gg, b] = COL[ground], v = (world.noise(wx * 0.7 + 90, wy * 0.7 + 90) - 0.5) * 22;
  g.fill(r + v, gg + v, b + v); g.rect(px, py, TILE, TILE);
  const c = TILE / 2;
  if (t === T.TREE) { g.fill(92,62,36); g.rect(px+c-3, py+c, 6, 12); g.fill(47,107,47); g.circle(px+c, py+c-3, 22); g.fill(66,133,60); g.circle(px+c-4, py+c-6, 12); }
  else if (t === T.ROCK) { g.fill(104,104,98); g.ellipse(px+c, py+c+3, 24, 18); g.fill(130,130,124); g.ellipse(px+c-3, py+c, 14, 10); }
  else if (t === T.IRON || t === T.COPPER) { g.fill(ITEMS[t === T.IRON ? 'ferro' : 'cobre'].col); for (const [ox,oy] of [[-8,-6],[6,-8],[0,2],[-7,8],[8,7]]) g.circle(px+c+ox, py+c+oy, 7); }
  else if (t === T.WALL) { g.fill(90,82,70); g.rect(px, py, TILE, TILE); g.fill(201,183,156); g.rect(px+2, py+2, TILE-4, TILE-4); g.fill(90,82,70); g.rect(px+2, py+c-1, TILE-4, 2); g.rect(px+c-1, py+2, 2, c-3); g.rect(px+8, py+c+1, 2, c-3); }
  else if (t === T.CHEST) { g.fill(70,45,22); g.rect(px+4, py+6, TILE-8, TILE-10); g.fill(150,100,50); g.rect(px+6, py+8, TILE-12, 8); g.fill(210,180,80); g.rect(px+c-2, py+13, 4, 6); }
  else if (t === T.BENCH) { g.fill(122,82,48); g.rect(px+3, py+8, TILE-6, 10); g.fill(80,52,28); g.rect(px+5, py+18, 4, 10); g.rect(px+TILE-9, py+18, 4, 10); g.fill(172,176,186); g.rect(px+10, py+4, 8, 4); }
}

/* personagens */
function handleMovement() {
  let dx = 0, dy = 0;
  if (keyIsDown(87) || keyIsDown(UP_ARROW)) dy -= 1; if (keyIsDown(83) || keyIsDown(DOWN_ARROW)) dy += 1;
  if (keyIsDown(65) || keyIsDown(LEFT_ARROW)) dx -= 1; if (keyIsDown(68) || keyIsDown(RIGHT_ARROW)) dx += 1;
  if (dx && dy) { dx *= 0.7071; dy *= 0.7071; }
  if (canStand(player.x + dx * player.speed, player.y)) player.x += dx * player.speed;
  if (canStand(player.x, player.y + dy * player.speed)) player.y += dy * player.speed;
}
function canStand(px, py) { const r = player.r - 1; for (const [ox, oy] of [[-r,-r],[r,-r],[-r,r],[r,r]]) if (!world.walkable(Math.floor((px + ox) / TILE), Math.floor((py + oy) / TILE))) return false; return true; }
function drawCharacter(x, y, col, name) {
  noStroke(); fill(0, 0, 0, 60); ellipse(x, y + 8, 22, 10);
  fill(col); rect(x - 10, y - 10, 20, 20); fill(60, 40, 20); rect(x - 5, y - 3, 3, 3); rect(x + 2, y - 3, 3, 3);
  if (name) { fill(col); textSize(16); textAlign(CENTER, BOTTOM); text(name, x, y - 14); }
}

/* minerar / construir */
function mouseTile() { return [Math.floor((mouseX - width / 2 + player.x) / TILE), Math.floor((mouseY - height / 2 + player.y) / TILE)]; }
function inReach(tx, ty) { return Game.inReach(player.x, player.y, tx, ty); }
function selectedItem() { const s = player.inv.slots[player.sel]; return s ? s.item : null; }
function overUI() { const el = document.elementFromPoint(mouseX, mouseY); return el && el !== cnv.elt; }
function handleMining() {
  const [tx, ty] = mouseTile(), res = RES[world.tile(tx, ty)];
  if (!mouseIsPressed || mouseButton !== LEFT || overUI() || !inReach(tx, ty) || !res || !player.inv.hasSpace(res.item) || player.energy < 1) { mining.t0 = 0; return; }
  if (mining.x !== tx || mining.y !== ty || !mining.t0) { mining.x = tx; mining.y = ty; mining.t0 = millis(); }
  if (millis() - mining.t0 >= Game.mineTime(res, player.equip)) { send('mine', { x:tx, y:ty }); mining.t0 = millis(); }
}
function drawCursor() {
  const [tx, ty] = mouseTile(), t = world.tile(tx, ty), item = selectedItem();
  const canMine = inReach(tx, ty) && !!RES[t], canPlace = inReach(tx, ty) && item && ITEMS[item].place && world.placeable(tx, ty);
  noFill(); strokeWeight(2); stroke(canMine || canPlace ? color(242, 199, 107) : color(255, 255, 255, 70));
  rect(tx * TILE + 1, ty * TILE + 1, TILE - 2, TILE - 2);
  if (canPlace && !canMine) { noStroke(); fill(242, 199, 107, 70); rect(tx * TILE + 3, ty * TILE + 3, TILE - 6, TILE - 6); }
  if (mining.t0 && mining.x === tx && mining.y === ty && RES[t]) { stroke(242, 199, 107); strokeWeight(3); noFill(); arc(tx * TILE + TILE / 2, ty * TILE + TILE / 2, 24, 24, -HALF_PI, -HALF_PI + TWO_PI * Math.min(1, (millis() - mining.t0) / Game.mineTime(RES[t], player.equip))); }
  noStroke();
}
function mousePressed(e) {
  if (!inGame || uiOpen() || !e || e.target !== cnv.elt) return;
  $('#ctx').classList.add('hidden');
  if (mouseButton === RIGHT) { const item = selectedItem(); if (!item || !ITEMS[item].place) return; const [tx, ty] = mouseTile(); if (inReach(tx, ty) && world.placeable(tx, ty)) send('place', { x:tx, y:ty }); }
}
function mouseWheel(e) { if (inGame && !uiOpen() && !overUI()) { setSel((player.sel + (e.delta > 0 ? 1 : HOTBAR - 1)) % HOTBAR); return false; } }
function setSel(i) { player.sel = i; send('sel', { sel:i }); renderHotbar(); }

/* ============================================================
   1b · HUD
   ============================================================ */
function renderAll() { renderStatus(); renderHotbar(); renderChat(); renderPlayers(); renderInventory(); }
function renderStatus() {
  const lvl = Game.levelFromXp(player.xp);
  $('#st-level').textContent = 'Nv ' + lvl;
  $('#st-en').style.width = player.energy + '%'; $('#st-en-v').textContent = `${player.energy}/100`;
  $('#st-time').textContent = `Dia ${time.day} · ${Game.fmtClock(time.min)}`;
  $('#night').style.opacity = (0.45 * Game.nightAlpha(time.min)).toFixed(2);
}
function iconHTML(item, extra = '') { return `<div class="icon" style="background:${ITEMS[item].col}${extra}"></div>`; }
function slotHTML(s, o = {}) {
  const tip = s ? ` data-tip="${esc(tipFor(s)).replace(/\n/g, '|')}"` : '';
  const dur = s && s.dur !== undefined ? `<div class="dur"><i style="width:${Math.round(100 * s.dur / ITEMS[s.item].dur)}%"></i></div>` : '';
  return `<div class="slot ${o.cls || ''} ${o.sel ? 'sel' : ''} ${o.dimmed ? 'dimmed' : ''}" ${o.data || ''}${tip}>${o.key !== undefined ? `<span class="key">${o.key}</span>` : ''}${s ? iconHTML(s.item) : ''}${s && s.n > 1 ? `<span class="n">${s.n}</span>` : ''}${dur}</div>`;
}
function tipFor(s) { const it = ITEMS[s.item]; return [it.label, (s.dur !== undefined ? `durabilidade ${Math.round(100 * s.dur / it.dur)}%` : '×' + s.n), it.desc].join('\n'); }
function renderHotbar() {
  $('#hb-slots').innerHTML = player.inv.slots.slice(0, HOTBAR).map((s, i) => slotHTML(s, { key:i + 1, sel:i === player.sel, data:`data-hb="${i}"` })).join('');
  $('#hb-slots').querySelectorAll('[data-hb]').forEach(el => el.onclick = () => setSel(+el.dataset.hb));
  const it = selectedItem();
  $('#hb-label').innerHTML = it ? `${esc(ITEMS[it].label)}${ITEMS[it].place ? ' <span class="dim">· botão direito coloca</span>' : ITEMS[it].tool ? ' <span class="dim">· equipe no inventário (E)</span>' : ''}` : '';
}
const mmCtx = $('#minimap canvas').getContext('2d');
const MMCOL = { [T.WATER]:'#3a6ea5', [T.SAND]:'#d9c68f', [T.GRASS]:'#6f9a4a', [T.STONE]:'#8a8a86', [T.TREE]:'#2f6b2f', [T.ROCK]:'#686862', [T.IRON]:'#a0785a', [T.COPPER]:'#c77a4a', [T.WALL]:'#c9b79c', [T.CHEST]:'#966432', [T.BENCH]:'#7a5230' };
function renderMinimap() {
  const px = Math.floor(player.x / TILE), py = Math.floor(player.y / TILE);
  for (let j = 0; j < 30; j++) for (let i = 0; i < 30; i++) { mmCtx.fillStyle = MMCOL[world.tile(px + (i - 15) * 2, py + (j - 15) * 2)]; mmCtx.fillRect(i * 5, j * 5, 5, 5); }
  for (const o of others.values()) { const dx = Math.round((o.x / TILE - px) / 2) + 15, dy = Math.round((o.y / TILE - py) / 2) + 15; if (dx >= 0 && dx < 30 && dy >= 0 && dy < 30) { mmCtx.fillStyle = o.col; mmCtx.fillRect(dx * 5, dy * 5, 5, 5); } }
  mmCtx.fillStyle = '#0f110d'; mmCtx.fillRect(74, 74, 7, 7); mmCtx.fillStyle = player.col; mmCtx.fillRect(75, 75, 5, 5);
}

/* tooltip */
function showTip(text, x, y) { const t = $('#tooltip'); t.innerHTML = text.split(/\n|\|/).map((l, i) => `<div class="${i ? '' : 't'}">${esc(l)}</div>`).join(''); t.classList.remove('hidden'); const w = t.offsetWidth, h = t.offsetHeight; t.style.left = Math.min(x + 16, innerWidth - w - 8) + 'px'; t.style.top = Math.min(y + 16, innerHeight - h - 8) + 'px'; }
function hideTip() { $('#tooltip').classList.add('hidden'); }
document.addEventListener('mousemove', e => {
  if (heldFrom !== null) { $('#held').style.left = e.clientX + 12 + 'px'; $('#held').style.top = e.clientY - 15 + 'px'; }
  const el = e.target.closest?.('[data-tip]');
  if (el && heldFrom === null) showTip(el.dataset.tip, e.clientX, e.clientY); else if (e.target !== cnv?.elt) hideTip();
  if (e.target.closest?.('#pf-ach')) { const a = e.target.dataset.ach; if (a) showTip(a, e.clientX, e.clientY); }
});
function worldTooltip() {
  if (overUI()) return;
  const [tx, ty] = mouseTile(), t = world.tile(tx, ty), res = RES[t];
  if (!res) return hideTip();
  const lines = [res.name];
  if (res.built) lines.push('construção · minere para recolher'); else { lines.push('dá: ' + ITEMS[res.item].label.toLowerCase()); lines.push(`restante: ${world.amount(tx, ty)} / ${res.amount}`); }
  const ms = Game.mineTime(res, player.equip);
  lines.push(`${(ms / 1000).toFixed(1).replace('.', ',')}s por unidade${res.tool && player.equip[res.tool] ? ' (com ferramenta)' : res.tool ? ` · ${res.tool === 'axe' ? 'machado' : 'picareta'} acelera` : ''}`);
  if (!inReach(tx, ty)) lines.push('fora de alcance'); else if (!player.inv.hasSpace(res.item)) lines.push('inventário cheio'); else if (player.energy < 1) lines.push('sem energia — descanse um pouco');
  showTip(lines.join('\n'), mouseX, mouseY);
}

/* ============================================================
   JANELAS · teclado
   ============================================================ */
function closeAll() { ['#inv', '#trade', '#profile', '#changelog', '#chatbox', '#players', '#ctx'].forEach(s => $(s).classList.add('hidden')); heldFrom = null; $('#held').classList.add('hidden'); hideTip(); if (trade) send('trade_cancel'); }
function toggle(id) { const el = $('#' + id); const open = el.classList.contains('hidden'); if (id === 'inv' || id === 'profile' || id === 'changelog') { $('#inv').classList.add('hidden'); $('#profile').classList.add('hidden'); $('#changelog').classList.add('hidden'); heldFrom = null; $('#held').classList.add('hidden'); } if (open) { el.classList.remove('hidden'); if (id === 'inv') renderInventory(); if (id === 'profile') renderProfile(); if (id === 'players') renderPlayers(); if (id === 'changelog') renderChangelog(); } else el.classList.add('hidden'); }
$('#quick').querySelectorAll('button').forEach(b => b.onclick = () => toggle(b.dataset.open));
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !$('#changelog').classList.contains('hidden')) { $('#changelog').classList.add('hidden'); return; }
  if (!inGame) return;
  if (e.key === 'Escape') { if (typing()) { document.activeElement.blur(); $('#chatbox').classList.add('hidden'); } else if (trade) { send('trade_cancel'); } else { ['#inv', '#profile', '#changelog', '#players', '#ctx'].forEach(s => $(s).classList.add('hidden')); $('#chatbox').classList.add('hidden'); heldFrom = null; $('#held').classList.add('hidden'); } return; }
  if (typing()) return;
  if (e.key === 'Enter') { e.preventDefault(); $('#chatbox').classList.remove('hidden'); renderChat(); $('#chatinput').focus(); return; }
  if (trade) return;
  const k = e.key.toLowerCase();
  if (k === 'e' || e.key === 'Tab') { e.preventDefault(); toggle('inv'); }
  else if (k === 'p') toggle('profile');
  else if (k === 'c') toggle('changelog');
  else if (k === 't') toggle('players');
  else if (e.key >= '1' && e.key <= '8') setSel(+e.key - 1);
  if (['w', 'a', 's', 'd', ' '].includes(k) || e.key.startsWith('Arrow')) e.preventDefault();
});
document.addEventListener('mousedown', e => { if (!e.target.closest('#ctx') && !e.target.closest('#pl-list')) $('#ctx').classList.add('hidden'); });

/* ============================================================
   1c · INVENTÁRIO E FABRICAÇÃO
   ============================================================ */
function renderInventory() {
  if ($('#inv').classList.contains('hidden')) return;
  const inv = player.inv, held = i => i === heldFrom;
  $('#inv-used').textContent = `${inv.used()} / 32 ocupados`;
  $('#inv-grid').innerHTML = inv.slots.slice(HOTBAR).map((s, i) => slotHTML(s, { data:`data-i="${i + HOTBAR}"`, dimmed:held(i + HOTBAR) })).join('');
  $('#inv-hot').innerHTML = inv.slots.slice(0, HOTBAR).map((s, i) => slotHTML(s, { key:i + 1, sel:i === player.sel, data:`data-i="${i}"`, dimmed:held(i) })).join('');
  $('#inv-equip').innerHTML = [['pick', 100, 'Picareta'], ['axe', 101, 'Machado']].map(([k, i, lab]) => { const s = player.equip[k]; return `<div class="eq">${slotHTML(s, { data:`data-i="${i}"`, dimmed:held(i) })}<div>${s ? `<div>${esc(ITEMS[s.item].label)}</div><div class="dim">durabilidade ${Math.round(100 * s.dur / ITEMS[s.item].dur)}%</div>` : `<div class="dim">${lab}</div><div class="dim2">vazio</div>`}</div></div>`; }).join('');
  $('#inv-coins').textContent = player.coins;
  $('#inv').querySelectorAll('[data-i]').forEach(el => {
    const i = +el.dataset.i;
    el.onclick = () => {
      const has = i >= 100 ? player.equip[i === 100 ? 'pick' : 'axe'] : inv.slots[i];
      if (heldFrom === null) { if (has) { heldFrom = i; $('#held').innerHTML = iconHTML(has.item) + (has.n > 1 ? has.n : ''); $('#held').classList.remove('hidden'); hideTip(); } }
      else { if (i !== heldFrom) send('swap', { from:heldFrom, to:i }); heldFrom = null; $('#held').classList.add('hidden'); }
      renderInventory();
    };
    el.oncontextmenu = ev => { ev.preventDefault(); if (heldFrom === null && i < 100) send('split', { slot:i }); };
  });
  renderCrafting();
}
function renderCrafting() {
  $('#inv-cats').innerHTML = RECIPE_CATS.map(([k, l]) => `<button class="${k === craftCat ? 'on' : ''}" data-c="${k}">${l}</button>`).join('');
  $('#inv-cats').querySelectorAll('button').forEach(b => b.onclick = () => { craftCat = b.dataset.c; craftSel = RECIPES.findIndex(r => r.cat === craftCat); renderCrafting(); });
  const list = RECIPES.map((r, k) => ({ r, k })).filter(x => x.r.cat === craftCat);
  if (!list.some(x => x.k === craftSel)) craftSel = list[0].k;
  $('#recipes').innerHTML = list.map(({ r, k }) => {
    const n = Game.craftableCount(player.inv, r);
    const needs = Object.entries(r.needs).map(([it, q]) => `<span class="${player.inv.count(it) >= q ? 'green' : 'red'}">${q} ${esc(ITEMS[it].label.toLowerCase())}</span>`).join(' + ');
    return `<button class="rcp ${k === craftSel ? 'on' : ''} ${n ? '' : 'no'}" data-k="${k}">${iconHTML(r.out)}<div class="body"><div>${esc(ITEMS[r.out].label)}</div><div class="needs">${needs}</div></div><span class="cnt">×${n}</span></button>`;
  }).join('');
  $('#recipes').querySelectorAll('.rcp').forEach(b => b.onclick = e => { craftSel = +b.dataset.k; if (e.shiftKey) doCraft(100); renderCrafting(); });
  const r = RECIPES[craftSel], n = Game.craftableCount(player.inv, r);
  $('#rdetail').innerHTML = `<div class="big">${iconHTML(r.out)}</div><div class="px gold" style="font-size:18px;text-align:center">${esc(ITEMS[r.out].label)}</div><div class="desc">${esc(ITEMS[r.out].desc)}</div><div class="rule"></div>`
    + Object.entries(r.needs).map(([it, q]) => `<div class="row"><span>${esc(ITEMS[it].label)}</span><span><span class="${player.inv.count(it) >= q ? 'green' : 'red'}">${player.inv.count(it)}</span> / ${q}</span></div>`).join('')
    + `<div class="row dim"><span>Valor</span><span>${ITEMS[r.out].value} coroas</span></div><div class="buttons"><button class="btn primary" id="cr1" ${n ? '' : 'disabled'}>Fabricar ×1</button><button class="btn" id="cr10" ${n ? '' : 'disabled'}>×10</button></div>`;
  $('#cr1').onclick = e => doCraft(e.shiftKey ? 100 : 1); $('#cr10').onclick = e => doCraft(e.shiftKey ? 100 : 10);
}
function doCraft(n) { send('craft', { k:craftSel, n }); }

/* ============================================================
   1d · COMÉRCIO
   ============================================================ */
function openTrade() {
  const t = trade; if (!t) return;
  $('#inv').classList.add('hidden'); $('#profile').classList.add('hidden'); $('#trade').classList.remove('hidden');
  $('#tr-title').textContent = `Troca com ${t.partnerName}`;
  $('#tr-dist').textContent = `distância ${t.dist} tiles · a troca cancela se alguém se afastar`;
  $('#tr-mysq').style.background = player.col; $('#tr-thsq').style.background = t.partnerCol; $('#tr-thname').textContent = `${t.partnerName} oferece`;
  $('#tr-myconf').innerHTML = t.mine.conf ? '<span class="green">Confirmado</span>' : '<span class="dim">Montando oferta</span>';
  $('#tr-thconf').innerHTML = t.theirs.conf ? '<span class="green">Confirmado</span>' : '<span class="gold">Aguardando…</span>';
  const pad = arr => [...arr, ...Array(Math.max(0, 8 - arr.length)).fill(null)];
  $('#tr-myoffer').innerHTML = pad(t.mine.items).map((s, i) => slotHTML(s, { data:`data-off="${i}"` })).join('');
  $('#tr-myoffer').querySelectorAll('[data-off]').forEach(el => el.onclick = () => { if (t.mine.items[+el.dataset.off]) send('trade_remove', { i:+el.dataset.off }); });
  $('#tr-thoffer').innerHTML = pad(t.theirs.items).map(s => slotHTML(s)).join('');
  if (document.activeElement !== $('#tr-mycoins')) $('#tr-mycoins').value = t.mine.coins;
  $('#tr-mymax').textContent = 'de ' + player.coins; $('#tr-thcoins').textContent = t.theirs.coins;
  const vm = Game.offerValue(t.mine.items, t.mine.coins), vt = Game.offerValue(t.theirs.items, t.theirs.coins);
  $('#tr-values').textContent = `${vm} vs ${vt}`;
  const ratio = vm && vt ? vt / vm : 0;
  $('#tr-fair').innerHTML = !vm && !vt ? '<span class="dim">nada oferecido ainda</span>' : ratio >= 0.8 && ratio <= 1.25 ? '<span class="green">Troca justa</span>' : ratio > 1.25 ? '<span class="green">A seu favor</span>' : '<span class="red">Contra você</span>';
  const ps = t.partnerStats, rep = ps.trades + ps.canceled ? Math.round(100 * ps.trades / (ps.trades + ps.canceled)) : null;
  $('#tr-about-t').textContent = `Sobre ${t.partnerName}`;
  $('#tr-about').innerHTML = `<div class="row"><span class="dim">Nível</span><span>${ps.level} · ${esc(Game.titleFor(ps.level))}</span></div><div class="row"><span class="dim">Trocas concluídas</span><span>${ps.trades}</span></div><div class="row"><span class="dim">Reputação</span><span class="${rep === null ? 'dim' : rep >= 80 ? 'green' : 'red'}">${rep === null ? 'sem histórico' : (rep >= 80 ? 'Confiável' : 'Cuidado') + ` (${rep}%)`}</span></div>`;
  $('#tr-confirm').textContent = t.mine.conf ? 'Confirmado ✓' : 'Confirmar troca';
  renderTradeInv();
}
function renderTradeInv() {
  if (!trade || $('#trade').classList.contains('hidden')) return;
  $('#tr-inv').innerHTML = player.inv.slots.map((s, i) => slotHTML(s, { cls:'s44', data:`data-ti="${i}"` })).join('');
  $('#tr-inv').querySelectorAll('[data-ti]').forEach(el => { const i = +el.dataset.ti; el.onclick = () => { if (player.inv.slots[i]) send('trade_add', { slot:i, n:99 }); }; el.oncontextmenu = ev => { ev.preventDefault(); if (player.inv.slots[i]) send('trade_add', { slot:i, n:1 }); }; });
}
$('#tr-mycoins').onchange = () => send('trade_coins', { n:+$('#tr-mycoins').value || 0 });
$('#tr-confirm').onclick = () => send('trade_confirm');
$('#tr-cancel').onclick = () => send('trade_cancel');

/* ============================================================
   1g · CHAT E JOGADORES
   ============================================================ */
function pushChat(m) { chat.push(m); if (chat.length > 200) chat.shift(); if (m.ch === 'whisper' && m.fromId !== player.id) lastWhisper = m.from; renderChat(); }
function lineHTML(m) {
  if (m.ch === 'sys') {
    let act = '';
    if (m.action) act = m.action.done ? ` <span class="dim">(${m.action.done})</span>` : ` <span class="act" data-acc="${m.action.id}">[Aceitar]</span><span class="act no" data-dec="${m.action.id}">[Recusar]</span>`;
    return `<div class="msg"><span class="ch sys">[Sistema]</span> ${esc(m.text)}${act}</div>`;
  }
  const who = `<span style="color:${m.col}">${esc(m.from)}${m.ch === 'whisper' ? '' : ':'}</span>`;
  if (m.ch === 'whisper') return `<div class="msg"><span class="ch w">[${m.fromId === player.id ? 'Sussurro para ' + esc(m.to) : 'Sussurro de ' + esc(m.from)}]</span> ${esc(m.text)}</div>`;
  const lab = { global:'Global', local:'Local', trade:'Comércio' }[m.ch] || m.ch;
  return `<div class="msg"><span class="ch">[${lab}]</span> ${who} ${esc(m.text)}</div>`;
}
function renderChat() {
  $('#chatmini-lines').innerHTML = chat.slice(-5).map(lineHTML).join('');
  if (!$('#chatbox').classList.contains('hidden')) {
    const f = chatTab === 'all' ? chat : chat.filter(m => m.ch === chatTab || (chatTab === 'global' && m.ch === 'sys'));
    let day = null, html = '';
    for (const m of f.slice(-80)) { if (m.day !== day) { day = m.day; html += `<div class="msg sep">— dia ${day} —</div>`; } html += lineHTML(m); }
    $('#chatlog').innerHTML = html; $('#chatlog').scrollTop = 1e9;
    $('#chatbox').querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === chatTab));
  }
  document.querySelectorAll('[data-acc]').forEach(b => b.onclick = () => { send('trade_accept', { id:+b.dataset.acc }); markAction(+b.dataset.acc, 'aceito'); });
  document.querySelectorAll('[data-dec]').forEach(b => b.onclick = () => { send('trade_decline', { id:+b.dataset.dec }); markAction(+b.dataset.dec, 'recusado'); });
}
function markAction(id, done) { for (const m of chat) if (m.action && m.action.id === id && !m.action.done) m.action.done = done; renderChat(); }
$('#chatbox').querySelectorAll('.tabs button').forEach(b => b.onclick = () => { chatTab = b.dataset.tab; $('#chatchip').textContent = chatTab === 'all' ? 'global' : chatTab === 'whisper' ? 'sussurro' : chatTab === 'trade' ? 'comércio' : chatTab; renderChat(); $('#chatinput').focus(); });
$('#chatform').onsubmit = e => {
  e.preventDefault();
  let text = $('#chatinput').value.trim(); $('#chatinput').value = ''; if (!text) return;
  let ch = chatTab === 'all' ? 'global' : chatTab, to = null;
  const cmd = text.match(/^\/(\w+)\s*(.*)$/s);
  if (cmd) {
    const [, c, rest] = cmd;
    if (c === 'w' || c === 'sussurrar') { const m = rest.match(/^(\S+)\s+(.*)$/s); if (!m) return toast('Uso: /w nome mensagem'); ch = 'whisper'; to = m[1]; text = m[2]; }
    else if (c === 'r') { if (!lastWhisper) return toast('Ninguém sussurrou para você ainda.'); ch = 'whisper'; to = lastWhisper; text = rest; }
    else if (c === 'g') { ch = 'global'; text = rest; } else if (c === 'l') { ch = 'local'; text = rest; } else if (c === 't') { ch = 'trade'; text = rest; }
    else return toast('Comandos: /w nome msg · /r msg · /g · /l · /t');
  }
  if (ch === 'whisper' && !to) return toast('Para sussurrar use /w nome mensagem.');
  if (text.trim()) send('chat', { ch, text, to });
};
function renderPlayers() {
  if ($('#players').classList.contains('hidden')) return;
  $('#pl-count').textContent = `${others.size + 1} / ${serverInfo.max}`;
  const rows = [{ id:player.id, name:player.name, col:player.col, me:true, level:Game.levelFromXp(player.xp) }, ...[...others.values()].sort((a, b) => a.name.localeCompare(b.name))];
  $('#pl-list').innerHTML = rows.map(o => {
    const where = o.me ? `${Math.floor(player.x / TILE)}, ${Math.floor(player.y / TILE)}` : `a ${Math.round(Game.dist(player.x, player.y, o.x, o.y) / TILE)} tiles`;
    return `<div class="pl ${o.me ? 'me' : ''}" data-pid="${o.id}"><span><span style="color:${o.col}">■</span> ${esc(o.name)} <span class="dim">${o.me ? '(você)' : 'nv ' + (o.level || 1)}</span></span><span class="where">${where}</span></div>`;
  }).join('');
  $('#pl-list').querySelectorAll('.pl:not(.me)').forEach(el => el.onclick = el.oncontextmenu = ev => { ev.preventDefault(); openCtx(+el.dataset.pid, ev.clientX, ev.clientY); });
}
function openCtx(id, x, y) {
  const o = others.get(id); if (!o) return;
  const far = Game.dist(player.x, player.y, o.x, o.y) > Game.TRADE_DIST;
  const c = $('#ctx'); c.innerHTML = `<div class="who">${esc(o.name)}</div><button data-a="w">Sussurrar</button><button data-a="t" ${far ? 'class="dim"' : ''}>Negociar${far ? ' (longe)' : ''}</button>`;
  c.classList.remove('hidden'); c.style.left = Math.min(x, innerWidth - 180) + 'px'; c.style.top = Math.min(y, innerHeight - 120) + 'px';
  c.querySelector('[data-a=w]').onclick = () => { c.classList.add('hidden'); $('#chatbox').classList.remove('hidden'); renderChat(); $('#chatinput').value = `/w ${o.name} `; $('#chatinput').focus(); };
  c.querySelector('[data-a=t]').onclick = () => { c.classList.add('hidden'); send('trade_req', { id }); };
}

/* ============================================================
   1h · PERFIL
   ============================================================ */
function renderProfile() {
  const s = player.stats, lvl = Game.levelFromXp(player.xp), next = Game.xpForLevel(lvl + 1), cur = Game.xpForLevel(lvl);
  $('#pf-body').style.background = player.col; $('#pf-name').textContent = player.name; $('#pf-title').textContent = `${Game.titleFor(lvl)} de ${serverInfo.name}`;
  const got = Game.ACHIEVEMENTS.filter(a => player.achievements.includes(a.id));
  $('#pf-badges').innerHTML = (got.slice(-2).map(a => `<span>${esc(a.label)}</span>`).join('')) || '<span class="dim">sem títulos ainda</span>';
  $('#pf-level').textContent = lvl; $('#pf-xpbar').style.width = Math.round(100 * (player.xp - cur) / (next - cur)) + '%';
  $('#pf-xp').textContent = `${player.xp} / ${next} xp`; $('#pf-next').textContent = `próx.: ${esc(Game.titleFor(lvl + 1)) === Game.titleFor(lvl) ? 'nível ' + (lvl + 1) : Game.titleFor(lvl + 1)}`;
  $('#pf-colors').innerHTML = PALETTE.map((c, i) => `<button style="background:${c}" class="${c === player.col ? 'on' : ''}" data-c="${i}"></button>`).join('');
  $('#pf-colors').querySelectorAll('button').forEach(b => b.onclick = () => send('color', { i:+b.dataset.c }));
  $('#pf-server').textContent = `${serverInfo.name} · dia ${time.day}`;
  const h = (s.playMs || 0) / 3600e3;
  $('#pf-stats').innerHTML = [[h >= 1 ? h.toFixed(1) + 'h' : Math.round(h * 60) + 'min', 'jogados'], [s.mined || 0, 'recursos coletados'], [s.built || 0, 'blocos construídos'], [Game.statNum(s, 'chunks'), 'chunks explorados']].map(([v, l]) => `<div class="stat"><b>${v}</b><span>${l}</span></div>`).join('');
  $('#pf-skills').innerHTML = Game.SKILLS.map(sk => `<div><div class="row"><span>${sk.label}</span><span class="dim">nv ${Game.skillLevel(s, sk)}</span></div><div class="track"><i style="width:${Math.round(100 * Game.skillProgress(s, sk))}%;background:${sk.col}"></i></div></div>`).join('');
  const sk = Game.SKILLS[0]; $('#pf-skillhint').textContent = `Mineração ${Game.skillLevel(s, sk) + 1}: faltam ${sk.per - (Game.statNum(s, sk.key) % sk.per)} minérios.`;
  const rep = s.trades + s.canceled ? Math.round(100 * s.trades / (s.trades + s.canceled)) : null;
  const partner = Object.entries(s.with || {}).sort((a, b) => b[1] - a[1])[0];
  $('#pf-rep').innerHTML = `<div class="row"><span class="dim">Trocas concluídas</span><span>${s.trades || 0}</span></div><div class="row"><span class="dim">Canceladas por você</span><span>${s.canceled || 0}</span></div><div class="row"><span class="dim">Avaliação</span><span class="${rep === null ? 'dim' : rep >= 80 ? 'green' : 'red'}">${rep === null ? 'sem histórico' : (rep >= 80 ? 'Confiável' : 'Cuidado') + ` (${rep}%)`}</span></div><div class="row"><span class="dim">Parceiro frequente</span><span>${partner ? esc(partner[0]) : '—'}</span></div><div class="row"><span class="dim">Coroas</span><span><i class="coin"></i>${player.coins}</span></div>`;
  $('#pf-achcount').textContent = `${got.length} / ${Game.ACHIEVEMENTS.length}`;
  $('#pf-ach').innerHTML = Game.ACHIEVEMENTS.map(a => { const g = player.achievements.includes(a.id); return `<div class="${g ? 'got' : ''}" style="${g ? 'background:' + a.col : ''}" data-ach="${esc(a.label)}|${esc(a.desc)}${g ? '' : '|(bloqueada)'}"></div>`; }).join('');
}

/* ---------- toast ---------- */
let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.remove('hidden'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.add('hidden'), 3500); }

/* ============================================================
   1i · CHANGELOG
   ============================================================ */
let changelogVer = 0, changelogFilter = 'all', changelogSearch = '';

function openChangelog() {
  $('#changelog').classList.remove('hidden');
  renderChangelog();
}

function renderChangelog() {
  const list = Game.CHANGELOG || [];
  if (!list.length) return;
  if (changelogVer >= list.length) changelogVer = 0;
  const cur = list[0];
  $('#cl-badge-top').textContent = cur ? cur.version : 'v0.3.0';

  // Lista de versões na barra lateral
  $('#cl-versions').innerHTML = list.map((v, i) => `
    <button class="cl-ver-btn ${i === changelogVer ? 'sel' : ''}" data-vi="${i}">
      <div class="v-top">
        <span class="v-ver">${esc(v.version)}</span>
        ${v.current ? '<span class="tag-cur">atual</span>' : ''}
      </div>
      <div class="v-date">${esc(v.date)}</div>
      <div class="v-sub">${esc(v.title)}</div>
    </button>
  `).join('');

  $('#cl-versions').querySelectorAll('[data-vi]').forEach(btn => {
    btn.onclick = () => {
      changelogVer = +btn.dataset.vi;
      renderChangelog();
    };
  });

  // Estatísticas gerais
  const totalChanges = list.reduce((acc, v) => acc + (v.items ? v.items.length : 0), 0);
  $('#cl-stats').innerHTML = `
    <div><b>${list.length}</b> versões lançadas</div>
    <div><b>${totalChanges}</b> alterações registradas</div>
  `;

  renderChangelogList();
}

function renderChangelogList() {
  const list = Game.CHANGELOG || [];
  const v = list[changelogVer];
  if (!v) return;

  const q = changelogSearch.toLowerCase().trim();
  const filtered = (v.items || []).filter(item => {
    const matchType = changelogFilter === 'all' || item.type === changelogFilter;
    const matchSearch = !q || item.title.toLowerCase().includes(q) || item.desc.toLowerCase().includes(q);
    return matchType && matchSearch;
  });

  // Banner da versão selecionada
  $('#cl-banner').innerHTML = `
    <div class="b-title">${esc(v.version)} — ${esc(v.title)}</div>
    <div class="b-meta">${esc(v.date)} · ${filtered.length} de ${v.items.length} itens</div>
  `;

  // Itens de alteração
  if (!filtered.length) {
    $('#cl-list').innerHTML = '<div class="cl-empty">Nenhuma alteração encontrada para este filtro ou busca.</div>';
  } else {
    $('#cl-list').innerHTML = filtered.map(item => `
      <div class="cl-item">
        <span class="cl-tag ${esc(item.type)}">${esc(item.type)}</span>
        <div class="cl-item-body">
          <div class="cl-item-title">${esc(item.title)}</div>
          <div class="cl-item-desc">${esc(item.desc)}</div>
        </div>
      </div>
    `).join('');
  }

  // Atualizar botões de filtro
  $('#cl-filters').querySelectorAll('.cl-filter').forEach(btn => {
    btn.classList.toggle('on', btn.dataset.type === changelogFilter);
  });
}

// Eventos da interface de changelog
$('#cl-close').onclick = () => $('#changelog').classList.add('hidden');
$('#changelog').onclick = e => { if (e.target === $('#changelog')) $('#changelog').classList.add('hidden'); };
$('#cl-search').oninput = e => { changelogSearch = e.target.value; renderChangelogList(); };
$('#cl-filters').querySelectorAll('.cl-filter').forEach(btn => {
  btn.onclick = () => {
    changelogFilter = btn.dataset.type;
    renderChangelogList();
  };
});
