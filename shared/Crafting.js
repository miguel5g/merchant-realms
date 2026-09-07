/* ============================================================
   Crafting.js — Sistema de fabricação de itens e cálculo de valor
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
  const { ITEMS } = deps;

  class Crafting {
    // coins = coroas disponíveis; receitas com custo (blueprints) não consomem materiais.
    static canCraft(inv, recipe, coins = Infinity) {
      if (!recipe || !recipe.needs) return false;
      if ((recipe.coins || 0) > coins) return false;
      return Object.entries(recipe.needs).every(([it, n]) => inv.count(it) >= n);
    }

    static craftableCount(inv, recipe, coins = Infinity) {
      if (!recipe || !recipe.needs) return 0;
      const counts = Object.entries(recipe.needs).map(([it, n]) => Math.floor(inv.count(it) / n));
      if (recipe.coins) counts.push(Math.floor(coins / recipe.coins));
      return counts.length ? Math.min(...counts) : 0;
    }

    // Não debita as coroas: quem chama subtrai recipe.coins quando o retorno é true.
    static craft(inv, recipe, coins = Infinity) {
      if (!this.canCraft(inv, recipe, coins) || !inv.hasSpace(recipe.out, recipe.n)) {
        return false;
      }
      for (const [it, n] of Object.entries(recipe.needs)) {
        inv.remove(it, n);
      }
      inv.add(recipe.out, recipe.n);
      return true;
    }

    static offerValue(items, coins = 0) {
      const itemVal = (items || []).reduce((acc, stack) => {
        const val = (ITEMS && ITEMS[stack.item]?.value) || 0;
        return acc + val * stack.n;
      }, 0);
      return itemVal + (coins || 0);
    }
  }

  // Atalhos para compatibilidade direta
  const canCraft = (inv, r, coins) => Crafting.canCraft(inv, r, coins);
  const craftableCount = (inv, r, coins) => Crafting.craftableCount(inv, r, coins);
  const craft = (inv, r, coins) => Crafting.craft(inv, r, coins);
  const offerValue = (items, coins) => Crafting.offerValue(items, coins);

  return {
    Crafting,
    canCraft,
    craftableCount,
    craft,
    offerValue,
  };
});
