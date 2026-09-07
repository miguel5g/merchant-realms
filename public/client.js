/* ============================================================
   client.js — Ponto de entrada modular do frontend (Merchant Realms).
   Orquestra os subsistemas de renderização (p5), rede (ws),
   entradas (mouse/teclado) e interfaces de usuário (DOM).
   ============================================================ */

import { state } from './js/state.js';
import { setup, draw, windowResized } from './js/renderer.js';
import { handleMousePressed, handleMouseWheel } from './js/input.js';
import { initTooltipListeners } from './js/ui/hud.js';
import { initWindowListeners } from './js/ui/windows.js';
import { initTradeListeners } from './js/ui/trade.js';
import { initChatListeners } from './js/ui/chat.js';
import { initChangelogListeners } from './js/ui/changelog.js';
import { loadServers, initMenuListeners } from './js/ui/menu.js';

/* ---------- Binds do ciclo de vida global do p5.js ---------- */
window.setup = setup;
window.draw = draw;
window.windowResized = windowResized;
window.mousePressed = handleMousePressed;
window.mouseWheel = handleMouseWheel;

/* ---------- Inicialização dos módulos de interface ---------- */
initTooltipListeners();
initWindowListeners();
initTradeListeners();
initChatListeners();
initChangelogListeners();
initMenuListeners();

// Inicia a descoberta e listagem de servidores
loadServers();

// Expõe estado para inspeção no console de desenvolvimento
if (typeof window !== 'undefined') {
  window.__CLIENT__ = { state };
}
