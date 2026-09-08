/* ============================================================
   input.js — Movimento, mineração, colocação e interação com mouse/teclado.
   ============================================================ */

import { state } from './state.js';
import { $ } from './utils.js';
import { send } from './network.js';
import { uiOpen } from './ui/windows.js';
import { renderHotbar } from './ui/hud.js';
import { renderInventory } from './ui/inventory.js';
import { chestUsedAt } from './ui/chest.js';

const HOTBAR = 8;

export function handleMovement() {
  let dx = 0, dy = 0;
  if (keyIsDown(87) || keyIsDown(UP_ARROW)) dy -= 1;
  if (keyIsDown(83) || keyIsDown(DOWN_ARROW)) dy += 1;
  if (keyIsDown(65) || keyIsDown(LEFT_ARROW)) dx -= 1;
  if (keyIsDown(68) || keyIsDown(RIGHT_ARROW)) dx += 1;
  if (dx && dy) { dx *= 0.7071; dy *= 0.7071; }
  if (canStand(state.player.x + dx * state.player.speed, state.player.y)) {
    state.player.x += dx * state.player.speed;
  }
  if (canStand(state.player.x, state.player.y + dy * state.player.speed)) {
    state.player.y += dy * state.player.speed;
  }
}

export function canStand(px, py) {
  if (!state.world) return false;
  const r = state.player.r - 1;
  for (const [ox, oy] of [[-r, -r], [r, -r], [-r, r], [r, r]]) {
    if (!state.world.walkable(Math.floor((px + ox) / Game.TILE), Math.floor((py + oy) / Game.TILE))) {
      return false;
    }
  }
  return true;
}

export function mouseTile() {
  return [
    Math.floor((mouseX - width / 2 + state.player.x) / Game.TILE),
    Math.floor((mouseY - height / 2 + state.player.y) / Game.TILE)
  ];
}

export function inReach(tx, ty) {
  return Game.inReach(state.player.x, state.player.y, tx, ty);
}

export function selectedItem() {
  if (!state.player?.inv?.slots) return null;
  const s = state.player.inv.slots[state.player.sel];
  return s ? s.item : null;
}

export function overUI() {
  const el = document.elementFromPoint(mouseX, mouseY);
  return el && state.cnv && el !== state.cnv.elt;
}

export function overlapsPlayer(tx, ty, px = state.player?.x, py = state.player?.y, r = ((state.player?.r || 10) - 1)) {
  if (typeof px !== 'number' || typeof py !== 'number' || !Game?.TILE) return false;
  const TILE = Game.TILE;
  const pMinX = px - r;
  const pMaxX = px + r;
  const pMinY = py - r;
  const pMaxY = py + r;

  const tMinX = tx * TILE;
  const tMaxX = (tx + 1) * TILE;
  const tMinY = ty * TILE;
  const tMaxY = (ty + 1) * TILE;

  return pMaxX > tMinX && pMinX < tMaxX && pMaxY > tMinY && pMinY < tMaxY;
}

export function tileOverlapsAnyPlayer(tx, ty) {
  if (overlapsPlayer(tx, ty)) return true;
  const r = 9;
  if (state.others) {
    for (const o of state.others.values()) {
      if (overlapsPlayer(tx, ty, o.x, o.y, r)) return true;
    }
  }
  return false;
}

// Recurso extraível sob o cursor.
export function harvestable(tx, ty) {
  if (!state.world) return null;
  return Game.RES[state.world.tile(tx, ty)] || null;
}

// Estoque de uma estrutura geradora segundo o cliente — null se não for geradora.
// É só um cache do que o servidor mandou: quem manda no estoque real é o servidor.
export function genStock(tx, ty) {
  if (!state.world) return null;
  const res = Game.RES[state.world.tile(tx, ty)];
  return res && res.gen ? state.world.amount(tx, ty) : null;
}

// Sonda de re-sincronia: se o cliente acha que a estrutura está vazia, ainda
// tentamos recolher uma vez por segundo. Se o servidor tiver estoque, ele
// responde com a quantidade real e a coleta destrava sozinha.
const RESYNC_MS = 1000;

export function handleMining() {
  if (!state.world) return;
  const [tx, ty] = mouseTile();
  const res = harvestable(tx, ty);
  if (!mouseIsPressed || mouseButton !== RIGHT || overUI() || !inReach(tx, ty) || !res || !state.player.inv.hasSpace(res.item) || state.player.energy < 1) {
    state.mining.t0 = 0;
    return;
  }
  if (state.mining.x !== tx || state.mining.y !== ty || !state.mining.t0) {
    state.mining.x = tx;
    state.mining.y = ty;
    state.mining.t0 = millis();
  }
  const stock = genStock(tx, ty);
  const delay = (stock !== null && stock <= 0) || chestUsedAt(tx, ty)
    ? RESYNC_MS
    : Game.mineTime(res, state.player.equip);
  if (millis() - state.mining.t0 >= delay) {
    send('mine', { x: tx, y: ty });
    state.mining.t0 = millis();
  }
}

export function handlePlacement() {
  if (!state.world || !state.player?.inv) return;
  const item = selectedItem();
  if (!item) return;

  const itemDef = Game.ITEMS?.[item];
  if (!itemDef || !itemDef.place) return;

  const [tx, ty] = mouseTile();
  if (!Number.isInteger(tx) || !Number.isInteger(ty)) return;

  // 1. Célula alvo livre
  if (!state.world.placeable(tx, ty)) return;

  // 2. Dentro do alcance do jogador
  if (!inReach(tx, ty)) return;

  // 3. Não sobrepõe o jogador (nem outros jogadores)
  if (tileOverlapsAnyPlayer(tx, ty)) return;

  // Se tudo válido, consome 1 unidade do slot e sincroniza
  const taken = state.player.inv.take(state.player.sel, 1);
  if (!taken) return;

  renderHotbar();
  renderInventory();
  send('place', { x: tx, y: ty });
}

export function handleMousePressed(e) {
  if (!state.inGame || uiOpen() || overUI() || !e || (state.cnv && e.target !== state.cnv.elt)) return;
  const ctx = $('#ctx');
  if (ctx && !ctx.classList.contains('hidden')) {
    ctx.classList.add('hidden');
    return;
  }
  if (mouseButton === LEFT) {
    // Um tile com baú nunca aceita nada por cima, então o botão esquerdo pode
    // abri-lo sem disputar com a colocação de itens.
    const [tx, ty] = mouseTile();
    if (state.world && state.world.tile(tx, ty) === Game.T.CHEST && inReach(tx, ty)) {
      send('chest_open', { x: tx, y: ty });
      return;
    }
    handlePlacement();
  }
}

export function handleMouseWheel(e) {
  if (state.inGame && !uiOpen() && !overUI()) {
    setSel((state.player.sel + (e.delta > 0 ? 1 : HOTBAR - 1)) % HOTBAR);
    return false;
  }
}

export function setSel(i) {
  state.player.sel = i;
  send('sel', { sel: i });
  renderHotbar();
}
