/* PantryPal — AI recipe generation. Exposes window.PP_AI.

   Two paths, tried in order:
   1. BACKEND — POST to our own serverless function (/.netlify/functions/recipe).
      The key lives on the server; the user needs nothing. This is the path on
      the deployed site.
   2. DIRECT — if there's no backend (e.g. running locally), fall back to calling
      the Claude API straight from the browser using a key the user pastes in
      (stored on-device). Good for local dev / no-backend hosting.

   API notes (per Anthropic docs): endpoint POST /v1/messages, model
   claude-opus-4-8, browser-direct calls need the
   `anthropic-dangerous-direct-browser-access` header. Structured outputs
   (`output_config.format`) guarantee valid recipe JSON. */
(function () {
  "use strict";

  const KEYSTORE = "pantrypal.anthropic_key.v1";
  const BACKEND_URL = "/.netlify/functions/recipe";
  const ENDPOINT = "https://api.anthropic.com/v1/messages";
  const MODEL = "claude-opus-4-8";
  const VERSION = "2023-06-01";

  // null = unknown, true/false = learned from the first attempt
  let backendAvailable = null;

  function getKey() {
    try { return localStorage.getItem(KEYSTORE) || ""; } catch (e) { return ""; }
  }
  function setKey(k) {
    try { localStorage.setItem(KEYSTORE, (k || "").trim()); } catch (e) {}
  }
  function hasKey() { return !!getKey(); }

  const RECIPE_SCHEMA = {
    type: "object",
    properties: {
      name: { type: "string" }, emoji: { type: "string" },
      time: { type: "integer" }, serves: { type: "integer" },
      uses: { type: "array", items: { type: "string" } },
      missing: { type: "array", items: { type: "string" } },
      steps: { type: "array", items: { type: "string" } },
    },
    required: ["name", "emoji", "time", "serves", "uses", "missing", "steps"],
    additionalProperties: false,
  };

  function userPrompt(have, soon) {
    return (
      `I have these ingredients at home: ${have || "(nothing)"}.` +
      (soon ? `\nThese are expiring soon — please prioritize using them to reduce food waste: ${soon}.` : "") +
      `\n\nInvent ONE recipe I can realistically cook, using mostly what I have (basic pantry staples like salt, oil, water are fine to assume). ` +
      `List which of my ingredients it uses, anything I'd still need to buy, and clear step-by-step instructions. Keep it practical and home-cook friendly.`
    );
  }

  function needsKeyError() {
    const e = new Error("This app needs an API key, or a deployed backend, to generate AI recipes.");
    e.code = "NEEDS_KEY";
    return e;
  }
  function noBackend() {
    const e = new Error("no backend");
    e.code = "NO_BACKEND";
    return e;
  }

  /* Path 1: our serverless function. Throws NO_BACKEND if it isn't deployed. */
  async function viaBackend(have, soon) {
    let res;
    try {
      res = await fetch(BACKEND_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ have: have.split(", ").filter(Boolean), soon: soon ? soon.split(", ").filter(Boolean) : [] }),
      });
    } catch (e) {
      throw noBackend(); // network error reaching our own origin → no function here
    }
    // 404/405/501 (or a non-JSON error page) = there's no function at this path,
    // e.g. running on a plain static host or locally. Fall back to the key path.
    if (res.status === 404 || res.status === 405 || res.status === 501) throw noBackend();
    const ct = res.headers.get("content-type") || "";
    if (!res.ok && ct.indexOf("application/json") === -1) throw noBackend();
    const data = await res.json().catch(() => null);
    if (!res.ok || !data) {
      throw new Error((data && data.error) || `Request failed (${res.status}).`);
    }
    return data; // already a recipe object (from the function)
  }

  /* Path 2: browser-direct with the user's own key. */
  async function viaDirect(have, soon) {
    const key = getKey();
    if (!key) throw needsKeyError();

    const body = {
      model: MODEL,
      max_tokens: 2000,
      system: "You are a practical, creative home chef. You suggest realistic recipes from the ingredients people already have, prioritizing items that are about to expire to reduce food waste. Respond only with the recipe in the required format.",
      messages: [{ role: "user", content: userPrompt(have, soon) }],
      output_config: { format: { type: "json_schema", schema: RECIPE_SCHEMA } },
    };

    let res;
    try {
      res = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": key,
          "anthropic-version": VERSION,
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify(body),
      });
    } catch (e) {
      throw new Error("Network error reaching the AI service. Check your connection.");
    }

    if (!res.ok) {
      let msg = `Request failed (${res.status}).`;
      try {
        const err = await res.json();
        if (res.status === 401) msg = "Invalid API key. Check it in Settings.";
        else if (res.status === 429) msg = "Rate limited — try again in a moment.";
        else if (err && err.error && err.error.message) msg = err.error.message;
      } catch (e) {}
      throw new Error(msg);
    }

    const data = await res.json();
    if (data.stop_reason === "refusal") throw new Error("The AI declined this request. Try different items.");
    const textBlock = (data.content || []).find((b) => b.type === "text");
    if (!textBlock) throw new Error("Empty response from the AI.");
    let recipe;
    try { recipe = JSON.parse(textBlock.text); }
    catch (e) { throw new Error("Could not read the AI's recipe. Please try again."); }
    recipe.ai = true;
    return recipe;
  }

  /* Orchestrator. items: inventory array; soon: array of names expiring soon. */
  async function generate(items, soon) {
    const have = items.map((i) => i.name).join(", ");
    const soonStr = (soon || []).join(", ");

    if (backendAvailable !== false) {
      try {
        const recipe = await viaBackend(have, soonStr);
        backendAvailable = true;
        return recipe;
      } catch (e) {
        if (e.code === "NO_BACKEND") { backendAvailable = false; /* fall through to direct */ }
        else throw e; // a real error from a working backend — surface it
      }
    }
    return viaDirect(have, soonStr);
  }

  window.PP_AI = { getKey, setKey, hasKey, generate };
})();
