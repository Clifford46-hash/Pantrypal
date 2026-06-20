/* PantryPal — persistence + date helpers. Exposes window.PP_STORE. */
(function () {
  "use strict";

  const KEY = "pantrypal.items.v1";
  const SEEDED = "pantrypal.seeded.v1";

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.warn("PantryPal: failed to load items", e);
      return [];
    }
  }

  function save(items) {
    try {
      localStorage.setItem(KEY, JSON.stringify(items));
    } catch (e) {
      console.warn("PantryPal: failed to save items", e);
    }
  }

  /* ---- date helpers ---- */
  function todayISO() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return toISO(d);
  }
  function toISO(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  function addDaysISO(days) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + Number(days || 0));
    return toISO(d);
  }
  /* whole days from today until the given ISO date (negative = past) */
  function daysUntil(iso) {
    if (!iso) return null;
    const target = new Date(iso + "T00:00:00");
    const now = new Date(); now.setHours(0, 0, 0, 0);
    return Math.round((target - now) / 86400000);
  }
  /* severity level for the color rail/badges */
  function levelFor(iso) {
    const d = daysUntil(iso);
    if (d === null) return "none";
    if (d <= 2) return "red";       // expired or ≤2 days
    if (d <= 5) return "amber";     // ≤5 days
    return "green";
  }
  function expiryLabel(iso) {
    const d = daysUntil(iso);
    if (d === null) return "No date";
    if (d < 0) return `Expired ${-d}d ago`;
    if (d === 0) return "Expires today";
    if (d === 1) return "1 day left";
    return `${d} days left`;
  }

  /* Seed a few sample items on first run so the app isn't blank. */
  function seedIfFirstRun() {
    if (localStorage.getItem(SEEDED)) return false;
    localStorage.setItem(SEEDED, "1");
    if (load().length > 0) return false;
    const seed = [
      { name: "Chicken breast", qty: "2", unit: "lb",  category: "meat",    expiry: addDaysISO(2) },
      { name: "Spinach",        qty: "1", unit: "bag", category: "produce", expiry: addDaysISO(3) },
      { name: "Eggs",           qty: "12", unit: "pcs", category: "dairy",  expiry: addDaysISO(20) },
      { name: "Milk",           qty: "1", unit: "L",   category: "dairy",   expiry: addDaysISO(5) },
      { name: "Rice",           qty: "2", unit: "lb",  category: "pantry",  expiry: addDaysISO(300) },
      { name: "Onion",          qty: "3", unit: "pcs", category: "produce", expiry: addDaysISO(25) },
      { name: "Garlic",         qty: "1", unit: "pcs", category: "produce", expiry: addDaysISO(40) },
      { name: "Tomato",         qty: "4", unit: "pcs", category: "produce", expiry: addDaysISO(4) },
      { name: "Pasta",          qty: "1", unit: "box", category: "pantry",  expiry: addDaysISO(280) },
      { name: "Olive oil",      qty: "1", unit: "bottle", category: "pantry", expiry: addDaysISO(200) },
      { name: "Cheese",         qty: "1", unit: "block", category: "dairy", expiry: addDaysISO(18) },
    ].map((s) => Object.assign({ id: uid(), createdAt: Date.now() }, s));
    save(seed);
    return true;
  }

  window.PP_STORE = {
    uid, load, save, seedIfFirstRun,
    todayISO, addDaysISO, daysUntil, levelFor, expiryLabel,
  };
})();
