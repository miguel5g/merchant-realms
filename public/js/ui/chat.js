/* ============================================================
   ui/chat.js — Chat multiplayer, canais, lista de jogadores e menu de contexto.
   ============================================================ */

import { state } from '../state.js';
import { $, esc, toast } from '../utils.js';
import { send } from '../network.js';
import { initChatComplete, closeComplete } from './chatcmd.js';

export function pushChat(m) {
  state.chat.push(m);
  if (state.chat.length > 200) state.chat.shift();
  if (m.ch === 'whisper' && m.fromId !== state.player.id) state.lastWhisper = m.from;
  renderChat();
}

export function lineHTML(m) {
  if (m.ch === 'sys') {
    let act = '';
    if (m.action) {
      act = m.action.done
        ? ` <span class="dim">(${m.action.done})</span>`
        : ` <span class="act" data-acc="${m.action.id}">[Aceitar]</span><span class="act no" data-dec="${m.action.id}">[Recusar]</span>`;
    }
    return `<div class="msg"><span class="ch sys">[Sistema]</span> ${esc(m.text)}${act}</div>`;
  }
  const who = `<span style="color:${m.col}">${esc(m.from)}${m.ch === 'whisper' ? '' : ':'}</span>`;
  if (m.ch === 'whisper') {
    return `<div class="msg"><span class="ch w">[${m.fromId === state.player.id ? 'Sussurro para ' + esc(m.to) : 'Sussurro de ' + esc(m.from)}]</span> ${esc(m.text)}</div>`;
  }
  const lab = { global: 'Global', local: 'Local', trade: 'Comércio' }[m.ch] || m.ch;
  return `<div class="msg"><span class="ch">[${lab}]</span> ${who} ${esc(m.text)}</div>`;
}

export function renderChat() {
  const mini = $('#chatmini-lines');
  if (mini) mini.innerHTML = state.chat.slice(-5).map(lineHTML).join('');

  const chatbox = $('#chatbox');
  if (chatbox && !chatbox.classList.contains('hidden')) {
    const f = state.chatTab === 'all'
      ? state.chat
      : state.chat.filter(m => m.ch === state.chatTab || (state.chatTab === 'global' && m.ch === 'sys'));

    let day = null, html = '';
    for (const m of f.slice(-80)) {
      if (m.day !== day) {
        day = m.day;
        html += `<div class="msg sep">— dia ${day} —</div>`;
      }
      html += lineHTML(m);
    }
    const chatlog = $('#chatlog');
    if (chatlog) {
      chatlog.innerHTML = html;
      chatlog.scrollTop = 1e9;
    }
    chatbox.querySelectorAll('.tabs button').forEach(b => {
      b.classList.toggle('on', b.dataset.tab === state.chatTab);
    });
  }

  document.querySelectorAll('[data-acc]').forEach(b => {
    b.onclick = () => {
      send('trade_accept', { id: +b.dataset.acc });
      markAction(+b.dataset.acc, 'aceito');
    };
  });
  document.querySelectorAll('[data-dec]').forEach(b => {
    b.onclick = () => {
      send('trade_decline', { id: +b.dataset.dec });
      markAction(+b.dataset.dec, 'recusado');
    };
  });
}

export function markAction(id, done) {
  for (const m of state.chat) {
    if (m.action && m.action.id === id && !m.action.done) m.action.done = done;
  }
  renderChat();
}

export function renderPlayers() {
  const playersEl = $('#players');
  if (!playersEl || playersEl.classList.contains('hidden')) return;

  const plCount = $('#pl-count');
  if (plCount) plCount.textContent = `${state.others.size + 1} / ${state.serverInfo.max}`;

  const rows = [
    { id: state.player.id, name: state.player.name, col: state.player.col, me: true, level: Game.levelFromXp(state.player.xp) },
    ...[...state.others.values()].sort((a, b) => a.name.localeCompare(b.name))
  ];

  const plList = $('#pl-list');
  if (plList) {
    plList.innerHTML = rows.map(o => {
      const where = o.me
        ? `${Math.floor(state.player.x / Game.TILE)}, ${Math.floor(state.player.y / Game.TILE)}`
        : `a ${Math.round(Game.dist(state.player.x, state.player.y, o.x, o.y) / Game.TILE)} tiles`;
      return `<div class="pl ${o.me ? 'me' : ''}" data-pid="${o.id}"><span><span style="color:${o.col}">■</span> ${esc(o.name)} <span class="dim">${o.me ? '(você)' : 'nv ' + (o.level || 1)}</span></span><span class="where">${where}</span></div>`;
    }).join('');

    plList.querySelectorAll('.pl:not(.me)').forEach(el => {
      el.onclick = el.oncontextmenu = ev => {
        ev.preventDefault();
        openCtx(+el.dataset.pid, ev.clientX, ev.clientY);
      };
    });
  }
}

export function openCtx(id, x, y) {
  const o = state.others.get(id);
  if (!o) return;
  const far = Game.dist(state.player.x, state.player.y, o.x, o.y) > Game.TRADE_DIST;
  const c = $('#ctx');
  if (!c) return;

  c.innerHTML = `<div class="who">${esc(o.name)}</div><button data-a="w">Sussurrar</button><button data-a="t" ${far ? 'class="dim"' : ''}>Negociar${far ? ' (longe)' : ''}</button>`;
  c.classList.remove('hidden');
  c.style.left = Math.min(x, window.innerWidth - 180) + 'px';
  c.style.top = Math.min(y, window.innerHeight - 120) + 'px';

  c.querySelector('[data-a=w]').onclick = () => {
    c.classList.add('hidden');
    $('#chatbox')?.classList.remove('hidden');
    renderChat();
    const inp = $('#chatinput');
    if (inp) {
      inp.value = `/w ${o.name} `;
      inp.focus();
    }
  };
  c.querySelector('[data-a=t]').onclick = () => {
    c.classList.add('hidden');
    send('trade_req', { id });
  };
}

export function initChatListeners() {
  $('#chatbox')?.querySelectorAll('.tabs button').forEach(b => {
    b.onclick = () => {
      state.chatTab = b.dataset.tab;
      const chip = $('#chatchip');
      if (chip) {
        chip.textContent = state.chatTab === 'all'
          ? 'global'
          : state.chatTab === 'whisper'
            ? 'sussurro'
            : state.chatTab === 'trade'
              ? 'comércio'
              : state.chatTab;
      }
      renderChat();
      $('#chatinput')?.focus();
    };
  });

  $('#chatform')?.addEventListener('submit', e => {
    e.preventDefault();
    const inp = $('#chatinput');
    if (!inp) return;
    const raw = inp.value.trim();
    inp.value = '';
    closeComplete();
    if (!raw) return;
    sendLine(raw);
  });

  initChatComplete();
}

/* Uma linha digitada no chat: comando conhecido ou mensagem do canal atual.
   Comandos de canal viram uma mensagem aqui mesmo; os de servidor (admin)
   seguem crus para o servidor, que analisa e responde. */
export function sendLine(raw) {
  let ch = state.chatTab === 'all' ? 'global' : state.chatTab, to = null, text = raw;

  if (raw.startsWith('/')) {
    const parsed = Game.parseCommand(raw);
    if (!parsed.ok) {
      // Comando desconhecido: mostra a lista. Argumento faltando: o erro já traz o uso.
      const list = Game.commandsFor(state.player.admin).map(c => Game.usage(c)).join(' · ');
      return toast(parsed.def ? parsed.error : `${parsed.error} Comandos: ${list}`);
    }
    const { def, values } = parsed;

    if (def.scope === 'server') return send('cmd', { text: raw });

    ch = def.ch;
    text = values.mensagem || '';
    if (ch === 'whisper') {
      to = def.reply ? state.lastWhisper : values.jogador;
      if (!to) return toast('Ninguém sussurrou para você ainda.');
    }
    if (!text.trim()) return toast(`Uso: ${Game.usage(def)}`);
  }

  if (text.trim()) send('chat', { ch, text, to });
}
