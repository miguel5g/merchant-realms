/* ============================================================
   game.js — regras do jogo compartilhadas entre servidor e cliente.
   Agregador de módulos e compatibilidade para Node.js e browser.
   ============================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = require('./index.js');
  } else {
    root.Game = root.Game || {};
  }
})(typeof self !== 'undefined' ? self : this);
