/* ============================================================
   ui/hud.js — Barra de status, hotbar e tooltips de terreno/itens.
   ============================================================ */

import { state } from '../state.js';
import { $, esc, slotHTML, showTip, hideTip } from '../utils.js';
import { mouseTile, inReach, selectedItem, overUI, setSel } from '../input.js';

const HOTBAR = 8;

export function renderStatus() {
  const lvl = Game.levelFromXp(state.player.xp);
  const stLevel = $('#st-level');
  if (stLevel) stLevel.textContent = 'Nv ' + lvl;

  const stEn = $('#st-en');
  if (stEn) stEn.style.width = state.player.energy + '%';

  const stEnV = $('#st-en-v');
  if (stEnV) stEnV.textContent = `${state.player.energy}/100`;

  const stTime = $('#st-time');
  if (stTime) stTime.textContent = `Dia ${state.time.day} · ${Game.fmtClock(state.time.min)}`;

  const night = $('#night');
  if (night) night.style.opacity = (0.45 * Game.nightAlpha(state.time.min)).toFixed(2);
}

export function renderHotbar() {
  const hbSlots = $('#hb-slots');
  if (!hbSlots) return;

  hbSlots.innerHTML = state.player.inv.slots.slice(0, HOTBAR).map((s, i) =>
    slotHTML(s, { key: i + 1, sel: i === state.player.sel, data: `data-hb="${i}"` })
  ).join('');

  hbSlots.querySelectorAll('[data-hb]').forEach(el => {
    el.onclick = () => setSel(+el.dataset.hb);
  });

  const it = selectedItem();
  const hbLabel = $('#hb-label');
  if (hbLabel) {
    hbLabel.innerHTML = it
      ? `${esc(Game.ITEMS[it].label)}${Game.ITEMS[it].place ? ' <span class="dim">· botão esquerdo coloca</span>' : Game.ITEMS[it].tool ? ' <span class="dim">· equipe no inventário (E)</span>' : ''}`
      : '';
  }
}

export function worldTooltip() {
  if (overUI() || !state.world) return;
  const [tx, ty] = mouseTile();
  const t = state.world.tile(tx, ty);
  const res = Game.RES[t];
  if (!res) return hideTip();

  const lines = [res.name];
  if (res.built) {
    lines.push('construção · botão direito para quebrar');
  } else {
    lines.push('dá: ' + Game.ITEMS[res.item].label.toLowerCase());
    lines.push(`restante: ${state.world.amount(tx, ty)} / ${res.amount}`);
  }

  const ms = Game.mineTime(res, state.player.equip);
  lines.push(`${(ms / 1000).toFixed(1).replace('.', ',')}s por unidade${res.tool && state.player.equip[res.tool] ? ' (com ferramenta)' : res.tool ? ` · ${res.tool === 'axe' ? 'machado' : 'picareta'} acelera` : ''}`);

  if (!inReach(tx, ty)) {
    lines.push('fora de alcance');
  } else if (!state.player.inv.hasSpace(res.item)) {
    lines.push('inventário cheio');
  } else if (state.player.energy < 1) {
    lines.push('sem energia — descanse um pouco');
  }

  showTip(lines.join('\n'), mouseX, mouseY);
}

export function initTooltipListeners() {
  const handlePointer = e => {
    if (state.heldFrom !== null) {
      const heldEl = $('#held');
      if (heldEl) {
        heldEl.style.left = e.clientX + 12 + 'px';
        heldEl.style.top = e.clientY - 15 + 'px';
      }
      hideTip();
      return;
    }

    const el = e.target.closest?.('[data-tip]');
    if (el) {
      showTip(el.dataset.tip, e.clientX, e.clientY);
      return;
    }

    const ach = e.target.closest?.('#pf-ach [data-ach]');
    if (ach?.dataset?.ach) {
      showTip(ach.dataset.ach, e.clientX, e.clientY);
      return;
    }

    if (state.cnv && e.target !== state.cnv.elt) {
      hideTip();
    }
  };

  document.addEventListener('mousemove', handlePointer);
  document.addEventListener('mouseover', handlePointer);

  document.addEventListener('mouseleave', () => {
    hideTip();
  });
}
