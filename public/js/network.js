/* ============================================================
   network.js — WebSocket, conexão, pacotes e sincronização de rede.
   ============================================================ */

import { state } from './state.js';
import { $, toast } from './utils.js';
import { invalidateChunkAt } from './renderer.js';
import { renderStatus, renderHotbar } from './ui/hud.js';
import { renderInventory } from './ui/inventory.js';
import { openTrade, renderTradeInv } from './ui/trade.js';
import { renderChat, renderPlayers, pushChat } from './ui/chat.js';
import { renderProfile } from './ui/profile.js';
import { closeAll } from './ui/windows.js';
import { loadServers } from './ui/menu.js';

export function connect(base, name) {
  state.rejectReason = null;
  const u = base ? new URL(base) : location;
  const proto = u.protocol === 'https:' ? 'wss' : 'ws';
  state.ws = new WebSocket(`${proto}://${u.host}/ws?nome=${encodeURIComponent(name)}`);

  state.ws.onmessage = e => {
    try {
      onMessage(JSON.parse(e.data));
    } catch (err) {
      console.error('Erro ao processar pacote do servidor:', err);
    }
  };

  state.ws.onclose = () => {
    if (state.inGame) {
      leaveGame('Desconectado do servidor.');
    } else {
      const errEl = $('#menu-err');
      if (errEl) {
        if (state.rejectReason) {
          errEl.textContent = state.rejectReason;
        } else if (!errEl.textContent || errEl.textContent === 'conectando…') {
          errEl.textContent = 'Conexão encerrada.';
        }
      }
      state.connected = false;
    }
  };

  state.ws.onerror = () => {
    const errEl = $('#menu-err');
    if (errEl && !state.rejectReason) errEl.textContent = 'Não foi possível conectar.';
  };
}

export function send(type, data = {}) {
  if (state.connected && state.ws && state.ws.readyState === WebSocket.OPEN) {
    state.ws.send(JSON.stringify({ type, ...data }));
  }
}

export function leaveGame(msg) {
  state.inGame = false;
  state.connected = false;
  state.others.clear();
  state.chat = [];
  state.trade = null;
  closeAll();
  $('#hud')?.classList.add('hidden');
  $('#menu')?.classList.remove('hidden');
  const errEl = $('#menu-err');
  if (errEl) errEl.textContent = msg || '';
  loadServers();
}

export function renderAll() {
  renderStatus();
  renderHotbar();
  renderChat();
  renderPlayers();
  renderInventory();
}

export function onMessage(m) {
  switch (m.type) {
    case 'reject':
      state.rejectReason = m.reason;
      const err = $('#menu-err');
      if (err) err.textContent = m.reason;
      break;

    case 'init':
      state.world = new Game.World(m.seed);
      state.world.load(m.world);
      state.chunkCache.clear();
      Object.assign(state.player, {
        id: m.id,
        name: m.name,
        col: m.col,
        x: m.x,
        y: m.y,
        coins: m.coins,
        xp: m.xp,
        energy: m.energy,
        stats: m.stats,
        achievements: m.achievements,
        equip: m.equip
      });
      state.player.inv.slots = m.slots;
      state.others.clear();
      for (const o of m.players) {
        state.others.set(o.id, { ...o, tx: o.x, ty: o.y });
      }
      state.serverInfo = { name: m.server, max: m.max, seed: m.seed };
      state.time = m.time;
      state.chat = m.chat.map(c => ({ ...c }));
      state.connected = true;
      state.inGame = true;

      $('#menu')?.classList.add('hidden');
      $('#hud')?.classList.remove('hidden');
      if ($('#menu-err')) $('#menu-err').textContent = '';
      const stName = $('#st-name');
      if (stName) stName.textContent = state.player.name;

      renderAll();
      break;

    case 'players':
      for (const o of m.list) {
        if (o.id === state.player.id) continue;
        const e = state.others.get(o.id);
        if (e) {
          Object.assign(e, { tx: o.x, ty: o.y, item: o.item, col: o.col, level: o.level });
        } else {
          state.others.set(o.id, { ...o, tx: o.x, ty: o.y });
        }
      }
      if (!$('#players')?.classList.contains('hidden')) renderPlayers();
      break;

    case 'join':
      state.others.set(m.id, { ...m, tx: m.x, ty: m.y });
      renderPlayers();
      break;

    case 'leave':
      state.others.delete(m.id);
      renderPlayers();
      break;

    case 'tile':
      state.world.set(m.x, m.y, m.t);
      state.world.setAmount(m.x, m.y, m.amount);
      invalidateChunkAt(m.x, m.y);
      break;

    case 'inv':
      state.player.inv.slots = m.slots;
      state.player.equip = m.equip;
      renderHotbar();
      renderInventory();
      renderTradeInv();
      break;

    case 'me':
      Object.assign(state.player, {
        coins: m.coins,
        xp: m.xp,
        energy: m.energy,
        stats: m.stats,
        col: m.col,
        achievements: m.achievements
      });
      renderStatus();
      if (!$('#profile')?.classList.contains('hidden')) renderProfile();
      if ($('#inv-coins')) $('#inv-coins').textContent = state.player.coins;
      if ($('#tr-mymax')) $('#tr-mymax').textContent = 'de ' + state.player.coins;
      break;

    case 'pos':
      state.player.x = m.x;
      state.player.y = m.y;
      break;

    case 'time':
      state.time = { day: m.day, min: m.min };
      renderStatus();
      break;

    case 'chat':
      pushChat(m);
      break;

    case 'sys':
      if (m.exceptId === state.player.id) break;
      pushChat({ ch: 'sys', text: m.text, day: m.day });
      break;

    case 'trade_req':
      pushChat({
        ch: 'sys',
        text: `${m.from} quer negociar com você.`,
        day: state.time.day,
        action: { id: m.fromId }
      });
      break;

    case 'trade':
      state.trade = m;
      openTrade();
      break;

    case 'trade_end':
      state.trade = null;
      $('#trade')?.classList.add('hidden');
      toast(m.reason === 'ok'
        ? 'Troca concluída.'
        : m.reason === 'far'
          ? 'Troca cancelada: alguém se afastou.'
          : m.reason === 'left'
            ? 'Troca cancelada: o outro jogador saiu.'
            : `Troca cancelada${m.by ? ' por ' + m.by : ''}.`
      );
      break;
  }
}
