/* ============================================================
   input.js — Movimento, mineração, colocação e interação com mouse/teclado.
   ============================================================ */

import { state } from './state.js';
import { $ } from './utils.js';
import { send } from './network.js';
import { uiOpen } from './ui/windows.js';
import { renderHotbar } from './ui/hud.js';

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
  if (!state.player.inv || !state.player.inv.slots) return null;
  const s = state.player.inv.slots[state.player.sel];
  return s ? s.item : null;
}

export function overUI() {
  const el = document.elementFromPoint(mouseX, mouseY);
  return el && state.cnv && el !== state.cnv.elt;
}

export function handleMining() {
  if (!state.world) return;
  const [tx, ty] = mouseTile();
  const res = Game.RES[state.world.tile(tx, ty)];
  if (!mouseIsPressed || mouseButton !== LEFT || overUI() || !inReach(tx, ty) || !res || !state.player.inv.hasSpace(res.item) || state.player.energy < 1) {
    state.mining.t0 = 0;
    return;
  }
  if (state.mining.x !== tx || state.mining.y !== ty || !state.mining.t0) {
    state.mining.x = tx;
    state.mining.y = ty;
    state.mining.t0 = millis();
  }
  if (millis() - state.mining.t0 >= Game.mineTime(res, state.player.equip)) {
    send('mine', { x: tx, y: ty });
    state.mining.t0 = millis();
  }
}

export function handleMousePressed(e) {
  if (!state.inGame || uiOpen() || !e || (state.cnv && e.target !== state.cnv.elt)) return;
  $('#ctx')?.classList.add('hidden');
  if (mouseButton === RIGHT) {
    const item = selectedItem();
    if (!item || !Game.ITEMS[item].place) return;
    const [tx, ty] = mouseTile();
    if (inReach(tx, ty) && state.world.placeable(tx, ty)) {
      send('place', { x: tx, y: ty });
    }
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
