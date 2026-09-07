/* ============================================================
   ui/inventory.js — Inventário, equipamentos e bancada de fabricação.
   ============================================================ */

import { state } from '../state.js';
import { $, esc, slotHTML, iconHTML, tipFor, hideTip } from '../utils.js';
import { send } from '../network.js';

const HOTBAR = 8;

export function renderInventory() {
  const invEl = $('#inv');
  if (!invEl || invEl.classList.contains('hidden')) return;

  const inv = state.player.inv;
  const held = i => i === state.heldFrom;

  const invUsed = $('#inv-used');
  if (invUsed) invUsed.textContent = `${inv.used()} / 32 ocupados`;

  const invGrid = $('#inv-grid');
  if (invGrid) {
    invGrid.innerHTML = inv.slots.slice(HOTBAR).map((s, i) =>
      slotHTML(s, { data: `data-i="${i + HOTBAR}"`, dimmed: held(i + HOTBAR) })
    ).join('');
  }

  const invHot = $('#inv-hot');
  if (invHot) {
    invHot.innerHTML = inv.slots.slice(0, HOTBAR).map((s, i) =>
      slotHTML(s, { key: i + 1, sel: i === state.player.sel, data: `data-i="${i}"`, dimmed: held(i) })
    ).join('');
  }

  const invEquip = $('#inv-equip');
  if (invEquip) {
    invEquip.innerHTML = [['pick', 100, 'Picareta'], ['axe', 101, 'Machado']].map(([k, i, lab]) => {
      const s = state.player.equip[k];
      const eqTip = s ? ` data-tip="${esc(tipFor(s)).replace(/\n/g, '|')}"` : '';
      return `<div class="eq"${eqTip}>${slotHTML(s, { data: `data-i="${i}"`, dimmed: held(i) })}<div>${s ? `<div>${esc(Game.ITEMS[s.item].label)}</div><div class="dim">durabilidade ${Math.round(100 * s.dur / Game.ITEMS[s.item].dur)}%</div>` : `<div class="dim">${lab}</div><div class="dim2">vazio</div>`}</div></div>`;
    }).join('');
  }

  const invCoins = $('#inv-coins');
  if (invCoins) invCoins.textContent = state.player.coins;

  invEl.querySelectorAll('[data-i]').forEach(el => {
    const i = +el.dataset.i;
    el.onclick = () => {
      const has = i >= 100 ? state.player.equip[i === 100 ? 'pick' : 'axe'] : inv.slots[i];
      if (state.heldFrom === null) {
        if (has) {
          state.heldFrom = i;
          const heldEl = $('#held');
          if (heldEl) {
            heldEl.innerHTML = iconHTML(has.item) + (has.n > 1 ? has.n : '');
            heldEl.classList.remove('hidden');
          }
          hideTip();
        }
      } else {
        if (i !== state.heldFrom) send('swap', { from: state.heldFrom, to: i });
        state.heldFrom = null;
        $('#held')?.classList.add('hidden');
      }
      renderInventory();
    };
    el.oncontextmenu = ev => {
      ev.preventDefault();
      if (state.heldFrom === null && i < 100) send('split', { slot: i });
    };
  });

  renderCrafting();
}

export function renderCrafting() {
  const invCats = $('#inv-cats');
  if (invCats) {
    invCats.innerHTML = Game.RECIPE_CATS.map(([k, l]) =>
      `<button class="${k === state.craftCat ? 'on' : ''}" data-c="${k}">${l}</button>`
    ).join('');

    invCats.querySelectorAll('button').forEach(b => {
      b.onclick = () => {
        state.craftCat = b.dataset.c;
        state.craftSel = null;
        renderCrafting();
      };
    });
  }

  const list = Game.RECIPES.map((r, k) => ({ r, k })).filter(x => x.r.cat === state.craftCat);
  if (state.craftSel !== null && !list.some(x => x.k === state.craftSel)) {
    state.craftSel = null;
  }

  const recipesEl = $('#recipes');
  if (recipesEl) {
    recipesEl.innerHTML = list.map(({ r, k }) => {
      const n = Game.craftableCount(state.player.inv, r);
      return `<button class="rcp ${k === state.craftSel ? 'on' : ''} ${n ? '' : 'no'}" data-k="${k}" data-tip="${esc(Game.ITEMS[r.out].label)}">${iconHTML(r.out)}<span class="name">${esc(Game.ITEMS[r.out].label)}</span><span class="cnt">×${n}</span></button>`;
    }).join('');

    recipesEl.querySelectorAll('.rcp').forEach(b => {
      b.onclick = e => {
        state.craftSel = +b.dataset.k;
        if (e.shiftKey) doCraft(100);
        renderCrafting();
      };
    });
  }

  const rdetail = $('#rdetail');
  if (rdetail) {
    const r = state.craftSel !== null ? Game.RECIPES[state.craftSel] : null;
    if (!r) {
      rdetail.innerHTML = `
        <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;color:var(--dim);gap:10px;padding:16px;">
          <div style="font-size:28px;opacity:0.5;">⚒</div>
          <div class="px gold" style="font-size:18px">Nenhum item selecionado</div>
          <div style="font-size:16px;line-height:1.3">Selecione um item na lista ao lado para ver os materiais e fabricar.</div>
        </div>
      `;
      return;
    }

    const n = Game.craftableCount(state.player.inv, r);
    const needsHTML = Object.entries(r.needs).map(([it, q]) => {
      const has = state.player.inv.count(it);
      const ok = has >= q;
      return `<div class="row"><span>${esc(Game.ITEMS[it].label)}</span><span><span class="${ok ? 'green' : 'red'}">${has}</span> / ${q}</span></div>`;
    }).join('');

    rdetail.innerHTML = `<div class="big">${iconHTML(r.out)}</div><div class="px gold" style="font-size:18px;text-align:center">${esc(Game.ITEMS[r.out].label)}</div><div class="desc">${esc(Game.ITEMS[r.out].desc)}</div><div class="rule"></div>`
      + `<div class="row dim" style="font-size:15px"><span>Materiais necessários</span><span>possui / exige</span></div>`
      + needsHTML
      + `<div class="row dim"><span>Valor</span><span>${Game.ITEMS[r.out].value} coroas</span></div><div class="buttons"><button class="btn primary" id="cr1" ${n ? '' : 'disabled'}>Fabricar ×1</button><button class="btn" id="cr10" ${n ? '' : 'disabled'}>×10</button></div>`;

    $('#cr1')?.addEventListener('click', e => doCraft(e.shiftKey ? 100 : 1));
    $('#cr10')?.addEventListener('click', e => doCraft(e.shiftKey ? 100 : 10));
  }
}

export function doCraft(n) {
  if (state.craftSel === null) return;
  send('craft', { k: state.craftSel, n });
}
