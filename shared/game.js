/* ============================================================
   game.js — regras do jogo compartilhadas entre servidor e cliente.
   Não importa nada do p5 nem do Node. Roda nos dois lados.
   ============================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Game = factory();
})(typeof self !== 'undefined' ? self : this, function () {

  const TILE = 32, CHUNK = 16, CS = TILE * CHUNK, STACK = 50, REACH = 3 * TILE;
  const TRADE_DIST = 5 * TILE;          // distância máxima para negociar
  const LOCAL_CHAT_DIST = 20 * TILE;    // alcance do canal Local
  const DAY_MS = 10 * 60 * 1000;        // 1 dia de jogo = 10 minutos reais
  const DAILY_COINS = 10;
  const TOOL_SPEED = 0.6;               // ferramenta certa: 60% do tempo
  const T = { WATER:0, SAND:1, GRASS:2, STONE:3, TREE:10, ROCK:11, IRON:12, COPPER:13, WALL:20, CHEST:21, BENCH:22 };

  const PALETTE = ['#f2c76b', '#8cbe78', '#e0925c', '#b48ce0', '#5a8fd0', '#d26e64'];

  const ITEMS = {
    madeira:            { label:'Madeira',            desc:'Vem de árvores. Serve para placas, ferramentas e baús.', col:'#8b5e34', value:1 },
    pedra:              { label:'Pedra',              desc:'Vem de rochas. Serve para muros e ferramentas.',         col:'#8c8c86', value:1 },
    ferro:              { label:'Minério de ferro',   desc:'Bruto. Vira placa de ferro na fabricação.',              col:'#a0785a', value:2 },
    cobre:              { label:'Minério de cobre',   desc:'Bruto. Vira placa de cobre na fabricação.',              col:'#c77a4a', value:2 },
    'placa de ferro':   { label:'Placa de ferro',     desc:'Componente básico de máquinas.',                         col:'#c4c6ce', value:5 },
    'placa de cobre':   { label:'Placa de cobre',     desc:'Componente de fiação e circuitos.',                      col:'#e0925c', value:5 },
    engrenagem:         { label:'Engrenagem',         desc:'Peça mecânica feita de placas de ferro.',                col:'#acb0ba', value:12 },
    muro:               { label:'Muro de pedra',      desc:'Bloqueia passagem. Botão direito para colocar.',         col:'#c9b79c', value:3, place:T.WALL },
    baú:                { label:'Baú',                desc:'Decorativo por enquanto. Botão direito para colocar.',   col:'#966432', value:8, place:T.CHEST },
    bancada:            { label:'Bancada de trabalho', desc:'Decorativa por enquanto. Botão direito para colocar.', col:'#7a5230', value:14, place:T.BENCH },
    'picareta de pedra':{ label:'Picareta de pedra',  desc:'Minera rochas e minérios mais rápido. Gasta com o uso.', col:'#b0b0aa', value:6, tool:'pick', dur:120 },
    'machado de pedra': { label:'Machado de pedra',   desc:'Corta árvores mais rápido. Gasta com o uso.',            col:'#a67a4a', value:5, tool:'axe',  dur:120 },
  };
  const stackOf = item => ITEMS[item]?.tool ? 1 : STACK;

  // time = milissegundos por unidade extraída; tool = ferramenta que acelera
  const RES = {
    [T.TREE]:   { name:'Árvore',              item:'madeira', amount:5,  time:300, tool:'axe',  skill:'wood' },
    [T.ROCK]:   { name:'Rocha',               item:'pedra',   amount:8,  time:370, tool:'pick', skill:'stone' },
    [T.IRON]:   { name:'Minério de ferro',    item:'ferro',   amount:12, time:530, tool:'pick', skill:'ore' },
    [T.COPPER]: { name:'Minério de cobre',    item:'cobre',   amount:12, time:530, tool:'pick', skill:'ore' },
    [T.WALL]:   { name:'Muro de pedra',       item:'muro',    amount:1,  time:130, built:true },
    [T.CHEST]:  { name:'Baú',                 item:'baú',     amount:1,  time:130, built:true },
    [T.BENCH]:  { name:'Bancada de trabalho', item:'bancada', amount:1,  time:130, built:true },
  };

  const RECIPE_CATS = [['basico', 'Básico'], ['metais', 'Metais'], ['construcao', 'Construção']];
  const RECIPES = [
    { out:'picareta de pedra', n:1, cat:'basico',     needs:{ madeira:2, pedra:3 } },
    { out:'machado de pedra',  n:1, cat:'basico',     needs:{ madeira:2, pedra:2 } },
    { out:'placa de ferro',    n:1, cat:'metais',     needs:{ ferro:2, madeira:1 } },
    { out:'placa de cobre',    n:1, cat:'metais',     needs:{ cobre:2, madeira:1 } },
    { out:'engrenagem',        n:1, cat:'metais',     needs:{ 'placa de ferro':2 } },
    { out:'muro',              n:1, cat:'construcao', needs:{ pedra:2 } },
    { out:'baú',               n:1, cat:'construcao', needs:{ madeira:6 } },
    { out:'bancada',           n:1, cat:'construcao', needs:{ madeira:8, pedra:4 } },
  ];

  /* ---------- progressão ---------- */
  const XP = { mine:2, craft:3, build:1, trade:10 };
  const levelFromXp = xp => Math.floor(Math.sqrt(xp / 50)) + 1;
  const xpForLevel = l => 50 * (l - 1) * (l - 1);
  const titleFor = l => l >= 9 ? 'Mestre das Terras' : l >= 7 ? 'Veterano' : l >= 5 ? 'Artesão' : l >= 3 ? 'Colono' : 'Recém-chegado';

  const SKILLS = [
    { key:'ore',    label:'Mineração', per:25, col:'#a0785a' },
    { key:'wood',   label:'Lenhador',  per:25, col:'#8b5e34' },
    { key:'built',  label:'Construção', per:15, col:'#c9b79c' },
    { key:'trades', label:'Comércio',  per:3,  col:'#f2c76b' },
    { key:'chunks', label:'Exploração', per:8, col:'#6f9a4a' },
  ];
  const skillLevel = (stats, s) => Math.min(20, Math.floor(statNum(stats, s.key) / s.per) + 1);
  const skillProgress = (stats, s) => (statNum(stats, s.key) % s.per) / s.per;
  const statNum = (stats, k) => k === 'chunks' ? (stats.chunks || []).length : (stats[k] || 0);

  const ACHIEVEMENTS = [
    { id:'passos',     label:'Primeiros passos',  desc:'Explore 3 chunks.',            col:'#6f9a4a', test:s => statNum(s,'chunks') >= 3 },
    { id:'lenhador',   label:'Lenhador',          desc:'Colete 25 madeira.',           col:'#8b5e34', test:s => (s.wood||0) >= 25 },
    { id:'pedreiro',   label:'Pedreiro',          desc:'Colete 50 pedra.',             col:'#8c8c86', test:s => (s.stone||0) >= 50 },
    { id:'minerador',  label:'Minerador',         desc:'Colete 50 minérios.',          col:'#a0785a', test:s => (s.ore||0) >= 50 },
    { id:'construtor', label:'Construtor',        desc:'Coloque 25 blocos.',           col:'#c9b79c', test:s => (s.built||0) >= 25 },
    { id:'artesao',    label:'Artesão',           desc:'Fabrique 20 itens.',           col:'#c4c6ce', test:s => (s.crafted||0) >= 20 },
    { id:'mercador',   label:'Mercador',          desc:'Conclua uma troca.',           col:'#f2c76b', test:s => (s.trades||0) >= 1 },
    { id:'negociante', label:'Negociante',        desc:'Conclua 10 trocas.',           col:'#e0925c', test:s => (s.trades||0) >= 10 },
    { id:'explorador', label:'Explorador',        desc:'Explore 30 chunks.',           col:'#5a8fd0', test:s => statNum(s,'chunks') >= 30 },
    { id:'veterano',   label:'Veterano',          desc:'Jogue por 1 hora.',            col:'#b48ce0', test:s => (s.playMs||0) >= 3600e3 },
    { id:'sobrevivente', label:'Sobrevivente',    desc:'Chegue ao dia 5.',             col:'#d26e64', test:s => (s.maxDay||0) >= 5 },
    { id:'rico',       label:'Cofre cheio',       desc:'Acumule 200 coroas.',          col:'#ffe1a0', test:s => (s.maxCoins||0) >= 200 },
  ];

  /* ---------- tempo ---------- */
  // t em [0,1) dentro do dia; o dia começa às 06:00
  function gameTime(now, epoch) {
    const el = Math.max(0, now - epoch), day = Math.floor(el / DAY_MS) + 1, t = (el % DAY_MS) / DAY_MS;
    const min = Math.floor((t * 1440 + 360) % 1440);
    return { day, t, min, hour: Math.floor(min / 60), minute: min % 60 };
  }
  // escuridão 0..1 a partir da hora (0..24)
  function nightAlpha(min) {
    const h = min / 60;
    if (h >= 7 && h < 18) return 0;
    if (h >= 18 && h < 21) return (h - 18) / 3;
    if (h >= 5 && h < 7) return 1 - (h - 5) / 2;
    return 1;
  }
  const fmtClock = min => String(Math.floor(min / 60)).padStart(2, '0') + ':' + String(min % 60).padStart(2, '0');

  /* ---------- ruído Perlin determinístico ---------- */
  function makeNoise(seed) {
    let s = seed >>> 0;
    const rnd = () => { s += 0x6D2B79F5; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const perm = [...Array(256).keys()];
    for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
    const p = new Uint8Array(512); for (let i = 0; i < 512; i++) p[i] = perm[i & 255];
    const fade = t => t * t * t * (t * (t * 6 - 15) + 10), lerp = (a, b, t) => a + t * (b - a);
    const grad = (h, x, y) => { switch (h & 3) { case 0: return x + y; case 1: return -x + y; case 2: return x - y; default: return -x - y; } };
    function raw(x, y) {
      const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
      x -= Math.floor(x); y -= Math.floor(y);
      const u = fade(x), v = fade(y), a = p[X] + Y, b = p[X + 1] + Y;
      return lerp(lerp(grad(p[a], x, y), grad(p[b], x - 1, y), u), lerp(grad(p[a + 1], x, y - 1), grad(p[b + 1], x - 1, y - 1), u), v);
    }
    return (x, y) => {
      let n = 0, amp = 1, f = 1, norm = 0;
      for (let o = 0; o < 3; o++) { n += raw(x * f, y * f) * amp; norm += amp; amp *= 0.5; f *= 2; }
      return Math.min(1, Math.max(0, 0.5 + (n / norm) * 0.85));
    };
  }

  /* ---------- inventário ---------- */
  class Inventory {
    constructor(size) { this.slots = Array(size).fill(null); }
    count(item) { return this.slots.reduce((a, s) => a + (s && s.item === item ? s.n : 0), 0); }
    used() { return this.slots.filter(Boolean).length; }
    hasSpace(item, n = 1) { return this.clone().add(item, n) === 0; }
    clone() { const c = new Inventory(this.slots.length); c.slots = this.slots.map(s => s ? { ...s } : null); return c; }
    add(item, n = 1, extra = {}) {
      const max = stackOf(item);
      if (max > 1) for (const s of this.slots) if (n > 0 && s && s.item === item && s.n < max) { const k = Math.min(n, max - s.n); s.n += k; n -= k; }
      for (let i = 0; i < this.slots.length && n > 0; i++) if (!this.slots[i]) { const k = Math.min(n, max); this.slots[i] = { item, n:k, ...(max === 1 ? { dur: ITEMS[item].dur, ...extra } : {}) }; n -= k; }
      return n;
    }
    remove(item, n = 1) {
      if (this.count(item) < n) return false;
      for (let i = this.slots.length - 1; i >= 0 && n > 0; i--) {
        const s = this.slots[i];
        if (s && s.item === item) { const k = Math.min(n, s.n); s.n -= k; n -= k; if (s.n === 0) this.slots[i] = null; }
      }
      return true;
    }
    // tira n unidades do slot i e devolve a pilha retirada
    take(i, n) {
      const s = this.slots[i]; if (!s) return null;
      n = Math.min(n, s.n);
      const out = { ...s, n };
      s.n -= n; if (!s.n) this.slots[i] = null;
      return out;
    }
    put(stack) { return this.add(stack.item, stack.n, stack.dur !== undefined ? { dur: stack.dur } : {}); }
    move(a, b) {
      if (a === b || !this.slots[a] || b < 0 || b >= this.slots.length) return;
      const A = this.slots[a], B = this.slots[b], max = stackOf(A.item);
      if (B && B.item === A.item && max > 1 && B.n < max) { const k = Math.min(A.n, max - B.n); B.n += k; A.n -= k; if (!A.n) this.slots[a] = null; }
      else { this.slots[a] = B; this.slots[b] = A; }
    }
    split(a) {
      const A = this.slots[a]; if (!A || A.n < 2) return;
      const b = this.slots.indexOf(null); if (b < 0) return;
      const k = Math.floor(A.n / 2); A.n -= k; this.slots[b] = { item:A.item, n:k };
    }
  }
  function canCraft(inv, r) { return Object.entries(r.needs).every(([it, n]) => inv.count(it) >= n); }
  function craftableCount(inv, r) { return Math.min(...Object.entries(r.needs).map(([it, n]) => Math.floor(inv.count(it) / n))); }
  function craft(inv, r) {
    if (!canCraft(inv, r) || !inv.hasSpace(r.out, r.n)) return false;
    for (const [it, n] of Object.entries(r.needs)) inv.remove(it, n);
    inv.add(r.out, r.n);
    return true;
  }
  const offerValue = (items, coins) => items.reduce((a, s) => a + (ITEMS[s.item]?.value || 0) * s.n, 0) + (coins || 0);

  /* ---------- mundo ---------- */
  class World {
    constructor(seed) { this.seed = seed; this.noise = makeNoise(seed); this.overrides = new Map(); this.amounts = new Map(); }
    key(x, y) { return x + ',' + y; }
    baseTile(x, y) {
      const e = this.noise(x * 0.045, y * 0.045);
      const r = this.noise(x * 0.16 + 500, y * 0.16 + 500);
      if (e < 0.34) return T.WATER;
      if (e < 0.38) return T.SAND;
      if (e > 0.66) { if (r > 0.62) return T.IRON; if (r < 0.36) return T.COPPER; return T.STONE; }
      if (r > 0.64) return T.TREE;
      if (r < 0.31) return T.ROCK;
      return T.GRASS;
    }
    tile(x, y) { const k = this.key(x, y); return this.overrides.has(k) ? this.overrides.get(k) : this.baseTile(x, y); }
    groundUnder(x, y) { const b = this.baseTile(x, y); return b < 10 ? b : (b === T.TREE || b === T.ROCK) ? T.GRASS : T.STONE; }
    set(x, y, t) { this.overrides.set(this.key(x, y), t); this.amounts.delete(this.key(x, y)); }
    amount(x, y) {
      const k = this.key(x, y);
      if (!this.amounts.has(k)) { const t = this.tile(x, y); this.amounts.set(k, RES[t] ? RES[t].amount : 0); }
      return this.amounts.get(k);
    }
    setAmount(x, y, n) { this.amounts.set(this.key(x, y), n); }
    mine(x, y) {
      const t = this.tile(x, y);
      if (!RES[t]) return null;
      const left = this.amount(x, y) - 1;
      this.amounts.set(this.key(x, y), left);
      if (left <= 0) this.set(x, y, this.groundUnder(x, y));
      return RES[t].item;
    }
    walkable(x, y) { const t = this.tile(x, y); return t !== T.WATER && t < 10; }
    placeable(x, y) { return this.walkable(x, y); }
    findSpawn() {
      for (let d = 0; d < 300; d++)
        for (let dx = -d; dx <= d; dx++) for (let dy = -d; dy <= d; dy++)
          if (clearAround(this, dx, dy)) return [dx * TILE + TILE / 2, dy * TILE + TILE / 2];
      return [TILE / 2, TILE / 2];
    }
    snapshot() {
      return {
        overrides: [...this.overrides].map(([k, t]) => [...k.split(',').map(Number), t]),
        amounts: [...this.amounts]
          .filter(([k, n]) => { const [x, y] = k.split(',').map(Number); const t = this.tile(x, y); return RES[t] && n !== RES[t].amount; })
          .map(([k, n]) => [...k.split(',').map(Number), n]),
      };
    }
    load(snap) {
      if (!snap) return;
      for (const [x, y, t] of snap.overrides || []) this.overrides.set(this.key(x, y), t);
      for (const [x, y, n] of snap.amounts || []) this.amounts.set(this.key(x, y), n);
    }
  }
  function clearAround(w, x, y) { for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) if (!w.walkable(x + ox, y + oy)) return false; return true; }
  const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
  const inReach = (px, py, tx, ty) => dist(px, py, tx * TILE + TILE / 2, ty * TILE + TILE / 2) <= REACH;
  // tempo real de extração para um jogador com determinado equipamento
  function mineTime(res, equip) { const tool = res.tool && equip?.[res.tool]; return tool ? Math.round(res.time * TOOL_SPEED) : res.time; }

  return { TILE, CHUNK, CS, STACK, REACH, TRADE_DIST, LOCAL_CHAT_DIST, DAY_MS, DAILY_COINS, TOOL_SPEED, T, PALETTE,
           ITEMS, RES, RECIPES, RECIPE_CATS, XP, SKILLS, ACHIEVEMENTS, stackOf,
           levelFromXp, xpForLevel, titleFor, skillLevel, skillProgress, statNum, gameTime, nightAlpha, fmtClock,
           Inventory, World, canCraft, craftableCount, craft, offerValue, dist, inReach, mineTime, makeNoise };
});
