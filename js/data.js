/* PantryPal — static food knowledge base.
   Exposes window.PP_DATA. No build step / modules so it loads over file://. */
(function () {
  "use strict";

  const CATEGORIES = [
    { id: "produce",  label: "Produce",        emoji: "🥬" },
    { id: "meat",     label: "Meat & Seafood", emoji: "🍗" },
    { id: "dairy",    label: "Dairy & Eggs",   emoji: "🥛" },
    { id: "bakery",   label: "Bakery",         emoji: "🍞" },
    { id: "pantry",   label: "Pantry",         emoji: "🥫" },
    { id: "frozen",   label: "Frozen",         emoji: "🧊" },
    { id: "beverage", label: "Beverages",      emoji: "🧃" },
    { id: "other",    label: "Other",          emoji: "🛒" },
  ];

  /* Storage locations. */
  const LOCATIONS = [
    { id: "fridge",  label: "Fridge",  emoji: "🧊" },
    { id: "freezer", label: "Freezer", emoji: "❄️" },
    { id: "pantry",  label: "Pantry",  emoji: "🥫" },
    { id: "counter", label: "Counter", emoji: "🧺" },
  ];

  /* Smart default storage location from a food category. */
  function defaultLocation(category) {
    switch (category) {
      case "produce": case "dairy": case "meat": case "beverage": return "fridge";
      case "frozen": return "freezer";
      case "bakery": case "pantry": return "pantry";
      default: return "pantry";
    }
  }

  /* Rough average replacement cost per category (USD) — used to estimate
     money saved (eaten in time) vs money wasted (thrown out). Deliberately
     conservative; a real version could let users set actual prices. */
  const COST_BY_CATEGORY = {
    meat: 6, produce: 2.5, dairy: 3.5, bakery: 3, pantry: 3,
    frozen: 4, beverage: 3, other: 3,
  };
  function estCost(item) {
    return COST_BY_CATEGORY[item && item.category] || 3;
  }

  /* Known foods: name -> { emoji, category, shelfLife (days, fridge-ish default) }.
     Used for auto-suggest, emoji, smart category + default expiry. */
  const FOODS = {
    // Produce
    "apple": { emoji: "🍎", category: "produce", shelfLife: 21 },
    "banana": { emoji: "🍌", category: "produce", shelfLife: 6 },
    "orange": { emoji: "🍊", category: "produce", shelfLife: 18 },
    "lemon": { emoji: "🍋", category: "produce", shelfLife: 21 },
    "lime": { emoji: "🍋", category: "produce", shelfLife: 21 },
    "strawberry": { emoji: "🍓", category: "produce", shelfLife: 5 },
    "grapes": { emoji: "🍇", category: "produce", shelfLife: 7 },
    "tomato": { emoji: "🍅", category: "produce", shelfLife: 7 },
    "potato": { emoji: "🥔", category: "produce", shelfLife: 30 },
    "onion": { emoji: "🧅", category: "produce", shelfLife: 30 },
    "garlic": { emoji: "🧄", category: "produce", shelfLife: 60 },
    "carrot": { emoji: "🥕", category: "produce", shelfLife: 21 },
    "broccoli": { emoji: "🥦", category: "produce", shelfLife: 7 },
    "lettuce": { emoji: "🥬", category: "produce", shelfLife: 7 },
    "spinach": { emoji: "🥬", category: "produce", shelfLife: 6 },
    "pepper": { emoji: "🫑", category: "produce", shelfLife: 10 },
    "bell pepper": { emoji: "🫑", category: "produce", shelfLife: 10 },
    "cucumber": { emoji: "🥒", category: "produce", shelfLife: 8 },
    "mushroom": { emoji: "🍄", category: "produce", shelfLife: 6 },
    "avocado": { emoji: "🥑", category: "produce", shelfLife: 5 },
    "corn": { emoji: "🌽", category: "produce", shelfLife: 5 },
    "ginger": { emoji: "🫚", category: "produce", shelfLife: 30 },
    // Meat & seafood
    "chicken": { emoji: "🍗", category: "meat", shelfLife: 3 },
    "chicken breast": { emoji: "🍗", category: "meat", shelfLife: 3 },
    "ground beef": { emoji: "🥩", category: "meat", shelfLife: 3 },
    "beef": { emoji: "🥩", category: "meat", shelfLife: 4 },
    "steak": { emoji: "🥩", category: "meat", shelfLife: 4 },
    "pork": { emoji: "🥩", category: "meat", shelfLife: 4 },
    "bacon": { emoji: "🥓", category: "meat", shelfLife: 7 },
    "sausage": { emoji: "🌭", category: "meat", shelfLife: 5 },
    "fish": { emoji: "🐟", category: "meat", shelfLife: 2 },
    "salmon": { emoji: "🐟", category: "meat", shelfLife: 2 },
    "shrimp": { emoji: "🦐", category: "meat", shelfLife: 2 },
    "turkey": { emoji: "🦃", category: "meat", shelfLife: 3 },
    // Dairy & eggs
    "milk": { emoji: "🥛", category: "dairy", shelfLife: 7 },
    "egg": { emoji: "🥚", category: "dairy", shelfLife: 28 },
    "eggs": { emoji: "🥚", category: "dairy", shelfLife: 28 },
    "butter": { emoji: "🧈", category: "dairy", shelfLife: 30 },
    "cheese": { emoji: "🧀", category: "dairy", shelfLife: 21 },
    "yogurt": { emoji: "🥣", category: "dairy", shelfLife: 14 },
    "cream": { emoji: "🥛", category: "dairy", shelfLife: 10 },
    "sour cream": { emoji: "🥣", category: "dairy", shelfLife: 14 },
    // Bakery
    "bread": { emoji: "🍞", category: "bakery", shelfLife: 6 },
    "bagel": { emoji: "🥯", category: "bakery", shelfLife: 7 },
    "tortilla": { emoji: "🫓", category: "bakery", shelfLife: 14 },
    "croissant": { emoji: "🥐", category: "bakery", shelfLife: 3 },
    // Pantry
    "rice": { emoji: "🍚", category: "pantry", shelfLife: 365 },
    "pasta": { emoji: "🍝", category: "pantry", shelfLife: 365 },
    "spaghetti": { emoji: "🍝", category: "pantry", shelfLife: 365 },
    "flour": { emoji: "🌾", category: "pantry", shelfLife: 240 },
    "sugar": { emoji: "🍬", category: "pantry", shelfLife: 365 },
    "salt": { emoji: "🧂", category: "pantry", shelfLife: 999 },
    "olive oil": { emoji: "🫒", category: "pantry", shelfLife: 365 },
    "oil": { emoji: "🛢️", category: "pantry", shelfLife: 365 },
    "beans": { emoji: "🫘", category: "pantry", shelfLife: 365 },
    "black beans": { emoji: "🫘", category: "pantry", shelfLife: 365 },
    "canned tomatoes": { emoji: "🥫", category: "pantry", shelfLife: 365 },
    "tomato sauce": { emoji: "🥫", category: "pantry", shelfLife: 240 },
    "cereal": { emoji: "🥣", category: "pantry", shelfLife: 120 },
    "oats": { emoji: "🥣", category: "pantry", shelfLife: 240 },
    "peanut butter": { emoji: "🥜", category: "pantry", shelfLife: 180 },
    "honey": { emoji: "🍯", category: "pantry", shelfLife: 999 },
    "coffee": { emoji: "☕", category: "pantry", shelfLife: 180 },
    "tea": { emoji: "🍵", category: "pantry", shelfLife: 365 },
    "soy sauce": { emoji: "🍶", category: "pantry", shelfLife: 365 },
    "chickpeas": { emoji: "🫘", category: "pantry", shelfLife: 365 },
    "broth": { emoji: "🥣", category: "pantry", shelfLife: 14 },
    // Frozen
    "ice cream": { emoji: "🍦", category: "frozen", shelfLife: 120 },
    "frozen peas": { emoji: "🟢", category: "frozen", shelfLife: 240 },
    "frozen pizza": { emoji: "🍕", category: "frozen", shelfLife: 180 },
    // Beverages
    "juice": { emoji: "🧃", category: "beverage", shelfLife: 10 },
    "orange juice": { emoji: "🧃", category: "beverage", shelfLife: 10 },
    "soda": { emoji: "🥤", category: "beverage", shelfLife: 180 },
    "water": { emoji: "💧", category: "beverage", shelfLife: 365 },
    "wine": { emoji: "🍷", category: "beverage", shelfLife: 365 },
    "beer": { emoji: "🍺", category: "beverage", shelfLife: 120 },
  };

  const CATEGORY_BY_ID = {};
  CATEGORIES.forEach((c) => { CATEGORY_BY_ID[c.id] = c; });

  /* Look up known-food info by fuzzy name match. */
  function lookupFood(rawName) {
    if (!rawName) return null;
    const n = rawName.trim().toLowerCase();
    if (FOODS[n]) return FOODS[n];
    // exact-ish: try removing trailing 's' (plural)
    if (n.endsWith("s") && FOODS[n.slice(0, -1)]) return FOODS[n.slice(0, -1)];
    // substring: pick the longest known key contained in the name
    let best = null, bestLen = 0;
    for (const key in FOODS) {
      if ((n.includes(key) || key.includes(n)) && key.length > bestLen) {
        best = FOODS[key]; bestLen = key.length;
      }
    }
    return best;
  }

  function emojiFor(name, category) {
    const f = lookupFood(name);
    if (f) return f.emoji;
    const cat = CATEGORY_BY_ID[category];
    return cat ? cat.emoji : "🛒";
  }

  const LOCATION_BY_ID = {};
  LOCATIONS.forEach((l) => { LOCATION_BY_ID[l.id] = l; });

  window.PP_DATA = {
    CATEGORIES, CATEGORY_BY_ID, FOODS,
    LOCATIONS, LOCATION_BY_ID, defaultLocation,
    COST_BY_CATEGORY, estCost,
    FOOD_NAMES: Object.keys(FOODS),
    lookupFood, emojiFor,
  };
})();
