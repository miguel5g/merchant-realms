/* ============================================================
   ui/chatcmd.js — Autocompletar do chat: sugere comandos e, dentro
   de cada um, os valores válidos do argumento sob o cursor.
   As definições vêm de shared/Commands.js (as mesmas do servidor).
   ============================================================ */

import { state } from '../state.js';
import { $, esc } from '../utils.js';

const MAX = 8;

// list: sugestões visíveis · sel: destacada · start: onde a substituição começa
// moved: o jogador escolheu com as setas (só então Enter completa em vez de enviar)
const ac = { open: false, list: [], rest: 0, sel: 0, start: 0, moved: false, sig: '', desc: '' };

const norm = s => Game.normCmd(s);
const input = () => $('#chatinput');

/* ---------- valores sugeridos por tipo de argumento ---------- */

function playerOptions() {
  const rows = [
    { value: state.player.name, hint: 'você', col: state.player.col },
    ...[...state.others.values()]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(o => ({ value: o.name, hint: `nv ${o.level || 1}`, col: o.col })),
  ];
  return rows;
}

function itemOptions() {
  return Object.keys(Game.ITEMS).map(k => ({ value: k, hint: Game.ITEMS[k].label, col: Game.ITEMS[k].col }));
}

function blockOptions() {
  return Game.BLOCK_NAMES.map(n => ({ value: n, hint: Game.BLOCK_LABEL[n] }));
}

// x e z do /place: a posição de quem digita é o palpite mais útil.
function coordOptions(argName) {
  const tile = argName === 'x'
    ? Math.floor(state.player.x / Game.TILE)
    : Math.floor(state.player.y / Game.TILE);
  return [{ value: String(tile), hint: `sua posição (${argName})` }];
}

function optionsFor(arg) {
  switch (arg.type) {
    case 'player': return playerOptions();
    case 'item':   return itemOptions();
    case 'block':  return blockOptions();
    case 'coord':  return coordOptions(arg.name);
    case 'int':    return [1, 10, Game.STACK].map(n => ({ value: String(n), hint: n === Game.STACK ? 'pilha cheia' : 'unidades' }));
    default:       return [];
  }
}

/* ---------- montagem da lista ---------- */

// "/give <jogador> <item> [quantidade]" com o argumento atual em destaque.
function signature(def, active) {
  const parts = def.args.map((a, i) => {
    const label = a.opt ? `[${a.name}]` : `<${a.name}>`;
    return i === active ? `<b>${esc(label)}</b>` : esc(label);
  });
  return `<span class="cmd">/${esc(def.name)}</span> ${parts.join(' ')}`;
}

// Ordena por relevância (começa com > contém) e corta em MAX,
// guardando quantos ficaram de fora para avisar no rodapé.
function match(list, prefix) {
  let hits = list;
  if (prefix) {
    const p = norm(prefix);
    const starts = list.filter(o => norm(o.value).startsWith(p));
    const inside = list.filter(o => !norm(o.value).startsWith(p) && (norm(o.value).includes(p) || norm(o.hint || '').includes(p)));
    hits = [...starts, ...inside];
  }
  const out = hits.slice(0, MAX);
  out.rest = hits.length - out.length;
  return out;
}

export function refreshComplete() {
  const inp = input();
  if (!inp || document.activeElement !== inp) return close();

  const text = inp.value;
  const caret = inp.selectionStart ?? text.length;
  const ctx = Game.argAt(text, caret);
  if (!ctx) return close();

  const prefix = text.slice(ctx.start, caret);

  if (ctx.kind === 'cmd') {
    const list = Game.commandsFor(state.player.admin).map(c => ({
      value: c.name,
      insert: c.name,
      hint: c.desc,
      admin: c.admin,
    }));
    return show(match(list, prefix), 'Comandos', 'Tab completa · ↑↓ escolhe · Esc fecha', ctx.start);
  }

  const list = match(optionsFor(ctx.arg).map(o => ({ ...o, insert: o.value })), prefix);

  // Texto livre (mensagem, motivo): sem sugestões. Nos comandos de servidor
  // mantemos a assinatura à vista; no chat comum, sai da frente.
  if (!list.length && ctx.arg.type === 'text' && ctx.def.scope !== 'server') return close();

  show(list, signature(ctx.def, ctx.index), ctx.def.desc, ctx.start);
}

function show(list, sig, desc, start) {
  ac.open = true;
  ac.list = list;
  ac.rest = list.rest || 0;
  ac.sig = sig;
  ac.desc = desc;
  ac.start = start;
  if (ac.sel >= list.length) ac.sel = 0;
  if (!list.length) { ac.sel = 0; ac.moved = false; }
  render();
}

export function closeComplete() { close(); }

function close() {
  ac.open = false;
  ac.list = [];
  ac.sel = 0;
  ac.moved = false;
  $('#chat-ac')?.classList.add('hidden');
}

function render() {
  const el = $('#chat-ac');
  if (!el) return;
  const opts = ac.list.map((o, i) => {
    const dot = o.col ? `<span class="dot" style="background:${esc(o.col)}"></span>` : '';
    const tag = o.admin ? '<span class="tag">admin</span>' : '';
    return `<div class="opt ${i === ac.sel ? 'on' : ''}" data-i="${i}">${dot}<span class="v">${esc(o.value)}</span>${tag}<span class="h">${esc(o.hint || '')}</span></div>`;
  }).join('');

  el.innerHTML =
    `<div class="sig">${ac.sig}${ac.desc ? ` <span class="d">${esc(ac.desc)}</span>` : ''}</div>` +
    (opts ? `<div class="opts">${opts}</div>` : '') +
    `<div class="tip">${ac.list.length ? 'Tab completa · ↑↓ escolhe · Esc fecha' : 'digite o valor · Esc fecha'}${ac.rest ? ` <span class="more">+${ac.rest} sem caber na lista</span>` : ''}</div>`;
  el.classList.remove('hidden');

  el.querySelectorAll('.opt').forEach(o => {
    o.onmousedown = e => {           // mousedown: aceita antes do input perder o foco
      e.preventDefault();
      ac.sel = +o.dataset.i;
      accept();
    };
  });
}

function move(d) {
  if (!ac.list.length) return;
  ac.sel = (ac.sel + d + ac.list.length) % ac.list.length;
  ac.moved = true;
  render();
}

function accept() {
  const opt = ac.list[ac.sel];
  const inp = input();
  if (!opt || !inp) return false;

  const text = inp.value;
  const caret = inp.selectionStart ?? text.length;
  const after = text.slice(caret);
  const before = text.slice(0, ac.start) + opt.insert + (after.startsWith(' ') ? '' : ' ');

  inp.value = before + after;
  inp.setSelectionRange(before.length, before.length);
  ac.moved = false;
  refreshComplete();
  return true;
}

/* ---------- teclado ---------- */

// Devolve true quando consumiu a tecla (o chat não deve tratá-la).
function onKeydown(e) {
  if (!ac.open) return false;

  if (e.key === 'ArrowDown') { move(1); return true; }
  if (e.key === 'ArrowUp') { move(-1); return true; }
  if (e.key === 'Tab') { accept(); return true; }   // Tab nunca sai do campo com a lista aberta
  if (e.key === 'Enter' && ac.moved) return accept();
  if (e.key === 'Escape') { close(); return true; }
  return false;
}

export function initChatComplete() {
  const inp = input();
  if (!inp) return;

  inp.addEventListener('keydown', e => {
    if (onKeydown(e)) {
      e.preventDefault();
      e.stopPropagation();      // Esc não pode fechar o chat enquanto a lista está aberta
    }
  });
  inp.addEventListener('input', refreshComplete);
  inp.addEventListener('click', refreshComplete);
  inp.addEventListener('focus', refreshComplete);
  inp.addEventListener('blur', () => close());
}
