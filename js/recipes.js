/* PantryPal — recipe database + ingredient matching. Exposes window.PP_RECIPES. */
(function () {
  "use strict";

  /* Each recipe: ingredients are canonical lowercase names. `staples` are
     pantry basics (salt/oil/etc) that we assume the user has — they don't
     count against the match score but show as "assumed". */
  const RECIPES = [
    {
      id: "scrambled-eggs", name: "Scrambled Eggs", emoji: "🍳", time: 10, serves: 1,
      ingredients: ["eggs", "butter", "milk"], staples: ["salt", "pepper"],
      steps: ["Whisk eggs with a splash of milk, salt and pepper.", "Melt butter in a pan over low heat.", "Pour in eggs, stir gently until just set."],
    },
    {
      id: "garlic-pasta", name: "Garlic Butter Pasta", emoji: "🍝", time: 20, serves: 2,
      ingredients: ["pasta", "garlic", "butter", "cheese"], staples: ["olive oil", "salt"],
      steps: ["Boil pasta until al dente.", "Sauté minced garlic in butter and oil.", "Toss pasta with garlic butter and grated cheese."],
    },
    {
      id: "chicken-rice", name: "Chicken & Rice Bowl", emoji: "🍛", time: 35, serves: 2,
      ingredients: ["chicken breast", "rice", "onion", "garlic"], staples: ["olive oil", "salt"],
      steps: ["Cook rice.", "Sauté diced onion and garlic in oil.", "Add sliced chicken, cook through.", "Serve over rice."],
    },
    {
      id: "veggie-stirfry", name: "Veggie Stir-Fry", emoji: "🥘", time: 20, serves: 2,
      ingredients: ["broccoli", "carrot", "bell pepper", "garlic", "soy sauce"], staples: ["oil", "rice"],
      steps: ["Heat oil in a wok.", "Stir-fry hard veggies first, then softer ones.", "Add garlic and soy sauce, toss 1 minute.", "Serve over rice."],
    },
    {
      id: "tomato-soup", name: "Tomato Soup", emoji: "🍲", time: 30, serves: 3,
      ingredients: ["tomato", "onion", "garlic", "broth"], staples: ["olive oil", "salt"],
      steps: ["Sauté onion and garlic.", "Add chopped tomatoes and broth.", "Simmer 20 min, then blend smooth."],
    },
    {
      id: "grilled-cheese", name: "Grilled Cheese", emoji: "🧀", time: 10, serves: 1,
      ingredients: ["bread", "cheese", "butter"], staples: [],
      steps: ["Butter the outside of two bread slices.", "Add cheese between them.", "Grill in a pan until golden on both sides."],
    },
    {
      id: "omelette", name: "Veggie Omelette", emoji: "🍳", time: 15, serves: 1,
      ingredients: ["eggs", "cheese", "bell pepper", "onion"], staples: ["butter", "salt"],
      steps: ["Beat eggs with salt.", "Sauté diced pepper and onion in butter.", "Pour eggs over, add cheese, fold when set."],
    },
    {
      id: "fried-rice", name: "Egg Fried Rice", emoji: "🍚", time: 20, serves: 2,
      ingredients: ["rice", "eggs", "carrot", "onion", "soy sauce"], staples: ["oil"],
      steps: ["Scramble eggs, set aside.", "Fry diced veggies, add cold rice.", "Stir in soy sauce and eggs."],
    },
    {
      id: "chicken-soup", name: "Chicken Noodle Soup", emoji: "🍜", time: 40, serves: 3,
      ingredients: ["chicken breast", "carrot", "onion", "pasta", "broth"], staples: ["salt"],
      steps: ["Simmer chicken in broth with veggies.", "Shred chicken, return to pot.", "Add pasta, cook until tender."],
    },
    {
      id: "bean-tacos", name: "Bean Tacos", emoji: "🌮", time: 20, serves: 2,
      ingredients: ["beans", "tortilla", "cheese", "tomato", "onion"], staples: ["salt"],
      steps: ["Warm beans with spices.", "Heat tortillas.", "Fill with beans, cheese, diced tomato and onion."],
    },
    {
      id: "spaghetti-marinara", name: "Spaghetti Marinara", emoji: "🍝", time: 25, serves: 2,
      ingredients: ["pasta", "tomato sauce", "garlic", "onion"], staples: ["olive oil", "salt"],
      steps: ["Boil pasta.", "Simmer tomato sauce with sautéed garlic and onion.", "Combine and top with cheese if you have it."],
    },
    {
      id: "banana-oatmeal", name: "Banana Oatmeal", emoji: "🥣", time: 10, serves: 1,
      ingredients: ["oats", "banana", "milk"], staples: ["honey"],
      steps: ["Cook oats in milk.", "Top with sliced banana and a drizzle of honey."],
    },
    {
      id: "avocado-toast", name: "Avocado Toast", emoji: "🥑", time: 8, serves: 1,
      ingredients: ["bread", "avocado", "egg"], staples: ["salt", "pepper"],
      steps: ["Toast bread.", "Mash avocado with salt and pepper.", "Spread on toast, top with a fried egg."],
    },
    {
      id: "salmon-veg", name: "Baked Salmon & Veg", emoji: "🐟", time: 30, serves: 2,
      ingredients: ["salmon", "broccoli", "lemon", "garlic"], staples: ["olive oil", "salt"],
      steps: ["Toss broccoli in oil, roast 10 min.", "Add salmon with lemon and garlic.", "Bake 12–15 min until salmon flakes."],
    },
    {
      id: "chickpea-curry", name: "Chickpea Curry", emoji: "🍛", time: 30, serves: 3,
      ingredients: ["chickpeas", "onion", "garlic", "tomato", "rice"], staples: ["oil", "salt"],
      steps: ["Sauté onion, garlic, ginger.", "Add tomato and chickpeas, simmer.", "Serve over rice."],
    },
    {
      id: "bacon-eggs", name: "Bacon & Eggs", emoji: "🥓", time: 12, serves: 1,
      ingredients: ["bacon", "eggs"], staples: [],
      steps: ["Fry bacon until crisp.", "Fry eggs in the bacon fat to taste."],
    },
    {
      id: "caprese", name: "Tomato Cheese Salad", emoji: "🥗", time: 8, serves: 2,
      ingredients: ["tomato", "cheese"], staples: ["olive oil", "salt"],
      steps: ["Slice tomato and cheese.", "Layer, drizzle with olive oil, season."],
    },
    {
      id: "pancakes", name: "Pancakes", emoji: "🥞", time: 20, serves: 2,
      ingredients: ["flour", "eggs", "milk", "butter"], staples: ["sugar", "salt"],
      steps: ["Whisk flour, egg, milk and a little sugar.", "Cook spoonfuls in buttered pan until bubbly, flip."],
    },
  ];

  /* normalize an item name to a comparable token */
  function norm(s) {
    return (s || "").trim().toLowerCase().replace(/\s+/g, " ");
  }

  /* does an inventory name satisfy a recipe ingredient? */
  function nameMatches(invName, ingredient) {
    const a = norm(invName), b = norm(ingredient);
    if (!a || !b) return false;
    if (a === b) return true;
    if (a.includes(b) || b.includes(a)) return true;
    // singular/plural tolerance
    const aSing = a.replace(/s$/, ""), bSing = b.replace(/s$/, "");
    return aSing === bSing || a.includes(bSing) || b.includes(aSing);
  }

  /* Score every recipe against the inventory.
     Returns recipes sorted by: have-all first, then match ratio, then
     a bonus for using items that are expiring soon. */
  function match(items, daysUntilFn) {
    const inv = items.map((it) => ({ name: it.name, days: daysUntilFn ? daysUntilFn(it.expiry) : null }));

    const scored = RECIPES.map((r) => {
      const have = [], missing = [];
      let soonBonus = 0;

      r.ingredients.forEach((ing) => {
        const hit = inv.find((it) => nameMatches(it.name, ing));
        if (hit) {
          have.push(ing);
          if (hit.days !== null && hit.days <= 5) soonBonus += (hit.days <= 2 ? 2 : 1);
        } else {
          missing.push(ing);
        }
      });

      const total = r.ingredients.length;
      const ratio = total ? have.length / total : 0;
      return {
        recipe: r, have, missing,
        total, haveCount: have.length, ratio, soonBonus,
        canMake: missing.length === 0,
      };
    });

    return scored
      .filter((s) => s.haveCount > 0) // ignore recipes you have nothing for
      .sort((a, b) => {
        if (a.canMake !== b.canMake) return a.canMake ? -1 : 1;
        if (b.ratio !== a.ratio) return b.ratio - a.ratio;
        if (b.soonBonus !== a.soonBonus) return b.soonBonus - a.soonBonus;
        return b.haveCount - a.haveCount;
      });
  }

  window.PP_RECIPES = { RECIPES, match, nameMatches, norm };
})();
