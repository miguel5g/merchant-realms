/* ============================================================
   World.js — Gestão do mapa, geração procedural e interações
   ============================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    const constants = require('./constants');
    const { PerlinNoise, makeNoise } = require('./PerlinNoise');
    module.exports = factory({ ...constants, PerlinNoise, makeNoise });
  } else {
    root.Game = root.Game || {};
    Object.assign(root.Game, factory(root.Game));
  }
})(typeof self !== 'undefined' ? self : this, function (deps) {
  const { TILE, REACH, TOOL_SPEED, T, RES, makeNoise, PerlinNoise } = deps;

  class World {
    constructor(seed = 1337) {
      this.seed = seed;
      if (typeof makeNoise === 'function') {
        this.noise = makeNoise(seed);
      } else if (PerlinNoise) {
        const p = new PerlinNoise(seed);
        this.noise = (x, y) => p.sample(x, y);
      } else {
        this.noise = () => 0.5;
      }
      this.overrides = new Map();
      this.amounts = new Map();
    }

    key(x, y) {
      return `${x},${y}`;
    }

    baseTile(x, y) {
      const e = this.noise(x * 0.045, y * 0.045);
      const r = this.noise(x * 0.16 + 500, y * 0.16 + 500);
      if (e < 0.34) return T.WATER;
      if (e < 0.38) return T.SAND;
      if (e > 0.66) {
        if (r > 0.62) return T.IRON;
        if (r < 0.36) return T.COPPER;
        return T.STONE;
      }
      if (r > 0.64) return T.TREE;
      if (r < 0.31) return T.ROCK;
      return T.GRASS;
    }

    tile(x, y) {
      const k = this.key(x, y);
      return this.overrides.has(k) ? this.overrides.get(k) : this.baseTile(x, y);
    }

    groundUnder(x, y) {
      const b = this.baseTile(x, y);
      return b < 10 ? b : (b === T.TREE || b === T.ROCK) ? T.GRASS : T.STONE;
    }

    set(x, y, t) {
      const k = this.key(x, y);
      this.overrides.set(k, t);
      this.amounts.delete(k);
    }

    amount(x, y) {
      const k = this.key(x, y);
      if (!this.amounts.has(k)) {
        const t = this.tile(x, y);
        this.amounts.set(k, RES[t] ? RES[t].amount : 0);
      }
      return this.amounts.get(k);
    }

    setAmount(x, y, n) {
      this.amounts.set(this.key(x, y), n);
    }

    mine(x, y) {
      const t = this.tile(x, y);
      if (!RES[t]) return null;
      const left = this.amount(x, y) - 1;
      this.amounts.set(this.key(x, y), left);
      if (left <= 0) this.set(x, y, this.groundUnder(x, y));
      return RES[t].item;
    }

    walkable(x, y) {
      const t = this.tile(x, y);
      return t !== T.WATER && t < 10;
    }

    placeable(x, y) {
      return this.walkable(x, y);
    }

    clearAround(x, y) {
      for (let ox = -1; ox <= 1; ox++) {
        for (let oy = -1; oy <= 1; oy++) {
          if (!this.walkable(x + ox, y + oy)) return false;
        }
      }
      return true;
    }

    findSpawn() {
      for (let d = 0; d < 300; d++) {
        for (let dx = -d; dx <= d; dx++) {
          for (let dy = -d; dy <= d; dy++) {
            if (this.clearAround(dx, dy)) {
              return [dx * TILE + TILE / 2, dy * TILE + TILE / 2];
            }
          }
        }
      }
      return [TILE / 2, TILE / 2];
    }

    snapshot() {
      return {
        overrides: [...this.overrides].map(([k, t]) => [...k.split(',').map(Number), t]),
        amounts: [...this.amounts]
          .filter(([k, n]) => {
            const [x, y] = k.split(',').map(Number);
            const t = this.tile(x, y);
            return RES[t] && n !== RES[t].amount;
          })
          .map(([k, n]) => [...k.split(',').map(Number), n]),
      };
    }

    load(snap) {
      if (!snap) return;
      for (const [x, y, t] of snap.overrides || []) this.overrides.set(this.key(x, y), t);
      for (const [x, y, n] of snap.amounts || []) this.amounts.set(this.key(x, y), n);
    }

    static dist(ax, ay, bx, by) {
      return Math.hypot(ax - bx, ay - by);
    }

    static inReach(px, py, tx, ty) {
      return World.dist(px, py, tx * TILE + TILE / 2, ty * TILE + TILE / 2) <= REACH;
    }

    static mineTime(res, equip) {
      const tool = res?.tool && equip?.[res.tool];
      return tool ? Math.round(res.time * TOOL_SPEED) : (res?.time || 0);
    }
  }

  // Atalhos para compatibilidade direta
  const dist = (ax, ay, bx, by) => World.dist(ax, ay, bx, by);
  const inReach = (px, py, tx, ty) => World.inReach(px, py, tx, ty);
  const mineTime = (res, equip) => World.mineTime(res, equip);

  return {
    World,
    dist,
    inReach,
    mineTime,
  };
});
