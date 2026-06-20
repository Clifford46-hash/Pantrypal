/* PantryPal — waste/usage history + stats aggregation. Exposes window.PP_STATS.
   Each history entry: { id, name, category, action: "used"|"wasted", cost, at }. */
(function () {
  "use strict";

  const D = window.PP_DATA;
  const KEY = "pantrypal.history.v1";

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.warn("PantryPal: failed to load history", e);
      return [];
    }
  }
  function save(h) {
    try { localStorage.setItem(KEY, JSON.stringify(h)); } catch (e) {}
  }

  /* Record that an item was used up or thrown out. Returns the updated history. */
  function log(history, item, action) {
    history.push({
      id: "h" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
      name: item.name,
      category: item.category || "other",
      action: action, // "used" | "wasted"
      cost: D.estCost(item),
      at: Date.now(),
    });
    save(history);
    return history;
  }

  function startOfMonth() {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  }

  /* Aggregate the history into the numbers the Stats view shows. */
  function summarize(history) {
    const used = history.filter((h) => h.action === "used");
    const wasted = history.filter((h) => h.action === "wasted");
    const total = used.length + wasted.length;

    const saved = used.reduce((s, h) => s + (h.cost || 0), 0);
    const lost = wasted.reduce((s, h) => s + (h.cost || 0), 0);
    const wasteRate = total ? Math.round((wasted.length / total) * 100) : 0;

    const monthStart = startOfMonth();
    const savedThisMonth = used
      .filter((h) => h.at >= monthStart)
      .reduce((s, h) => s + (h.cost || 0), 0);

    // most-wasted category
    const byCat = {};
    wasted.forEach((h) => { byCat[h.category] = (byCat[h.category] || 0) + 1; });
    let topWasted = null, topN = 0;
    Object.keys(byCat).forEach((c) => { if (byCat[c] > topN) { topN = byCat[c]; topWasted = c; } });

    return {
      usedCount: used.length,
      wastedCount: wasted.length,
      total,
      saved, lost, savedThisMonth,
      wasteRate,
      topWasted, topWastedCount: topN,
      recent: history.slice(-8).reverse(),
    };
  }

  window.PP_STATS = { load, save, log, summarize };
})();
