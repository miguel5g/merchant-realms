/* ============================================================
   ui/trade.js — Interface de negociação e trocas diretas.
   ============================================================ */

import { state } from '../state.js';
import { $, esc, slotHTML } from '../utils.js';
import { send } from '../network.js';
import { closeChest } from './chest.js';

export function openTrade() {
  const t = state.trade;
  if (!t) return;

  closeChest();
  $('#inv')?.classList.add('hidden');
  $('#profile')?.classList.add('hidden');
  $('#trade')?.classList.remove('hidden');

  $('#tr-title').textContent = `Troca com ${t.partnerName}`;
  $('#tr-dist').textContent = `distância ${t.dist} tiles · a troca cancela se alguém se afastar`;
  $('#tr-mysq').style.background = state.player.col;
  $('#tr-thsq').style.background = t.partnerCol;
  $('#tr-thname').textContent = `${t.partnerName} oferece`;
  $('#tr-myconf').innerHTML = t.mine.conf ? '<span class="green">Confirmado</span>' : '<span class="dim">Montando oferta</span>';
  $('#tr-thconf').innerHTML = t.theirs.conf ? '<span class="green">Confirmado</span>' : '<span class="gold">Aguardando…</span>';

  const pad = arr => [...arr, ...Array(Math.max(0, 8 - arr.length)).fill(null)];
  $('#tr-myoffer').innerHTML = pad(t.mine.items).map((s, i) => slotHTML(s, { data: `data-off="${i}"` })).join('');
  $('#tr-myoffer').querySelectorAll('[data-off]').forEach(el => {
    el.onclick = () => {
      if (t.mine.items[+el.dataset.off]) send('trade_remove', { i: +el.dataset.off });
    };
  });

  $('#tr-thoffer').innerHTML = pad(t.theirs.items).map(s => slotHTML(s)).join('');

  if (document.activeElement !== $('#tr-mycoins')) {
    $('#tr-mycoins').value = t.mine.coins;
  }
  $('#tr-mymax').textContent = 'de ' + state.player.coins;
  $('#tr-thcoins').textContent = t.theirs.coins;

  const vm = Game.offerValue(t.mine.items, t.mine.coins);
  const vt = Game.offerValue(t.theirs.items, t.theirs.coins);
  $('#tr-values').textContent = `${vm} vs ${vt}`;

  const ratio = vm && vt ? vt / vm : 0;
  $('#tr-fair').innerHTML = !vm && !vt
    ? '<span class="dim">nada oferecido ainda</span>'
    : ratio >= 0.8 && ratio <= 1.25
      ? '<span class="green">Troca justa</span>'
      : ratio > 1.25
        ? '<span class="green">A seu favor</span>'
        : '<span class="red">Contra você</span>';

  const ps = t.partnerStats;
  const rep = ps.trades + ps.canceled ? Math.round(100 * ps.trades / (ps.trades + ps.canceled)) : null;

  $('#tr-about-t').textContent = `Sobre ${t.partnerName}`;
  $('#tr-about').innerHTML = `<div class="row"><span class="dim">Nível</span><span>${ps.level} · ${esc(Game.titleFor(ps.level))}</span></div><div class="row"><span class="dim">Trocas concluídas</span><span>${ps.trades}</span></div><div class="row"><span class="dim">Reputação</span><span class="${rep === null ? 'dim' : rep >= 80 ? 'green' : 'red'}">${rep === null ? 'sem histórico' : (rep >= 80 ? 'Confiável' : 'Cuidado') + ` (${rep}%)`}</span></div>`;
  $('#tr-confirm').textContent = t.mine.conf ? 'Confirmado ✓' : 'Confirmar troca';

  renderTradeInv();
}

export function renderTradeInv() {
  if (!state.trade || $('#trade')?.classList.contains('hidden')) return;

  const trInv = $('#tr-inv');
  if (!trInv) return;

  trInv.innerHTML = state.player.inv.slots.map((s, i) =>
    slotHTML(s, { cls: 's44', data: `data-ti="${i}"` })
  ).join('');

  trInv.querySelectorAll('[data-ti]').forEach(el => {
    const i = +el.dataset.ti;
    el.onclick = () => {
      if (state.player.inv.slots[i]) send('trade_add', { slot: i, n: 99 });
    };
    el.oncontextmenu = ev => {
      ev.preventDefault();
      if (state.player.inv.slots[i]) send('trade_add', { slot: i, n: 1 });
    };
  });
}

export function initTradeListeners() {
  $('#tr-mycoins')?.addEventListener('change', () => {
    send('trade_coins', { n: +$('#tr-mycoins').value || 0 });
  });
  $('#tr-confirm')?.addEventListener('click', () => send('trade_confirm'));
  $('#tr-cancel')?.addEventListener('click', () => send('trade_cancel'));
}
