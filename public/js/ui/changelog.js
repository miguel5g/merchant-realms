/* ============================================================
   ui/changelog.js — Notas de atualização, visualizador de versões e filtros.
   ============================================================ */

import { $, esc } from '../utils.js';

let changelogVer = 0;
let changelogFilter = 'all';
let changelogSearch = '';

export function openChangelog() {
  const modal = $('#changelog');
  if (modal) {
    modal.classList.remove('hidden');
    renderChangelog();
  }
}

export function renderChangelog() {
  const list = Game.CHANGELOG || [];
  if (!list.length) return;
  if (changelogVer >= list.length) changelogVer = 0;
  const cur = list[0];

  const topBadge = $('#cl-badge-top');
  if (topBadge) topBadge.textContent = cur ? cur.version : 'v0.4.0';

  const clVersions = $('#cl-versions');
  if (clVersions) {
    clVersions.innerHTML = list.map((v, i) => `
      <button class="cl-ver-btn ${i === changelogVer ? 'sel' : ''}" data-vi="${i}">
        <div class="v-top">
          <span class="v-ver">${esc(v.version)}</span>
          ${v.current ? '<span class="tag-cur">atual</span>' : ''}
        </div>
        <div class="v-date">${esc(v.date)}</div>
        <div class="v-sub">${esc(v.title)}</div>
      </button>
    `).join('');

    clVersions.querySelectorAll('[data-vi]').forEach(btn => {
      btn.onclick = () => {
        changelogVer = +btn.dataset.vi;
        renderChangelog();
      };
    });
  }

  const totalChanges = list.reduce((acc, v) => acc + (v.items ? v.items.length : 0), 0);
  const clStats = $('#cl-stats');
  if (clStats) {
    clStats.innerHTML = `
      <div><b>${list.length}</b> versões lançadas</div>
      <div><b>${totalChanges}</b> alterações registradas</div>
    `;
  }

  renderChangelogList();
}

export function renderChangelogList() {
  const list = Game.CHANGELOG || [];
  const v = list[changelogVer];
  if (!v) return;

  const q = changelogSearch.toLowerCase().trim();
  const filtered = (v.items || []).filter(item => {
    const matchType = changelogFilter === 'all' || item.type === changelogFilter;
    const matchSearch = !q || item.title.toLowerCase().includes(q) || item.desc.toLowerCase().includes(q);
    return matchType && matchSearch;
  });

  const banner = $('#cl-banner');
  if (banner) {
    banner.innerHTML = `
      <div class="b-title">${esc(v.version)} — ${esc(v.title)}</div>
      <div class="b-meta">${esc(v.date)} · ${filtered.length} de ${v.items.length} itens</div>
    `;
  }

  const clList = $('#cl-list');
  if (clList) {
    if (!filtered.length) {
      clList.innerHTML = '<div class="cl-empty">Nenhuma alteração encontrada para este filtro ou busca.</div>';
    } else {
      clList.innerHTML = filtered.map(item => `
        <div class="cl-item">
          <span class="cl-tag ${esc(item.type)}">${esc(item.type)}</span>
          <div class="cl-item-body">
            <div class="cl-item-title">${esc(item.title)}</div>
            <div class="cl-item-desc">${esc(item.desc)}</div>
          </div>
        </div>
      `).join('');
    }
  }

  $('#cl-filters')?.querySelectorAll('.cl-filter').forEach(btn => {
    btn.classList.toggle('on', btn.dataset.type === changelogFilter);
  });
}

export function initChangelogListeners() {
  $('#cl-close')?.addEventListener('click', () => $('#changelog')?.classList.add('hidden'));

  const modal = $('#changelog');
  if (modal) {
    modal.addEventListener('click', e => {
      if (e.target === modal) modal.classList.add('hidden');
    });
  }

  $('#cl-search')?.addEventListener('input', e => {
    changelogSearch = e.target.value;
    renderChangelogList();
  });

  $('#cl-filters')?.querySelectorAll('.cl-filter').forEach(btn => {
    btn.onclick = () => {
      changelogFilter = btn.dataset.type;
      renderChangelogList();
    };
  });
}
