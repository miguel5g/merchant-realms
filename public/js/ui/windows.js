/* ============================================================
   ui/windows.js — Gerenciador de janelas modais e atalhos de teclado.
   ============================================================ */

import { state } from '../state.js';
import { $, hideTip } from '../utils.js';
import { send } from '../network.js';
import { renderInventory } from './inventory.js';
import { renderProfile } from './profile.js';
import { renderPlayers, renderChat } from './chat.js';
import { renderChangelog } from './changelog.js';
import { setSel } from '../input.js';

export function uiOpen() {
  return !$('#inv').classList.contains('hidden') ||
         !$('#trade').classList.contains('hidden') ||
         !$('#profile').classList.contains('hidden') ||
         !$('#changelog').classList.contains('hidden');
}

export function typing() {
  const a = document.activeElement;
  return a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA');
}

export function closeAll() {
  ['#inv', '#trade', '#profile', '#changelog', '#chatbox', '#players', '#ctx'].forEach(s => {
    const el = $(s);
    if (el) el.classList.add('hidden');
  });
  state.heldFrom = null;
  const heldEl = $('#held');
  if (heldEl) heldEl.classList.add('hidden');
  hideTip();
  if (state.trade) send('trade_cancel');
}

export function toggle(id) {
  const el = $('#' + id);
  if (!el) return;
  const open = el.classList.contains('hidden');

  if (id === 'inv' || id === 'profile' || id === 'changelog') {
    $('#inv')?.classList.add('hidden');
    $('#profile')?.classList.add('hidden');
    $('#changelog')?.classList.add('hidden');
    state.heldFrom = null;
    $('#held')?.classList.add('hidden');
  }

  if (open) {
    el.classList.remove('hidden');
    if (id === 'inv') renderInventory();
    if (id === 'profile') renderProfile();
    if (id === 'players') renderPlayers();
    if (id === 'changelog') renderChangelog();
  } else {
    el.classList.add('hidden');
  }
}

export function initWindowListeners() {
  $('#quick')?.querySelectorAll('button').forEach(b => {
    b.onclick = () => toggle(b.dataset.open);
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !$('#changelog').classList.contains('hidden')) {
      $('#changelog').classList.add('hidden');
      return;
    }
    if (!state.inGame) return;

    if (e.key === 'Escape') {
      if (typing()) {
        document.activeElement.blur();
        $('#chatbox')?.classList.add('hidden');
      } else if (state.trade) {
        send('trade_cancel');
      } else {
        ['#inv', '#profile', '#changelog', '#players', '#ctx'].forEach(s => $(s)?.classList.add('hidden'));
        $('#chatbox')?.classList.add('hidden');
        state.heldFrom = null;
        $('#held')?.classList.add('hidden');
      }
      return;
    }

    if (typing()) return;

    if (e.key === 'Enter') {
      e.preventDefault();
      $('#chatbox')?.classList.remove('hidden');
      renderChat();
      $('#chatinput')?.focus();
      return;
    }

    if (state.trade) return;

    const k = e.key.toLowerCase();
    if (k === 'e' || e.key === 'Tab') {
      e.preventDefault();
      toggle('inv');
    } else if (k === 'p') {
      toggle('profile');
    } else if (k === 'c') {
      toggle('changelog');
    } else if (k === 't') {
      toggle('players');
    } else if (e.key >= '1' && e.key <= '8') {
      setSel(+e.key - 1);
    }

    if (['w', 'a', 's', 'd', ' '].includes(k) || e.key.startsWith('Arrow')) {
      e.preventDefault();
    }
  });

  document.addEventListener('mousedown', e => {
    if (!e.target.closest('#ctx') && !e.target.closest('#pl-list')) {
      $('#ctx')?.classList.add('hidden');
    }
  });
}
