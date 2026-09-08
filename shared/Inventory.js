/* ============================================================
   Inventory.js — Gerenciador de inventário e pilhas de itens
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
  const { ITEMS, stackOf } = deps;

  class Inventory {
    constructor(size = 32) {
      this.slots = Array(size).fill(null);
    }

    count(item) {
      return this.slots.reduce((a, s) => a + (s && s.item === item ? s.n : 0), 0);
    }

    used() {
      return this.slots.filter(Boolean).length;
    }

    hasSpace(item, n = 1) {
      return this.clone().add(item, n) === 0;
    }

    clone() {
      const c = new Inventory(this.slots.length);
      c.slots = this.slots.map(s => s ? { ...s } : null);
      return c;
    }

    add(item, n = 1, extra = {}) {
      const max = stackOf ? stackOf(item) : (ITEMS[item]?.tool ? 1 : 50);
      if (max > 1) {
        for (const s of this.slots) {
          if (n > 0 && s && s.item === item && s.n < max) {
            const k = Math.min(n, max - s.n);
            s.n += k;
            n -= k;
          }
        }
      }

      for (let i = 0; i < this.slots.length && n > 0; i++) {
        if (!this.slots[i]) {
          const k = Math.min(n, max);
          const durObj = (max === 1 && ITEMS[item]?.dur !== undefined) ? { dur: ITEMS[item].dur, ...extra } : extra;
          this.slots[i] = { item, n: k, ...durObj };
          n -= k;
        }
      }
      return n;
    }

    remove(item, n = 1) {
      if (this.count(item) < n) return false;
      for (let i = this.slots.length - 1; i >= 0 && n > 0; i--) {
        const s = this.slots[i];
        if (s && s.item === item) {
          const k = Math.min(n, s.n);
          s.n -= k;
          n -= k;
          if (s.n === 0) this.slots[i] = null;
        }
      }
      return true;
    }

    // Tira n unidades do slot i e devolve a pilha retirada
    take(i, n) {
      const s = this.slots[i];
      if (!s) return null;
      n = Math.min(n, s.n);
      const out = { ...s, n };
      s.n -= n;
      if (!s.n) this.slots[i] = null;
      return out;
    }

    put(stack) {
      return this.add(stack.item, stack.n, stack.dur !== undefined ? { dur: stack.dur } : {});
    }

    move(a, b) {
      if (a === b) return;
      this.transfer(this, a, b);
    }

    // Move a pilha do slot `a` para o slot `b` de outro inventário (ou deste
    // mesmo). Empilha quando o destino tem o mesmo item e ainda cabe; senão
    // troca as duas pilhas de lugar. Devolve false se nada foi feito.
    transfer(other, a, b) {
      if (!this.slots[a] || b < 0 || b >= other.slots.length) return false;
      const A = this.slots[a];
      const B = other.slots[b];
      const max = stackOf ? stackOf(A.item) : (ITEMS[A.item]?.tool ? 1 : 50);

      if (B && B.item === A.item && max > 1 && B.n < max) {
        const k = Math.min(A.n, max - B.n);
        B.n += k;
        A.n -= k;
        if (!A.n) this.slots[a] = null;
      } else {
        this.slots[a] = B || null;
        other.slots[b] = A;
      }
      return true;
    }

    // Empurra a pilha inteira do slot `a` para o outro inventário, empilhando
    // no que já existe lá. Devolve false se não coube nem uma unidade.
    push(other, a) {
      const A = this.slots[a];
      if (!A) return false;
      const rest = other.put(A);
      if (rest === A.n) return false;
      A.n = rest;
      if (!A.n) this.slots[a] = null;
      return true;
    }

    split(a) {
      const A = this.slots[a];
      if (!A || A.n < 2) return;
      const b = this.slots.indexOf(null);
      if (b < 0) return;
      const k = Math.floor(A.n / 2);
      A.n -= k;
      this.slots[b] = { item: A.item, n: k };
    }
  }

  return {
    Inventory,
  };
});
