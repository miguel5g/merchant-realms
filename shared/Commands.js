/* ============================================================
   Commands.js — Registro de comandos de chat: definição, análise
   e valores válidos para autocompletar.
   Compartilhado: o cliente usa para sugerir e o servidor para
   validar e executar (a autoridade é sempre do servidor).
   ============================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./constants'));
  } else {
    root.Game = root.Game || {};
    Object.assign(root.Game, factory(root.Game));
  }
})(typeof self !== 'undefined' ? self : this, function (deps) {
  const { T, ITEMS, RES, GENERATORS } = deps;

  // Comparação tolerante: sem acento, sem caixa, sem espaços nas pontas.
  const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

  /* ---------- blocos colocáveis por comando ----------
     nome digitado -> [id do tile, rótulo]. Tiles novos em T entram
     sozinhos; estruturas geradoras usam a chave do GENERATORS. */
  const BLOCK_LABELS = {
    [T.WATER]:  ['agua',   'Água'],
    [T.SAND]:   ['areia',  'Areia'],
    [T.GRASS]:  ['grama',  'Grama'],
    [T.STONE]:  ['pedra',  'Pedra'],
    [T.TREE]:   ['arvore', 'Árvore'],
    [T.ROCK]:   ['rocha',  'Rocha'],
    [T.IRON]:   ['ferro',  'Minério de ferro'],
    [T.COPPER]: ['cobre',  'Minério de cobre'],
    [T.WALL]:   ['muro',   'Muro de pedra'],
    [T.CHEST]:  ['bau',    'Baú'],
  };
  for (const g of Object.values(GENERATORS || {})) {
    if (!BLOCK_LABELS[g.tile]) BLOCK_LABELS[g.tile] = [norm(g.key), g.label];
  }
  for (const [key, id] of Object.entries(T)) {
    if (!BLOCK_LABELS[id]) BLOCK_LABELS[id] = [norm(key), (RES[id] && RES[id].name) || key];
  }

  const BLOCKS = {};        // nome -> id do tile
  const BLOCK_LABEL = {};   // nome -> rótulo legível
  for (const [id, [name, label]] of Object.entries(BLOCK_LABELS)) {
    BLOCKS[name] = +id;
    BLOCK_LABEL[name] = label;
  }
  const BLOCK_NAMES = Object.keys(BLOCKS).sort();

  function resolveBlock(input) {
    const n = norm(input);
    if (!n) return null;
    for (const name of BLOCK_NAMES) if (name === n || norm(BLOCK_LABEL[name]) === n) return name;
    return null;
  }

  function resolveItem(input) {
    const n = norm(input);
    if (!n) return null;
    for (const key of Object.keys(ITEMS)) if (norm(key) === n || norm(ITEMS[key].label) === n) return key;
    return null;
  }

  /* ---------- definição dos comandos ----------
     scope 'chat'   → resolvido no cliente (vira uma mensagem de canal)
     scope 'server' → enviado cru ao servidor, que analisa e executa
     admin: true    → só para nomes listados em ADMINS no servidor

     args: type diz o que autocompletar ('player', 'item', 'block',
     'coord', 'int', 'text'); greedy junta o resto da linha (permite
     valores com espaço, como "placa de ferro"); tail é um opcional
     numérico no fim da linha, depois de um argumento greedy. */
  const COMMANDS = [
    {
      name: 'w', aliases: ['sussurrar'], scope: 'chat', ch: 'whisper',
      desc: 'Sussurra para um jogador.',
      args: [{ name: 'jogador', type: 'player' }, { name: 'mensagem', type: 'text', greedy: true }],
    },
    {
      name: 'r', scope: 'chat', ch: 'whisper', reply: true,
      desc: 'Responde o último sussurro recebido.',
      args: [{ name: 'mensagem', type: 'text', greedy: true }],
    },
    {
      name: 'g', scope: 'chat', ch: 'global',
      desc: 'Fala no canal global.',
      args: [{ name: 'mensagem', type: 'text', greedy: true }],
    },
    {
      name: 'l', scope: 'chat', ch: 'local',
      desc: 'Fala no canal local (20 tiles).',
      args: [{ name: 'mensagem', type: 'text', greedy: true }],
    },
    {
      name: 't', scope: 'chat', ch: 'trade',
      desc: 'Fala no canal de comércio.',
      args: [{ name: 'mensagem', type: 'text', greedy: true }],
    },
    {
      name: 'kick', scope: 'server', admin: true,
      desc: 'Expulsa um jogador do servidor.',
      args: [
        { name: 'jogador', type: 'player' },
        { name: 'motivo', type: 'text', greedy: true, opt: true },
      ],
    },
    {
      name: 'give', scope: 'server', admin: true,
      desc: 'Entrega um item para um jogador.',
      args: [
        { name: 'jogador', type: 'player' },
        { name: 'item', type: 'item', greedy: true },
        { name: 'quantidade', type: 'int', opt: true, tail: true },
      ],
    },
    {
      name: 'place', scope: 'server', admin: true,
      desc: 'Coloca um bloco em qualquer ponto do mundo.',
      args: [
        { name: 'x', type: 'coord' },
        { name: 'z', type: 'coord' },
        { name: 'bloco', type: 'block', greedy: true },
      ],
    },
  ];

  const COMMAND_BY_NAME = {};
  for (const c of COMMANDS) {
    COMMAND_BY_NAME[c.name] = c;
    for (const a of c.aliases || []) COMMAND_BY_NAME[a] = c;
  }

  const findCommand = name => COMMAND_BY_NAME[norm(name)] || null;

  // "/give <jogador> <item> [quantidade]"
  function usage(def) {
    return `/${def.name}${def.args.map(a => a.opt ? ` [${a.name}]` : ` <${a.name}>`).join('')}`;
  }

  // Comandos visíveis para quem pede (admin vê tudo).
  const commandsFor = admin => COMMANDS.filter(c => admin || !c.admin);

  /* ---------- análise ---------- */

  // "/give  Bob madeira" -> { name:'give', tokens:[{value,start,end}, ...] }
  function splitCommand(text) {
    const m = /^\s*\/(\S*)/.exec(text);
    if (!m) return null;
    const name = m[1];
    const head = m[0].length;
    const tokens = [];
    const re = /\S+/g;
    re.lastIndex = head;
    let t;
    while ((t = re.exec(text))) tokens.push({ value: t[0], start: t.index, end: t.index + t[0].length });
    return { name, nameStart: m[0].length - name.length, nameEnd: head, tokens, argsStart: head };
  }

  const slotOf = toks => toks.length ? {
    text: toks.map(t => t.value).join(' '),
    start: toks[0].start,
    end: toks[toks.length - 1].end,
  } : null;

  // Distribui os tokens entre os argumentos do comando.
  // Devolve um array paralelo a def.args (posição sem token = null).
  function assignArgs(def, tokens) {
    const slots = def.args.map(() => null);
    const tailIdx = def.args.findIndex(a => a.tail);
    let usable = tokens.length;

    // O opcional numérico do fim só existe se sobrar token para o greedy antes dele.
    if (tailIdx >= 0 && tokens.length > tailIdx && /^\d+$/.test(tokens[tokens.length - 1].value)) {
      slots[tailIdx] = slotOf([tokens[tokens.length - 1]]);
      usable--;
    }

    let ti = 0;
    for (let i = 0; i < def.args.length; i++) {
      const a = def.args[i];
      if (a.tail || ti >= usable) continue;
      if (a.greedy) {
        slots[i] = slotOf(tokens.slice(ti, usable));
        ti = usable;
      } else {
        slots[i] = slotOf([tokens[ti]]);
        ti++;
      }
    }
    return slots;
  }


  // Um argumento greedy só termina quando o texto já é um valor completo:
  // "placa" ainda pode virar "placa de ferro", então continua aberto.
  function isComplete(arg, text) {
    if (!text) return false;
    if (arg.type === 'item') return !!resolveItem(text);
    if (arg.type === 'block') return !!resolveBlock(text);
    return true;
  }

  /* Onde está o cursor dentro da linha? Base do autocompletar.
     Devolve { kind:'cmd', start } enquanto se digita o nome do comando,
     { kind:'arg', def, index, arg, start } dentro de um argumento
     (start = posição onde o valor começa, para substituir ao completar),
     ou null quando a linha não é um comando. */
  function argAt(text, caret) {
    if (!String(text).startsWith('/')) return null;
    const split = splitCommand(text);
    if (!split) return null;
    if (caret <= split.nameEnd) return { kind: 'cmd', start: split.nameStart };

    const def = findCommand(split.name);
    if (!def) return null;
    const slots = assignArgs(def, split.tokens);
    const at = (index, start) => ({ kind: 'arg', def, index, arg: def.args[index], start });

    for (let i = 0; i < def.args.length; i++) {
      const s = slots[i];
      if (s && caret >= s.start && caret <= s.end) return at(i, s.start);
    }

    // Cursor solto depois do último token (acabou de digitar um espaço).
    let last = -1;
    for (let i = 0; i < def.args.length; i++) if (slots[i]) last = i;
    if (last >= 0 && def.args[last].greedy && !isComplete(def.args[last], slots[last].text)) {
      return at(last, slots[last].start);
    }
    const next = last + 1;
    return next < def.args.length ? at(next, caret) : null;
  }

  // Análise completa, usada pelo servidor. Devolve { ok, def, values } ou { ok:false, error }.
  function parseCommand(text) {
    const split = splitCommand(text);
    if (!split) return { ok: false, error: 'Comando inválido.' };
    const def = findCommand(split.name);
    if (!def) return { ok: false, error: `Comando desconhecido: "/${split.name}".` };

    const slots = assignArgs(def, split.tokens);
    const values = {};
    for (let i = 0; i < def.args.length; i++) {
      const a = def.args[i], s = slots[i];
      if (!s || !s.text) {
        if (!a.opt) return { ok: false, def, error: `Faltou <${a.name}>. Uso: ${usage(def)}` };
        continue;
      }
      values[a.name] = s.text;
    }
    return { ok: true, def, values };
  }

  return {
    COMMANDS,
    COMMAND_BY_NAME,
    BLOCKS,
    BLOCK_LABEL,
    BLOCK_NAMES,
    normCmd: norm,
    findCommand,
    commandsFor,
    usage,
    splitCommand,
    assignArgs,
    argAt,
    parseCommand,
    resolveItem,
    resolveBlock,
  };
});
