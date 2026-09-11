/* ============================================================
   utils.js — Utilitários de DOM, escape, tooltips e marcação HTML.
   ============================================================ */

import { iconSVG } from './icons.js';

export const $ = s => document.querySelector(s);
export const $$ = s => document.querySelectorAll(s);
export const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));

let toastTimer;
export function toast(msg) {
  const t = $('#toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), 3500);
}

export function iconHTML(item, extra = '') {
  const info = Game.ITEMS[item];
  const col = info ? info.col : '#888';
  // Fallback pra cor sólida de antes fica por baixo — se algum item novo
  // ainda não tiver ícone desenhado em icons.js, continua aparecendo o
  // quadrado colorido em vez de ficar em branco.
  return `<div class="icon" style="background:${col}${extra}">${iconSVG(item) || ''}</div>`;
}

export function tipFor(s) {
  const it = Game.ITEMS[s.item];
  if (!it) return '';
  const lines = [it.label];
  if (s.dur !== undefined && it.dur) {
    lines.push(`durabilidade ${Math.round(100 * s.dur / it.dur)}%`);
  }
  return lines.join('\n');
}

export function slotHTML(s, o = {}) {
  const tip = s ? ` data-tip="${esc(tipFor(s)).replace(/\n/g, '|')}"` : '';
  const it = s ? Game.ITEMS[s.item] : null;
  const dur = s && s.dur !== undefined && it && it.dur
    ? `<div class="dur"><i style="width:${Math.round(100 * s.dur / it.dur)}%"></i></div>`
    : '';
  return `<div class="slot ${o.cls || ''} ${o.sel ? 'sel' : ''} ${o.dimmed ? 'dimmed' : ''}" ${o.data || ''}${tip}>${o.key !== undefined ? `<span class="key">${o.key}</span>` : ''}${s ? iconHTML(s.item) : ''}${s && s.n > 1 ? `<span class="n">${s.n}</span>` : ''}${dur}</div>`;
}

export function showTip(text, x, y) {
  const t = $('#tooltip');
  if (!t || !text) return;
  if (t.dataset.tipText !== text) {
    t.dataset.tipText = text;
    t.innerHTML = text.split(/\n|\|/).map((l, i) => `<div class="${i ? '' : 't'}">${esc(l)}</div>`).join('');
  }
  t.classList.remove('hidden');
  const w = t.offsetWidth, h = t.offsetHeight;
  t.style.left = Math.min(x + 14, window.innerWidth - w - 8) + 'px';
  t.style.top = Math.min(y + 14, window.innerHeight - h - 8) + 'px';
}

export function hideTip() {
  const t = $('#tooltip');
  if (t) {
    t.classList.add('hidden');
    t.dataset.tipText = '';
  }
}
