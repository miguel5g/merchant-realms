/* ============================================================
   ui/menu.js — Menu principal, lista de servidores e entrada no jogo.
   ============================================================ */

import { state } from '../state.js';
import { $, esc, toast } from '../utils.js';
import { connect } from '../network.js';
import { openChangelog } from './changelog.js';

export async function loadServers() {
  const box = $('#servers');
  if (!box) return;
  box.innerHTML = '';

  let list = [];
  try {
    list = await (await fetch('/servers')).json();
  } catch {
    box.innerHTML = '<div class="srv off"><span>não foi possível listar servidores</span></div>';
    return;
  }

  state.servers.list = [];
  for (const s of list) {
    const base = s.url || '';
    const t0 = performance.now();
    let st = null;
    try {
      st = await (await fetch(base + '/status', { mode: 'cors' })).json();
    } catch {}
    const ping = Math.round(performance.now() - t0);
    state.servers.list.push({ ...s, ...(st || {}), url: base, ping, ok: !!st });
  }

  state.servers.sel = state.servers.list.findIndex(s => s.ok);
  renderServers();

  const s = state.servers.list[state.servers.sel];
  if (s) {
    state.serverInfo.seed = s.seed;
    const menuSeed = $('#menu-seed');
    if (menuSeed) menuSeed.textContent = `${s.name} · seed ${s.seed}`;
    if (!state.world) {
      state.world = new Game.World(s.seed);
      state.chunkCache.clear();
    }
  }
}

export function renderServers() {
  const srvBox = $('#servers');
  if (!srvBox) return;

  srvBox.innerHTML = state.servers.list.map((s, i) => s.ok
    ? `<button class="srv ${i === state.servers.sel ? 'sel' : ''}" data-i="${i}"><span>${esc(s.name)}</span><span>${s.online} / ${s.max}</span><span>dia ${s.day}</span><span class="${s.ping < 120 ? 'green' : 'red'}">${s.ping} ms</span></button>`
    : `<div class="srv off"><span>${esc(s.url || 'servidor')}</span><span>—</span><span>—</span><span>offline</span></div>`
  ).join('') || '<div class="srv off"><span>nenhum servidor disponível</span></div>';

  srvBox.querySelectorAll('button.srv').forEach(b => {
    b.onclick = () => {
      state.servers.sel = +b.dataset.i;
      renderServers();
    };
  });
}

export function initMenuListeners() {
  $('#join')?.addEventListener('click', () => {
    const nameInput = $('#name');
    const rawName = nameInput ? nameInput.value : '';
    const menuErr = $('#menu-err');
    const valid = Game.validatePlayerName ? Game.validatePlayerName(rawName) : { ok: !!rawName.trim(), name: rawName.trim() };
    if (!valid.ok) {
      if (menuErr) menuErr.textContent = valid.reason;
      nameInput?.focus();
      return;
    }
    const name = valid.name;
    const s = state.servers.list[state.servers.sel];
    if (!s || !s.ok) {
      if (menuErr) menuErr.textContent = 'Selecione um servidor online.';
      return;
    }
    localStorage.setItem('nome', name);
    if (menuErr) menuErr.textContent = 'conectando…';
    connect(s.url, name);
  });

  const nameInput = $('#name');
  if (nameInput) {
    nameInput.value = localStorage.getItem('nome') || '';
    nameInput.addEventListener('keydown', e => {
      if (e.key === ' ') {
        e.preventDefault();
        const menuErr = $('#menu-err');
        if (menuErr) menuErr.textContent = 'Nomes não podem ter espaços. Use _ ou -.';
        return;
      }
      if (e.key === 'Enter') $('#join')?.click();
    });
    nameInput.addEventListener('input', () => {
      const menuErr = $('#menu-err');
      if (menuErr && (menuErr.textContent.includes('espaço') || menuErr.textContent.includes('caracteres') || menuErr.textContent.includes('letras'))) {
        const check = Game.validatePlayerName ? Game.validatePlayerName(nameInput.value) : { ok: true };
        if (check.ok) menuErr.textContent = '';
      }
    });
  }

  $('#create')?.addEventListener('click', () => {
    toast('Para criar um servidor: rode outra instância com PORT e SEED diferentes e liste em PEERS.');
  });

  $('#btn-controls')?.addEventListener('click', () => {
    $('#controls')?.classList.toggle('hidden');
  });

  $('#btn-changelog')?.addEventListener('click', () => {
    openChangelog();
  });

  $('#btn-credits')?.addEventListener('click', () => {
    toast('Protótipo em p5.js + Fastify. Interface baseada no design "Terras Abertas".');
  });

  const menuVerEl = $('.ver');
  if (menuVerEl) {
    menuVerEl.style.cursor = 'pointer';
    menuVerEl.title = 'Ver changelog e novidades';
    menuVerEl.onclick = () => openChangelog();
  }
}
