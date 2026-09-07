/* ============================================================
   Progression.js — Sistema de experiência, níveis, perícias e títulos
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
  const { ACHIEVEMENTS } = deps;

  class Progression {
    static levelFromXp(xp) {
      return Math.floor(Math.sqrt((xp || 0) / 50)) + 1;
    }

    static xpForLevel(level) {
      return 50 * (level - 1) * (level - 1);
    }

    static titleFor(level) {
      if (level >= 9) return 'Mestre das Terras';
      if (level >= 7) return 'Veterano';
      if (level >= 5) return 'Artesão';
      if (level >= 3) return 'Colono';
      return 'Recém-chegado';
    }

    static statNum(stats, key) {
      if (!stats) return 0;
      return key === 'chunks' ? (stats.chunks || []).length : (stats[key] || 0);
    }

    static skillLevel(stats, skill) {
      if (!skill || !skill.per) return 1;
      return Math.min(20, Math.floor(this.statNum(stats, skill.key) / skill.per) + 1);
    }

    static skillProgress(stats, skill) {
      if (!skill || !skill.per) return 0;
      return (this.statNum(stats, skill.key) % skill.per) / skill.per;
    }

    static getUnlockedAchievements(stats, list = ACHIEVEMENTS) {
      if (!list) return [];
      return list.filter(a => a.test(stats)).map(a => a.id);
    }
  }

  // Atalhos para compatibilidade direta
  const levelFromXp = xp => Progression.levelFromXp(xp);
  const xpForLevel = l => Progression.xpForLevel(l);
  const titleFor = l => Progression.titleFor(l);
  const statNum = (stats, k) => Progression.statNum(stats, k);
  const skillLevel = (stats, s) => Progression.skillLevel(stats, s);
  const skillProgress = (stats, s) => Progression.skillProgress(stats, s);

  return {
    Progression,
    levelFromXp,
    xpForLevel,
    titleFor,
    statNum,
    skillLevel,
    skillProgress,
  };
});
