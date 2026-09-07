/* ============================================================
   state.js — Estado centralizado do cliente (Terras Abertas).
   Exporta o objeto reativo state compartilhado entre módulos.
   ============================================================ */

export const state = {
  world: null,
  ws: null,
  connected: false,
  inGame: false,
  player: {
    id: 0,
    name: '',
    col: '#888888',
    x: 0,
    y: 0,
    r: 10,
    speed: 3.4,
    inv: null,
    equip: { pick: null, axe: null },
    sel: 0,
    coins: 0,
    xp: 0,
    energy: 100,
    stats: {},
    achievements: []
  },
  others: new Map(),
  chunkCache: new Map(),
  mining: { x: null, y: null, t0: 0 },
  lastSent: { x: NaN, y: NaN },
  time: { day: 1, min: 360 },
  serverInfo: { name: '', max: 0, seed: 1337 },
  heldFrom: null,
  craftCat: 'basico',
  craftSel: 0,
  chatTab: 'all',
  lastWhisper: null,
  chat: [],
  trade: null,
  camera: { x: 0, y: 0 },
  servers: { list: [], sel: 0 },
  cnv: null
};

// Inicialização com as classes do Game se já carregadas
if (typeof Game !== 'undefined') {
  if (Game.PALETTE) state.player.col = Game.PALETTE[0];
  if (Game.Inventory) state.player.inv = new Game.Inventory(32);
}
