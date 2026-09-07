/* ============================================================
   PerlinNoise.js — Gerador determinístico de ruído Perlin 2D
   ============================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.Game = root.Game || {};
    Object.assign(root.Game, factory());
  }
})(typeof self !== 'undefined' ? self : this, function () {

  class PerlinNoise {
    constructor(seed = 1337) {
      this.seed = seed >>> 0;
      this.p = new Uint8Array(512);
      this._initPermutation();
    }

    _initPermutation() {
      let s = this.seed;
      const rnd = () => {
        s += 0x6D2B79F5;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };

      const perm = [...Array(256).keys()];
      for (let i = 255; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        [perm[i], perm[j]] = [perm[j], perm[i]];
      }

      for (let i = 0; i < 512; i++) {
        this.p[i] = perm[i & 255];
      }
    }

    _fade(t) {
      return t * t * t * (t * (t * 6 - 15) + 10);
    }

    _lerp(a, b, t) {
      return a + t * (b - a);
    }

    _grad(h, x, y) {
      switch (h & 3) {
        case 0: return x + y;
        case 1: return -x + y;
        case 2: return x - y;
        default: return -x - y;
      }
    }

    raw(x, y) {
      const X = Math.floor(x) & 255;
      const Y = Math.floor(y) & 255;
      const xf = x - Math.floor(x);
      const yf = y - Math.floor(y);

      const u = this._fade(xf);
      const v = this._fade(yf);
      const a = this.p[X] + Y;
      const b = this.p[X + 1] + Y;

      return this._lerp(
        this._lerp(this._grad(this.p[a], xf, yf), this._grad(this.p[b], xf - 1, yf), u),
        this._lerp(this._grad(this.p[a + 1], xf, yf - 1), this._grad(this.p[b + 1], xf - 1, yf - 1), u),
        v
      );
    }

    sample(x, y, octaves = 3) {
      let n = 0, amp = 1, f = 1, norm = 0;
      for (let o = 0; o < octaves; o++) {
        n += this.raw(x * f, y * f) * amp;
        norm += amp;
        amp *= 0.5;
        f *= 2;
      }
      return Math.min(1, Math.max(0, 0.5 + (n / norm) * 0.85));
    }
  }

  function makeNoise(seed) {
    const noise = new PerlinNoise(seed);
    return (x, y) => noise.sample(x, y);
  }

  return {
    PerlinNoise,
    makeNoise,
  };
});
