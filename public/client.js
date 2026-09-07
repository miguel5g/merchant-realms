/* ============================================================
   client.js — Ponto de entrada modular do frontend (Merchant Realms).
   Orquestra os subsistemas de renderização (p5), rede (ws),
   entradas (mouse/teclado) e interfaces de usuário (DOM).
   ============================================================ */

import { state } from './js/state.js?v=0.5.0';
import { setup, draw, windowResized } from './js/renderer.js?v=0.5.0';
import { handleMousePressed, handleMouseWheel } from './js/input.js?v=0.5.0';
import { initTooltipListeners } from './js/ui/hud.js?v=0.5.0';
import { initWindowListeners } from './js/ui/windows.js?v=0.5.0';
import { initTradeListeners } from './js/ui/trade.js?v=0.5.0';
import { initChatListeners } from './js/ui/chat.js?v=0.5.0';
import { initChangelogListeners } from './js/ui/changelog.js?v=0.5.0';
import { loadServers, initMenuListeners } from './js/ui/menu.js?v=0.5.0';

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
