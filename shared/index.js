/* ============================================================
   index.js — Ponto de entrada do pacote shared (Node.js e browser)
   ============================================================ */
const constants = require('./constants');
const { PerlinNoise, makeNoise } = require('./PerlinNoise');
const { Inventory } = require('./Inventory');
const { Crafting, canCraft, craftableCount, craft, offerValue } = require('./Crafting');
const { Progression, levelFromXp, xpForLevel, titleFor, statNum, skillLevel, skillProgress } = require('./Progression');
const { GameTime, gameTime, nightAlpha, fmtClock } = require('./GameTime');
const { World, dist, inReach, mineTime } = require('./World');

const Game = {
  // Constantes
  ...constants,

  // Classes
  PerlinNoise,
  Inventory,
  Crafting,
  Progression,
  GameTime,
  World,

  // Funções e utilitários
  makeNoise,
  canCraft,
  craftableCount,
  craft,
  offerValue,
  levelFromXp,
  xpForLevel,
  titleFor,
  statNum,
  skillLevel,
  skillProgress,
  gameTime,
  nightAlpha,
  fmtClock,
  dist,
  inReach,
  mineTime,
};

module.exports = Game;
