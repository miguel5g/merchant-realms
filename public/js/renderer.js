/* ============================================================
   renderer.js — Renderização gráfica p5.js, chunks, câmera e minimapa.
   ============================================================ */

import { state } from './state.js';
import { $, hideTip } from './utils.js';
import { send } from './network.js';
import { uiOpen, typing } from './ui/windows.js';
import { worldTooltip, hideWorldTooltip } from './ui/hud.js';
import { handleMovement, handleMining, harvestable, genStock, mouseTile, inReach, selectedItem, overlapsPlayer } from './input.js';
import { checkChestRange, chestUsedAt } from './ui/chest.js';

let COL = null;
let MMCOL = null;
let mmCtx = null;

function initPalette() {
  if (COL) return;
  const T = Game.T;
  COL = {
    [T.WATER]: [58, 110, 165],
    [T.SAND]: [217, 198, 143],
    [T.GRASS]: [111, 154, 74],
    [T.STONE]: [138, 138, 134]
  };
  MMCOL = {
    [T.WATER]: '#3a6ea5',
    [T.SAND]: '#d9c68f',
    [T.GRASS]: '#6f9a4a',
    [T.STONE]: '#8a8a86',
    [T.TREE]: '#2f6b2f',
    [T.ROCK]: '#686862',
    [T.IRON]: '#a0785a',
    [T.COPPER]: '#c77a4a',
    [T.COAL]: '#4a4550',
    [T.WALL]: '#c9b79c',
    [T.CHEST]: '#966432',
    [T.MADEIREIRA]: '#6b4a2f'
  };
}

export function setup() {
  initPalette();
  state.cnv = createCanvas(windowWidth, windowHeight);
  state.cnv.elt.classList.add('p5Canvas');
  noSmooth();
  textFont('VT323, monospace');
  document.oncontextmenu = e => { e.preventDefault(); };
}

export function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

export function draw() {
  if (!state.world) return;
  initPalette();

  if (state.inGame) {
    checkChestRange();
    if (!uiOpen() && !typing()) handleMovement();
    if (!uiOpen()) handleMining(); else state.mining.t0 = 0;

    if (frameCount % 3 === 0 && (state.player.x !== state.lastSent.x || state.player.y !== state.lastSent.y)) {
      send('move', { x: +state.player.x.toFixed(1), y: +state.player.y.toFixed(1) });
      state.lastSent = { x: state.player.x, y: state.player.y };
    }

    for (const o of state.others.values()) {
      o.x += (o.tx - o.x) * 0.3;
      o.y += (o.ty - o.y) * 0.3;
    }

    state.camera.x = state.player.x;
    state.camera.y = state.player.y;

    if (frameCount % 24 === 0) renderMinimap();
    if (frameCount % 30 === 0) {
      const stTile = $('#st-tile');
      if (stTile) stTile.textContent = `tile ${Math.floor(state.player.x / Game.TILE)}, ${Math.floor(state.player.y / Game.TILE)}`;
      const mmFps = $('#mm-fps');
      if (mmFps) mmFps.textContent = frameRate().toFixed(0) + ' fps';
    }
  } else {
    // Menu: câmera passeia pelo mundo
    state.camera.x = frameCount * 0.4;
    state.camera.y = Math.sin(frameCount * 0.002) * 200;
  }

  if (frameCount % 120 === 0) unloadFarChunks();

  background(26, 29, 22);
  push();
  translate(Math.round(width / 2 - state.camera.x), Math.round(height / 2 - state.camera.y));

  const CS = Game.CS;
  const cx0 = Math.floor((state.camera.x - width / 2) / CS);
  const cx1 = Math.floor((state.camera.x + width / 2) / CS);
  const cy0 = Math.floor((state.camera.y - height / 2) / CS);
  const cy1 = Math.floor((state.camera.y + height / 2) / CS);

  for (let cy = cy0; cy <= cy1; cy++) {
    for (let cx = cx0; cx <= cx1; cx++) {
      image(getChunk(cx, cy), cx * CS, cy * CS);
    }
  }

  if (state.inGame) {
    if (!uiOpen()) drawCursor();
    for (const o of state.others.values()) drawCharacter(o, o.name);
    drawCharacter(state.player, null);
  }
  pop();

  if (state.inGame && !uiOpen()) worldTooltip();
  else hideWorldTooltip();
}

/* ---------- Chunks e Terreno ---------- */
export function getChunk(cx, cy) {
  const k = cx + ',' + cy;
  if (!state.chunkCache.has(k)) {
    state.chunkCache.set(k, renderChunk(cx, cy));
  }
  return state.chunkCache.get(k);
}

export function invalidateChunkAt(tx, ty) {
  const k = Math.floor(tx / Game.CHUNK) + ',' + Math.floor(ty / Game.CHUNK);
  const g = state.chunkCache.get(k);
  if (g) {
    g.remove();
    state.chunkCache.delete(k);
  }
}

export function unloadFarChunks() {
  const CS = Game.CS;
  const pcx = Math.floor(state.camera.x / CS);
  const pcy = Math.floor(state.camera.y / CS);
  for (const [k, g] of state.chunkCache) {
    const [cx, cy] = k.split(',').map(Number);
    if (Math.abs(cx - pcx) > 4 || Math.abs(cy - pcy) > 4) {
      g.remove();
      state.chunkCache.delete(k);
    }
  }
}

export function renderChunk(cx, cy) {
  const CS = Game.CS;
  const TILE = Game.TILE;
  const CHUNK = Game.CHUNK;
  const g = createGraphics(CS, CS);
  g.noStroke();

  for (let ty = 0; ty < CHUNK; ty++) {
    for (let tx = 0; tx < CHUNK; tx++) {
      const wx = cx * CHUNK + tx;
      const wy = cy * CHUNK + ty;
      drawTile(g, state.world.tile(wx, wy), tx * TILE, ty * TILE, wx, wy);
    }
  }
  return g;
}

export function drawTile(g, t, px, py, wx, wy) {
  const T = Game.T;
  const TILE = Game.TILE;
  const ground = t < 10 ? t : state.world.groundUnder(wx, wy);
  const [r, gg, b] = COL[ground];
  const v = (state.world.noise(wx * 0.7 + 90, wy * 0.7 + 90) - 0.5) * 22;

  g.fill(r + v, gg + v, b + v);
  g.rect(px, py, TILE, TILE);

  const c = TILE / 2;
  if (t === T.TREE) {
    g.fill(92, 62, 36);
    g.rect(px + c - 3, py + c, 6, 12);
    g.fill(47, 107, 47);
    g.circle(px + c, py + c - 3, 22);
    g.fill(66, 133, 60);
    g.circle(px + c - 4, py + c - 6, 12);
  } else if (t === T.ROCK) {
    g.fill(104, 104, 98);
    g.ellipse(px + c, py + c + 3, 24, 18);
    g.fill(130, 130, 124);
    g.ellipse(px + c - 3, py + c, 14, 10);
  } else if (Game.RES[t]?.skill === 'ore') {
    // Veio de minério: pepitas na cor do próprio item (ferro, cobre, carvão...)
    g.fill(Game.ITEMS[Game.RES[t].item].col);
    for (const [ox, oy] of [[-8, -6], [6, -8], [0, 2], [-7, 8], [8, 7]]) {
      g.circle(px + c + ox, py + c + oy, 7);
    }
  } else if (t === T.WALL) {
    g.fill(90, 82, 70);
    g.rect(px, py, TILE, TILE);
    g.fill(201, 183, 156);
    g.rect(px + 2, py + 2, TILE - 4, TILE - 4);
    g.fill(90, 82, 70);
    g.rect(px + 2, py + c - 1, TILE - 4, 2);
    g.rect(px + c - 1, py + 2, 2, c - 3);
    g.rect(px + 8, py + c + 1, 2, c - 3);
  } else if (t === T.CHEST) {
    g.fill(70, 45, 22);
    g.rect(px + 4, py + 6, TILE - 8, TILE - 10);
    g.fill(150, 100, 50);
    g.rect(px + 6, py + 8, TILE - 12, 8);
    g.fill(210, 180, 80);
    g.rect(px + c - 2, py + 13, 4, 6);
  } else if (t === T.MADEIREIRA) {
    // Madeireira: telhado, pilha de toras e serra
    g.fill(74, 50, 30);
    g.rect(px + 3, py + 10, TILE - 6, TILE - 13);
    g.fill(107, 74, 47);
    g.rect(px + 5, py + 12, TILE - 10, TILE - 17);
    g.fill(139, 94, 52);
    g.rect(px + 2, py + 5, TILE - 4, 6);
    g.fill(74, 50, 30);
    g.circle(px + 10, py + 22, 7);
    g.circle(px + 18, py + 22, 7);
    g.fill(196, 198, 206);
    g.circle(px + c + 3, py + 15, 9);
    g.fill(107, 74, 47);
    g.circle(px + c + 3, py + 15, 3);
  }
}

/* ---------- Personagens e Cursor ---------- */
const SKIN_TONE = '#e0aa76';
const HAIR_TONE = '#5a3d24';

// Um jogador parado (idx 0) x avançado (idx 1) na passada — pernas e braços
// se alternam em antifase pra dar impressão de andar, como no Stardew.
function stepLift(entity, moving) {
  if (!moving) return { legL: 0, legR: 0, armL: 0, armR: 0 };
  const phase = Math.floor(entity._walkT / 6) % 2;
  const lift = 4;
  return phase === 0
    ? { legL: lift, legR: 0, armL: 0, armR: lift }
    : { legL: 0, legR: lift, armL: lift, armR: 0 };
}

// Boneco visto de frente/costas. Origem local (0,0) é o chão sob os pés —
// mesmo ponto onde a sombra é desenhada.
function drawBodyFront(col, lift, isBack) {
  noStroke();
  // pernas: topo fixo (preso ao corpo), a base sobe quando o pé "levanta" —
  // antes a altura crescia dos dois lados e a base nunca saía do chão.
  fill(40, 30, 20);
  rect(-6, -8, 5, 8 - lift.legL);
  rect(1, -8, 5, 8 - lift.legR);
  // braços (atrás do corpo)
  fill(col);
  rect(-12, -21 + lift.armL, 4, 10);
  rect(8, -21 + lift.armR, 4, 10);
  // corpo/camisa
  rect(-8, -22, 16, 14);
  // cabeça
  fill(SKIN_TONE);
  rect(-7, -36, 14, 14);
  // cabelo: de costas cobre a cabeça toda, de frente só o topo
  fill(HAIR_TONE);
  rect(-7, -36, 14, isBack ? 14 : 6);
  if (!isBack) {
    fill(30, 25, 20);
    rect(-4, -27, 2, 2);
    rect(2, -27, 2, 2);
  }
}

// Perfil (direita); a visão esquerda é isso espelhado via scale(-1,1).
function drawBodySide(col, lift) {
  noStroke();
  fill(40, 30, 20);
  rect(-4, -8, 5, 8 - lift.legL);
  rect(2, -8, 5, 8 - lift.legR);
  fill(col);
  rect(-10, -21 + lift.armL, 4, 10);
  rect(6, -21 + lift.armR, 4, 10);
  rect(-8, -22, 16, 14);
  fill(SKIN_TONE);
  rect(-6, -36, 15, 14); // rosto estendido pra frente (perfil)
  fill(HAIR_TONE);
  rect(-6, -36, 14, 6);
  fill(30, 25, 20);
  rect(4, -27, 2, 2); // um olho só, perto da borda de frente
}

export function drawCharacter(entity, name) {
  const { x, y, col } = entity;

  // Direção e fase de passo ficam gravadas no próprio objeto (state.player
  // ou uma entrada de state.others) pra persistir entre frames sem precisar
  // de um Map paralelo por id.
  const dx = x - (entity._px ?? x);
  const dy = y - (entity._py ?? y);
  const moving = Math.hypot(dx, dy) > 0.05;
  if (moving) {
    entity.facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    entity._walkT = (entity._walkT || 0) + 1;
  } else {
    entity._walkT = 0;
  }
  if (!entity.facing) entity.facing = 'down';
  entity._px = x;
  entity._py = y;

  // Sombra rente aos pés — as pernas terminam em y (base do sprite), então
  // ela precisa ficar colada aí, não vários pixels abaixo (senão "flutua").
  noStroke();
  fill(0, 0, 0, 60);
  ellipse(x, y - 1, 22, 9);

  const lift = stepLift(entity, moving);
  push();
  translate(x, y);
  if (entity.facing === 'left' || entity.facing === 'right') {
    if (entity.facing === 'left') scale(-1, 1);
    drawBodySide(col, lift);
  } else {
    drawBodyFront(col, lift, entity.facing === 'up');
  }
  pop();

  if (name) {
    fill(col);
    textSize(16);
    textAlign(CENTER, BOTTOM);
    text(name, x, y - 40);
  }
}

export function drawCursor() {
  const TILE = Game.TILE;
  const [tx, ty] = mouseTile();
  const t = state.world.tile(tx, ty);
  const item = selectedItem();
  const res = harvestable(tx, ty);
  const stock = genStock(tx, ty);
  const stored = t === Game.T.CHEST ? chestUsedAt(tx, ty) : 0;   // baú com coisas dentro não quebra
  const hasSpace = !res || state.player.inv.hasSpace(res.item);
  const canMine = inReach(tx, ty) && !!res && hasSpace && !(stock !== null && stock <= 0) && !stored;
  const canOpen = t === Game.T.CHEST && inReach(tx, ty);
  const canPlace = inReach(tx, ty) && item && Game.ITEMS[item]?.place && state.world.placeable(tx, ty) && !overlapsPlayer(tx, ty);

  noFill();
  strokeWeight(2);
  stroke(canMine || canPlace || canOpen ? color(242, 199, 107) : color(255, 255, 255, 70));
  rect(tx * TILE + 1, ty * TILE + 1, TILE - 2, TILE - 2);

  if (canPlace && !canMine) {
    noStroke();
    fill(242, 199, 107, 70);
    rect(tx * TILE + 3, ty * TILE + 3, TILE - 6, TILE - 6);
  }

  if (state.mining.t0 && state.mining.x === tx && state.mining.y === ty && res && canMine) {
    stroke(242, 199, 107);
    strokeWeight(3);
    noFill();
    arc(
      tx * TILE + TILE / 2,
      ty * TILE + TILE / 2,
      24,
      24,
      -HALF_PI,
      -HALF_PI + TWO_PI * Math.min(1, (millis() - state.mining.t0) / Game.mineTime(res, state.player.equip))
    );
  }
  noStroke();
}

/* ---------- Minimapa ---------- */
export function renderMinimap() {
  if (!mmCtx) {
    const canvas = $('#minimap canvas');
    if (canvas) mmCtx = canvas.getContext('2d');
  }
  if (!mmCtx || !state.world) return;

  const TILE = Game.TILE;
  const px = Math.floor(state.player.x / TILE);
  const py = Math.floor(state.player.y / TILE);

  for (let j = 0; j < 30; j++) {
    for (let i = 0; i < 30; i++) {
      mmCtx.fillStyle = MMCOL[state.world.tile(px + (i - 15) * 2, py + (j - 15) * 2)];
      mmCtx.fillRect(i * 5, j * 5, 5, 5);
    }
  }

  for (const o of state.others.values()) {
    const dx = Math.round((o.x / TILE - px) / 2) + 15;
    const dy = Math.round((o.y / TILE - py) / 2) + 15;
    if (dx >= 0 && dx < 30 && dy >= 0 && dy < 30) {
      mmCtx.fillStyle = o.col;
      mmCtx.fillRect(dx * 5, dy * 5, 5, 5);
    }
  }

  mmCtx.fillStyle = '#0f110d';
  mmCtx.fillRect(74, 74, 7, 7);
  mmCtx.fillStyle = state.player.col;
  mmCtx.fillRect(75, 75, 5, 5);
}
