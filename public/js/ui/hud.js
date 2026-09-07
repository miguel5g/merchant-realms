/* ============================================================
   ui/hud.js — Barra de status, hotbar e tooltips de terreno/itens.
   ============================================================ */

import { state } from '../state.js';
import { $, esc, slotHTML, iconHTML, showTip, hideTip } from '../utils.js';
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

export function hideWorldTooltip() {
  const panel = $('#inspect-panel');
  if (panel && !panel.classList.contains('hidden')) {
    panel.classList.add('hidden');
    panel.dataset.resKey = '';
  }
}

export function worldTooltip() {
  const panel = $('#inspect-panel');
  if (!panel) return;
  if (overUI() || !state.world || !state.inGame) return hideWorldTooltip();

  const [tx, ty] = mouseTile();
  const t = state.world.tile(tx, ty);
  const res = Game.RES[t];
  if (!res) return hideWorldTooltip();

  const gen = res.gen ? Game.GENERATORS[res.gen] : null;
  const amt = state.world.amount(tx, ty);
  const ms = Game.mineTime(res, state.player.equip);
  const reach = inReach(tx, ty);
  const hasSp = state.player.inv.hasSpace(res.item);
  const en = state.player.energy;
  const hasTool = !!(res.tool && state.player.equip[res.tool]);

  const stateKey = `${tx},${ty},${t},${amt},${reach},${hasSp},${en < 1},${hasTool}`;
  if (panel.dataset.resKey === stateKey && !panel.classList.contains('hidden')) return;
  panel.dataset.resKey = stateKey;

  const itemInfo = Game.ITEMS[res.item];
  const itemName = itemInfo ? itemInfo.label.toLowerCase() : '';
  const timeSec = (ms / 1000).toFixed(1).replace('.', ',');
  const pct = Math.min(100, Math.max(0, Math.round((amt / (res.amount || 1)) * 100)));

  let toolText = '';
  if (hasTool) {
    toolText = '<span class="insp-tag ok">com ferramenta</span>';
  } else if (res.tool) {
    toolText = `<span class="insp-tag">${res.tool === 'axe' ? 'machado' : 'picareta'} acelera</span>`;
  }

  let alertHTML = '';
  if (!reach) {
    alertHTML = '<div class="insp-alert warn">fora de alcance</div>';
  } else if (gen && amt <= 0) {
    alertHTML = '<div class="insp-alert warn">produzindo — nada para recolher ainda</div>';
  } else if (!hasSp) {
    alertHTML = '<div class="insp-alert err">inventário cheio</div>';
  } else if (en < 1) {
    alertHTML = '<div class="insp-alert err">sem energia — descanse um pouco</div>';
  }

  let bodyHTML = '';
  if (gen) {
    const pctGen = Math.min(100, Math.max(0, Math.round((amt / gen.cap) * 100)));
    const every = (gen.interval / 1000).toFixed(0);
    bodyHTML = `
      <div class="insp-row"><span>Produz</span><span class="val">${gen.n} ${esc(itemName)} / ${every}s</span></div>
      <div class="insp-row"><span>Estoque</span><span class="val">${amt} / ${gen.cap}</span></div>
      <div class="insp-bar"><div class="fill" style="width:${pctGen}%"></div></div>
      <div class="insp-row"><span class="insp-tag">${amt > 0 ? 'segure botão direito para recolher' : 'aguarde a produção'}</span></div>
      ${alertHTML}
    `;
  } else if (res.built) {
    bodyHTML = `
      <div class="insp-row"><span class="val">botão direito para quebrar</span></div>
      <div class="insp-row"><span>Tempo</span><span class="val">${timeSec}s</span></div>
      ${alertHTML}
    `;
  } else {
    bodyHTML = `
      <div class="insp-row"><span>Dá</span><span class="val">${esc(itemName)}</span></div>
      <div class="insp-row"><span>Restante</span><span class="val">${amt} / ${res.amount}</span></div>
      <div class="insp-bar"><div class="fill" style="width:${pct}%"></div></div>
      <div class="insp-row"><span>Tempo</span><span class="val">${timeSec}s / un</span></div>
      ${toolText ? `<div class="insp-row">${toolText}</div>` : ''}
      ${alertHTML}
    `;
  }

  panel.innerHTML = `
    <div class="insp-head">
      ${iconHTML(res.item)}
      <div class="insp-title">
        <div class="insp-name">${esc(res.name)}</div>
        <div class="insp-type">${gen ? 'estrutura de blueprint' : res.built ? 'construção' : 'recurso natural'}</div>
      </div>
    </div>
    <div class="insp-body">
      ${bodyHTML}
    </div>
  `;
  panel.classList.remove('hidden');
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
    hideWorldTooltip();
  });
}
