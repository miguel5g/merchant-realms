/* ============================================================
   constants.js — Definições, configurações e constantes do jogo
   ============================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.Game = root.Game || {};
    Object.assign(root.Game, factory());
  }
})(typeof self !== 'undefined' ? self : this, function () {

  const TILE = 32;
  const CHUNK = 16;
  const CS = TILE * CHUNK;
  const STACK = 50;
  const REACH = 3 * TILE;
  const TRADE_DIST = 5 * TILE;          // distância máxima para negociar
  const LOCAL_CHAT_DIST = 20 * TILE;    // alcance do canal Local
  const DAY_MS = 10 * 60 * 1000;        // 1 dia de jogo = 10 minutos reais
  const DAILY_COINS = 10;
  const TOOL_SPEED = 0.6;               // ferramenta certa: 60% do tempo

  const T = {
    WATER: 0,
    SAND: 1,
    GRASS: 2,
    STONE: 3,
    TREE: 10,
    ROCK: 11,
    IRON: 12,
    COPPER: 13,
    WALL: 20,
    CHEST: 21,
    MADEIREIRA: 23,
  };

  const PALETTE = ['#f2c76b', '#8cbe78', '#e0925c', '#b48ce0', '#5a8fd0', '#d26e64'];

  const ITEMS = {
    madeira:            { label:'Madeira',             desc:'Vem de árvores. Serve para placas, ferramentas e baús.', col:'#8b5e34', value:1 },
    pedra:              { label:'Pedra',               desc:'Vem de rochas. Serve para muros e ferramentas.',         col:'#8c8c86', value:1 },
    ferro:              { label:'Minério de ferro',    desc:'Bruto. Vira placa de ferro na fabricação.',              col:'#a0785a', value:2 },
    cobre:              { label:'Minério de cobre',    desc:'Bruto. Vira placa de cobre na fabricação.',              col:'#c77a4a', value:2 },
    'placa de ferro':   { label:'Placa de ferro',      desc:'Componente básico de máquinas.',                         col:'#c4c6ce', value:5 },
    'placa de cobre':   { label:'Placa de cobre',      desc:'Componente de fiação e circuitos.',                      col:'#e0925c', value:5 },
    engrenagem:         { label:'Engrenagem',          desc:'Peça mecânica feita de placas de ferro.',                col:'#acb0ba', value:12 },
    muro:               { label:'Muro de pedra',       desc:'Bloqueia passagem. Botão esquerdo para colocar.',        col:'#c9b79c', value:3, place:T.WALL },
    baú:                { label:'Baú',                 desc:'Decorativo por enquanto. Botão esquerdo para colocar.',  col:'#966432', value:8, place:T.CHEST },
    'picareta de pedra':{ label:'Picareta de pedra',   desc:'Minera rochas e minérios mais rápido. Gasta com o uso.', col:'#b0b0aa', value:6, tool:'pick', dur:120 },
    'machado de pedra': { label:'Machado de pedra',    desc:'Corta árvores mais rápido. Gasta com o uso.',            col:'#a67a4a', value:5, tool:'axe',  dur:120 },
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
  };

  const RECIPE_CATS = [['basico', 'Básico'], ['metais', 'Metais'], ['construcao', 'Construção'], ['blueprints', 'Blueprints']];

  const RECIPES = [
    { out:'picareta de pedra', n:1, cat:'basico',     needs:{ madeira:2, pedra:3 } },
    { out:'machado de pedra',  n:1, cat:'basico',     needs:{ madeira:2, pedra:2 } },
    { out:'placa de ferro',    n:1, cat:'metais',     needs:{ ferro:2, madeira:1 } },
    { out:'placa de cobre',    n:1, cat:'metais',     needs:{ cobre:2, madeira:1 } },
    { out:'engrenagem',        n:1, cat:'metais',     needs:{ 'placa de ferro':2 } },
    { out:'muro',              n:1, cat:'construcao', needs:{ pedra:2 } },
    { out:'baú',               n:1, cat:'construcao', needs:{ madeira:6 } },
  ];


  /* ---------- Blueprints e estruturas geradoras ----------
     Cada entrada aqui gera automaticamente: o item de blueprint (ITEMS),
     a receita comprada com coroas (RECIPES, categoria "blueprints") e a
     estrutura colocável no mundo (RES). Para criar um novo blueprint basta
     acrescentar uma entrada abaixo com tile, item, n, interval e cap. */
  const GENERATORS = {
    madeireira: {
      tile:     T.MADEIREIRA,
      label:    'Madeireira',
      item:     'madeira',   // recurso produzido
      n:        1,           // unidades produzidas por ciclo
      interval: 15000,       // milissegundos entre ciclos
      cap:      24,          // estoque máximo acumulado na estrutura
      time:     260,         // ms por unidade ao recolher
      cost:     120,         // preço em coroas
      col:      '#6b4a2f',
      desc:     'Corta madeira sozinha. Produz 1 madeira a cada 15s e guarda até 24.',
    },
  };

  const GEN_BY_TILE = {};
  for (const [key, g] of Object.entries(GENERATORS)) {
    g.key = key;
    g.blueprint = `blueprint ${key}`;
    GEN_BY_TILE[g.tile] = g;

    ITEMS[g.blueprint] = {
      label: `Blueprint: ${g.label}`,
      desc:  `${g.desc} Uso único: o blueprint some ao ser colocado.`,
      col:   '#5a8fd0',
      value: g.cost,
      place: g.tile,
      blueprint: key,
    };
    RES[g.tile] = { name:g.label, item:g.item, amount:0, time:g.time, built:true, gen:key, cap:g.cap };
    RECIPES.push({ out:g.blueprint, n:1, cat:'blueprints', needs:{}, coins:g.cost });
  }

  // Ids de tile válidos — usado ao carregar mundos antigos (descarta tiles removidos do jogo)
  const TILE_IDS = new Set(Object.values(T));

  const XP = { mine:2, craft:3, build:1, trade:10 };

  const SKILLS = [
    { key:'ore',    label:'Mineração', per:25, col:'#a0785a' },
    { key:'wood',   label:'Lenhador',  per:25, col:'#8b5e34' },
    { key:'built',  label:'Construção', per:15, col:'#c9b79c' },
    { key:'trades', label:'Comércio',  per:3,  col:'#f2c76b' },
    { key:'chunks', label:'Exploração', per:8, col:'#6f9a4a' },
  ];

  // Helper local para contagem de stats em conquistas
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

  const PLAYER_NAME_MIN_LEN = 2;
  const PLAYER_NAME_MAX_LEN = 16;
  const PLAYER_NAME_REGEX = /^[\p{L}\p{N}_-]{2,16}$/u;

  function validatePlayerName(name) {
    if (typeof name !== 'string') {
      return { ok: false, reason: 'Nome inválido.' };
    }
    const clean = name.trim();
    if (!clean) {
      return { ok: false, reason: 'Escolha um nome antes de entrar.' };
    }
    if (/\s/.test(name)) {
      return { ok: false, reason: 'O nome não pode conter espaços.' };
    }
    if (clean.length < PLAYER_NAME_MIN_LEN) {
      return { ok: false, reason: `O nome deve ter pelo menos ${PLAYER_NAME_MIN_LEN} caracteres.` };
    }
    if (clean.length > PLAYER_NAME_MAX_LEN) {
      return { ok: false, reason: `O nome pode ter no máximo ${PLAYER_NAME_MAX_LEN} caracteres.` };
    }
    if (!PLAYER_NAME_REGEX.test(clean)) {
      return { ok: false, reason: 'Use apenas letras, números, hífen (-) ou underline (_).' };
    }
    return { ok: true, name: clean };
  }

  return {
    TILE,
    CHUNK,
    CS,
    STACK,
    REACH,
    TRADE_DIST,
    LOCAL_CHAT_DIST,
    DAY_MS,
    DAILY_COINS,
    TOOL_SPEED,
    T,
    PALETTE,
    ITEMS,
    RES,
    RECIPE_CATS,
    RECIPES,
    GENERATORS,
    GEN_BY_TILE,
    TILE_IDS,
    XP,
    SKILLS,
    ACHIEVEMENTS,
    PLAYER_NAME_MIN_LEN,
    PLAYER_NAME_MAX_LEN,
    PLAYER_NAME_REGEX,
    validatePlayerName,
    stackOf,
  };
});
