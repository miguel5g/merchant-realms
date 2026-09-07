/* ============================================================
   GameTime.js — Controle de ciclo dia/noite, tempo e iluminação
   ============================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    const constants = require('./constants');
    module.exports = factory(constants);
  } else {
    root.Game = root.Game || {};
    Object.assign(root.Game, factory(root.Game));
  }
})(typeof self !== 'undefined' ? self : this, function (deps) {
  const { DAY_MS } = deps;

  class GameTime {
    constructor(epoch = Date.now()) {
      this.epoch = epoch;
    }

    now(currentTime = Date.now()) {
      return GameTime.calculate(currentTime, this.epoch);
    }

    static calculate(now, epoch) {
      const dayLength = DAY_MS || (10 * 60 * 1000);
      const el = Math.max(0, now - epoch);
      const day = Math.floor(el / dayLength) + 1;
      const t = (el % dayLength) / dayLength;
      const min = Math.floor((t * 1440 + 360) % 1440);
      return {
        day,
        t,
        min,
        hour: Math.floor(min / 60),
        minute: min % 60,
      };
    }

    // Escuridão de 0 a 1 a partir do minuto do dia (0..1440)
    static nightAlpha(min) {
      const h = min / 60;
      if (h >= 7 && h < 18) return 0;
      if (h >= 18 && h < 21) return (h - 18) / 3;
      if (h >= 5 && h < 7) return 1 - (h - 5) / 2;
      return 1;
    }

    static fmtClock(min) {
      const h = String(Math.floor(min / 60)).padStart(2, '0');
      const m = String(min % 60).padStart(2, '0');
      return `${h}:${m}`;
    }
  }

  // Atalhos para compatibilidade direta
  const gameTime = (now, epoch) => GameTime.calculate(now, epoch);
  const nightAlpha = min => GameTime.nightAlpha(min);
  const fmtClock = min => GameTime.fmtClock(min);

  return {
    GameTime,
    gameTime,
    nightAlpha,
    fmtClock,
  };
});
