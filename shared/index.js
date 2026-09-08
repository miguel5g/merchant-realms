/* ============================================================
   index.js — Ponto de entrada do pacote shared (Node.js e browser)
   ============================================================ */
const constants = require('./constants');
const { PerlinNoise, makeNoise } = require('./PerlinNoise');
const { Inventory } = require('./Inventory');
const { Crafting, canCraft, craftableCount, craft, offerValue } = require('./Crafting');
const { Progression, levelFromXp, xpForLevel, titleFor, statNum, skillLevel, skillProgress } = require('./Progression');
const { GameTime, gameTime, nightAlpha, fmtClock } = require('./GameTime');
const { World, dist, inReach, mineTime, tileWalkable } = require('./World');
const { CHANGELOG } = require('./Changelog');
const Commands = require('./Commands');

const Game = {
  // Constantes
  ...constants,
  ...Commands,
  CHANGELOG,

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
  tileWalkable,
};

module.exports = Game;
