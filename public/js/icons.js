/* ============================================================
   icons.js — Ícones pixel-art (SVG inline) para os itens do inventário.
   Cada item é um grid 8x8 de letras -> cor, convertido em <rect>s. Sem
   asset externo: mesmo espírito das árvores/pedras do mapa e do
   personagem, que também são desenhados só com formas.
   ============================================================ */

const G = 8;

// Fundo dos pixels vazios — mesmo tom escuro do slot (--well no CSS), fixo
// aqui (não dá pra ler variável CSS de dentro do SVG). Sem isso, pixel vazio
// mostrava a cor de fundo do item (o "background:col" do iconHTML), que pra
// item marrom sobre marrom (madeira, machado) virava um blob sólido.
const BACKDROP = '#12150f';

function svgFromGrid(rows, palette) {
  const size = rows.length;
  let cells = `<rect width="${size}" height="${size}" fill="${BACKDROP}"/>`;
  for (let y = 0; y < rows.length; y++) {
    const row = rows[y];
    for (let x = 0; x < row.length; x++) {
      const k = row[x];
      if (k === '.') continue;
      cells += `<rect x="${x}" y="${y}" width="1" height="1" fill="${palette[k]}"/>`;
    }
  }
  return `<svg viewBox="0 0 ${size} ${size}" preserveAspectRatio="xMidYMid meet" shape-rendering="crispEdges">${cells}</svg>`;
}

// Silhueta base de minério (pedra irregular) compartilhada por ferro/cobre,
// só troca a cor do "veio" (c) — como nos jogos onde o minério bruto é a
// mesma rocha com pontinhos de cor diferente.
const ORE_SHAPE = [
  '..aa....',
  '.aaaab..',
  'aacabb..',
  'aaabbcb.',
  '.aabbbb.',
  '..abbb..',
  '........',
  '........',
];

const ICONS = {
  madeira: svgFromGrid([
    '........',
    '.bbbbbb.',
    '.baaaaa.',
    '........',
    '.bbbbbb.',
    '.baaaaa.',
    '........',
    '........',
  ], { b: '#5a3c22', a: '#a97a45' }),

  pedra: svgFromGrid([
    '..aa....',
    '.aaaab..',
    'aaaabb..',
    'aaaabbb.',
    '.aabbbb.',
    '..abbb..',
    '........',
    '........',
  ], { a: '#a7a79e', b: '#77766c' }),

  ferro: svgFromGrid(ORE_SHAPE, { a: '#8a6a52', b: '#5f4735', c: '#d9d9e0' }),
  cobre: svgFromGrid(ORE_SHAPE, { a: '#8a6a52', b: '#5f4735', c: '#e08a3c' }),

  'carvão': svgFromGrid([
    '........',
    '.aa.aa..',
    'aaaaaab.',
    'aaaaaaa.',
    '.aaaaa..',
    '........',
    '........',
    '........',
  ], { a: '#232326', b: '#4a4a52' }),

  'placa de ferro': svgFromGrid([
    '........',
    '........',
    '.aaaaaa.',
    '.acccca.',
    '.abbbba.',
    '.aaaaaa.',
    '........',
    '........',
  ], { a: '#6f7178', c: '#e8e9ee', b: '#c4c6ce' }),

  'placa de cobre': svgFromGrid([
    '........',
    '........',
    '.aaaaaa.',
    '.acccca.',
    '.abbbba.',
    '.aaaaaa.',
    '........',
    '........',
  ], { a: '#7a4f2e', c: '#f0b384', b: '#c77a4a' }),

  engrenagem: svgFromGrid([
    '..a..a..',
    '.aaaaaa.',
    'aaaaaaaa',
    'aaa..aaa',
    'aaa..aaa',
    'aaaaaaaa',
    '.aaaaaa.',
    '..a..a..',
  ], { a: '#9aa0ab' }),

  muro: svgFromGrid([
    'aaabaaab',
    'aaabaaab',
    'bbbbbbbb',
    'baaabaaa',
    'baaabaaa',
    'bbbbbbbb',
    'aaabaaab',
    'aaabaaab',
  ], { a: '#c9b79c', b: '#8f8168' }),

  'baú': svgFromGrid([
    '.aaaaaa.',
    'aaaaaaaa',
    'bbbbbbbb',
    'aaaaaaaa',
    'aaacaaaa',
    'aaaaaaaa',
    'aaaaaaaa',
    '........',
  ], { a: '#8a5a34', b: '#5a3c22', c: '#f2c76b' }),

  // Cabeça em "V" (duas pontas simétricas) sobre cabo reto — lê como
  // picareta mesmo pequeno. A versão anterior usava um cabo diagonal de
  // 1px (uma escada), irreconhecível em 8x8.
  'picareta de pedra': svgFromGrid([
    'a......a',
    '.a....a.',
    '..a..a..',
    '...aa...',
    '...bb...',
    '...bb...',
    '...bb...',
    '...bb...',
  ], { a: '#c8c8c2', b: '#8a5a34' }),

  // Cabeça em cunha só de um lado do cabo (silhueta de machado), reto pra
  // baixo — distinta da picareta simétrica.
  'machado de pedra': svgFromGrid([
    '....aaa.',
    '...aaaaa',
    '....aaa.',
    '...bb...',
    '...bb...',
    '...bb...',
    '...bb...',
    '...bb...',
  ], { a: '#8c8c86', b: '#6b4726' }),
};

// Blueprints: um item dinâmico por gerador (`blueprint <chave>`), todos com
// a mesma "folha de planta" azul — não dá pra listar em ICONS por nome fixo.
const BLUEPRINT_SVG = svgFromGrid([
  '.aaaaaa.',
  '.acccca.',
  '.acccca.',
  '.adddda.',
  '.acccca.',
  '.acccca.',
  '.aaaaaa.',
  '........',
], { a: '#2f4f7a', c: '#7fa8e0', d: '#4a6f9e' });

export function iconSVG(item) {
  if (ICONS[item]) return ICONS[item];
  if (item && item.startsWith('blueprint ')) return BLUEPRINT_SVG;
  return null;
}
