/* ============================================================
   ui/chest.js — Janela do baú: armazenamento do tile + inventário do jogador.
   ============================================================ */

import { state } from '../state.js';
import { $, iconHTML, slotHTML, toast, hideTip } from '../utils.js';
import { send } from '../network.js';

const CH = 200;      // deslocamento dos índices de slot do baú (igual ao servidor)
const HOTBAR = 8;

export function chestOpen() {
  return !!state.chest;
}

// Pilhas guardadas no baú do tile (x, y) segundo o cliente. É só um cache do
// que o servidor mandou — serve para o painel de inspeção e para o cursor.
export function chestUsedAt(x, y) {
  return state.chestUsed.get(`${x},${y}`) || 0;
}

export function openChest(m) {
  // Atualização de um baú que já fechamos aqui (o chest_close ainda não chegou
  // ao servidor): ignora, senão a janela volta a existir só no estado.
  if (!m.open && !state.chest) return;
  state.chest = { x: m.x, y: m.y, slots: m.slots };
  if (m.open) {
    ['#inv', '#profile', '#changelog', '#chatbox', '#players'].forEach(sel => $(sel)?.classList.add('hidden'));
    state.heldFrom = null;
    $('#held')?.classList.add('hidden');
    $('#chest')?.classList.remove('hidden');
  }
  renderChest();
}

export function closeChest(notify = true) {
  if (!state.chest) return;
  state.chest = null;
  $('#chest')?.classList.add('hidden');
  state.heldFrom = null;
  $('#held')?.classList.add('hidden');
  hideTip();
  if (notify) send('chest_close');
}

// A janela fecha sozinha se o jogador for parar longe do baú (um /tp, por
// exemplo — andar não dá, porque a janela aberta trava o movimento).
export function checkChestRange() {
  const c = state.chest;
  if (!c) return;
  const d = Game.dist(state.player.x, state.player.y, c.x * Game.TILE + Game.TILE / 2, c.y * Game.TILE + Game.TILE / 2);
  if (d > Game.CHEST_DIST) {
    closeChest();
    toast('Você se afastou do baú.');
  }
}

export function renderChest() {
  const el = $('#chest');
  if (!el || el.classList.contains('hidden') || !state.chest) return;

  const inv = state.player.inv;
  const box = state.chest.slots;
  const held = i => i === state.heldFrom;

  const used = box.filter(Boolean).length;
  const chUsed = $('#ch-used');
  if (chUsed) chUsed.textContent = `${used} / ${Game.CHEST_SLOTS} ocupados`;

  const chInvUsed = $('#ch-invused');
  if (chInvUsed) chInvUsed.textContent = `${inv.used()} / 32 ocupados`;

  const grid = $('#ch-grid');
  if (grid) {
    grid.innerHTML = box.map((s, i) =>
      slotHTML(s, { data: `data-ci="${i + CH}"`, dimmed: held(i + CH) })
    ).join('');
  }

  const list = $('#ch-inv');
  if (list) {
    list.innerHTML = inv.slots.map((s, i) =>
      slotHTML(s, {
        key: i < HOTBAR ? i + 1 : undefined,
        sel: i === state.player.sel,
        data: `data-ci="${i}"`,
        dimmed: held(i)
      })
    ).join('');
  }

  el.querySelectorAll('[data-ci]').forEach(node => {
    const i = +node.dataset.ci;
    node.onclick = e => {
      const has = i >= CH ? box[i - CH] : inv.slots[i];
      if (e.shiftKey) {                                   // move a pilha inteira
        state.heldFrom = null;
        $('#held')?.classList.add('hidden');
        if (has) send('chest_quick', { i });
        renderChest();
        return;
      }
      if (state.heldFrom === null) {
        if (!has) return;
        state.heldFrom = i;
        const heldEl = $('#held');
        if (heldEl) {
          heldEl.innerHTML = iconHTML(has.item) + (has.n > 1 ? has.n : '');
          heldEl.classList.remove('hidden');
        }
        hideTip();
      } else {
        if (i !== state.heldFrom) send('chest_move', { from: state.heldFrom, to: i });
        state.heldFrom = null;
        $('#held')?.classList.add('hidden');
      }
      renderChest();
    };
  });

  const title = $('#ch-title');
  if (title) title.textContent = `Baú · ${state.chest.x}, ${state.chest.y}`;
}

export function initChestListeners() {
  $('#ch-close')?.addEventListener('click', () => closeChest());
}
