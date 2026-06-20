/* PantryPal — shopping list persistence. Exposes window.PP_SHOP. */
(function () {
  "use strict";

  const KEY = "pantrypal.shopping.v1";

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.warn("PantryPal: failed to load shopping list", e);
      return [];
    }
  }

  function save(list) {
    try {
      localStorage.setItem(KEY, JSON.stringify(list));
    } catch (e) {
      console.warn("PantryPal: failed to save shopping list", e);
    }
  }

  function uid() {
    return "s" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  /* Add a name if it isn't already on the list (case-insensitive). Returns
     true if added, false if it was a duplicate. */
  function add(list, name) {
    const n = name.trim();
    if (!n) return false;
    if (list.some((i) => i.name.toLowerCase() === n.toLowerCase())) return false;
    list.push({ id: uid(), name: n, checked: false, createdAt: Date.now() });
    return true;
  }

  window.PP_SHOP = { load, save, uid, add };
})();
