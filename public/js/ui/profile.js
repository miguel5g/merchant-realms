/* ============================================================
   ui/profile.js — Perfil do jogador, estatísticas, habilidades e conquistas.
   ============================================================ */

import { state } from '../state.js';
import { $, esc } from '../utils.js';
import { send } from '../network.js';

export function renderProfile() {
  const s = state.player.stats || {};
  const lvl = Game.levelFromXp(state.player.xp);
  const next = Game.xpForLevel(lvl + 1);
  const cur = Game.xpForLevel(lvl);

  const pfBody = $('#pf-body');
  if (pfBody) pfBody.style.background = state.player.col;

  const pfName = $('#pf-name');
  if (pfName) pfName.textContent = state.player.name;

  const pfTitle = $('#pf-title');
  if (pfTitle) pfTitle.textContent = `${Game.titleFor(lvl)} de ${state.serverInfo.name}`;

  const got = (Game.ACHIEVEMENTS || []).filter(a => state.player.achievements && state.player.achievements.includes(a.id));

  const pfBadges = $('#pf-badges');
  if (pfBadges) {
    pfBadges.innerHTML = (got.slice(-2).map(a => `<span>${esc(a.label)}</span>`).join('')) || '<span class="dim">sem títulos ainda</span>';
  }

  const pfLevel = $('#pf-level');
  if (pfLevel) pfLevel.textContent = lvl;

  const pfXpbar = $('#pf-xpbar');
  if (pfXpbar) pfXpbar.style.width = Math.round(100 * (state.player.xp - cur) / (next - cur)) + '%';

  const pfXp = $('#pf-xp');
  if (pfXp) pfXp.textContent = `${state.player.xp} / ${next} xp`;

  const pfNext = $('#pf-next');
  if (pfNext) pfNext.textContent = `próx.: ${esc(Game.titleFor(lvl + 1)) === Game.titleFor(lvl) ? 'nível ' + (lvl + 1) : Game.titleFor(lvl + 1)}`;

  const pfColors = $('#pf-colors');
  if (pfColors) {
    pfColors.innerHTML = Game.PALETTE.map((c, i) =>
      `<button style="background:${c}" class="${c === state.player.col ? 'on' : ''}" data-c="${i}"></button>`
    ).join('');

    pfColors.querySelectorAll('button').forEach(b => {
      b.onclick = () => send('color', { i: +b.dataset.c });
    });
  }

  const pfServer = $('#pf-server');
  if (pfServer) pfServer.textContent = `${state.serverInfo.name} · dia ${state.time.day}`;

  const h = (s.playMs || 0) / 3600e3;
  const pfStats = $('#pf-stats');
  if (pfStats) {
    pfStats.innerHTML = [
      [h >= 1 ? h.toFixed(1) + 'h' : Math.round(h * 60) + 'min', 'jogados'],
      [s.mined || 0, 'recursos coletados'],
      [s.built || 0, 'blocos construídos'],
      [Game.statNum(s, 'chunks'), 'chunks explorados']
    ].map(([v, l]) => `<div class="stat"><b>${v}</b><span>${l}</span></div>`).join('');
  }

  const pfSkills = $('#pf-skills');
  if (pfSkills) {
    pfSkills.innerHTML = (Game.SKILLS || []).map(sk =>
      `<div><div class="row"><span>${sk.label}</span><span class="dim">nv ${Game.skillLevel(s, sk)}</span></div><div class="track"><i style="width:${Math.round(100 * Game.skillProgress(s, sk))}%;background:${sk.col}"></i></div></div>`
    ).join('');
  }

  const sk = Game.SKILLS ? Game.SKILLS[0] : null;
  const pfSkillhint = $('#pf-skillhint');
  if (pfSkillhint && sk) {
    pfSkillhint.textContent = `Mineração ${Game.skillLevel(s, sk) + 1}: faltam ${sk.per - (Game.statNum(s, sk.key) % sk.per)} minérios.`;
  }

  const rep = (s.trades || 0) + (s.canceled || 0) ? Math.round(100 * s.trades / (s.trades + s.canceled)) : null;
  const partner = Object.entries(s.with || {}).sort((a, b) => b[1] - a[1])[0];

  const pfRep = $('#pf-rep');
  if (pfRep) {
    pfRep.innerHTML = `<div class="row"><span class="dim">Trocas concluídas</span><span>${s.trades || 0}</span></div><div class="row"><span class="dim">Canceladas por você</span><span>${s.canceled || 0}</span></div><div class="row"><span class="dim">Avaliação</span><span class="${rep === null ? 'dim' : rep >= 80 ? 'green' : 'red'}">${rep === null ? 'sem histórico' : (rep >= 80 ? 'Confiável' : 'Cuidado') + ` (${rep}%)`}</span></div><div class="row"><span class="dim">Parceiro frequente</span><span>${partner ? esc(partner[0]) : '—'}</span></div><div class="row"><span class="dim">Coroas</span><span><i class="coin"></i>${state.player.coins}</span></div>`;
  }

  const pfAchcount = $('#pf-achcount');
  if (pfAchcount) pfAchcount.textContent = `${got.length} / ${(Game.ACHIEVEMENTS || []).length}`;

  const pfAch = $('#pf-ach');
  if (pfAch) {
    pfAch.innerHTML = (Game.ACHIEVEMENTS || []).map(a => {
      const g = state.player.achievements && state.player.achievements.includes(a.id);
      return `<div class="${g ? 'got' : ''}" style="${g ? 'background:' + a.col : ''}" data-ach="${esc(a.label)}|${esc(a.desc)}${g ? '' : '|(bloqueada)'}"></div>`;
    }).join('');
  }
}
