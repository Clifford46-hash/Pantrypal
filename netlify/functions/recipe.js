/* PantryPal backend — Claude recipe proxy (Netlify Function).
 *
 * Why this exists: it keeps your Anthropic API key on the server. The app calls
 * THIS function; this function calls Claude with the secret key. Users never see
 * or need a key.
 *
 * Setup: in Netlify, set an environment variable ANTHROPIC_API_KEY to your key.
 *
 * Runs on Node 18+ (Netlify default), which has a global `fetch`.
 *
 * Production TODO (not needed to launch, but before you scale):
 *   - Add rate limiting / per-user quotas so the endpoint can't be abused to
 *     burn your Claude credits.
 *   - Optionally restrict by Origin, or require a signed-in user (paid tier).
 */

const MODEL = "claude-opus-4-8";
const ANTHROPIC_VERSION = "2023-06-01";

const RECIPE_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string" },
    emoji: { type: "string" },
    time: { type: "integer" },
    serves: { type: "integer" },
    uses: { type: "array", items: { type: "string" } },
    missing: { type: "array", items: { type: "string" } },
    steps: { type: "array", items: { type: "string" } },
  },
  required: ["name", "emoji", "time", "serves", "uses", "missing", "steps"],
  additionalProperties: false,
};

function buildPrompt(have, soon) {
  const haveStr = (have && have.length ? have.join(", ") : "(nothing)");
  const soonStr = (soon && soon.length ? soon.join(", ") : "");
  return (
    `I have these ingredients at home: ${haveStr}.` +
    (soonStr ? `\nThese are expiring soon — please prioritize using them to reduce food waste: ${soonStr}.` : "") +
    `\n\nInvent ONE recipe I can realistically cook, using mostly what I have (basic pantry staples like salt, oil, water are fine to assume). ` +
    `List which of my ingredients it uses, anything I'd still need to buy, and clear step-by-step instructions. Keep it practical and home-cook friendly.`
  );
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, body: "" };
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return { statusCode: 500, body: JSON.stringify({ error: "Server not configured: set ANTHROPIC_API_KEY in Netlify." }) };
  }

  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch (e) { return { statusCode: 400, body: JSON.stringify({ error: "Bad request body." }) }; }

  const have = Array.isArray(body.have) ? body.have.slice(0, 100) : [];
  const soon = Array.isArray(body.soon) ? body.soon.slice(0, 100) : [];
  if (!have.length) {
    return { statusCode: 400, body: JSON.stringify({ error: "No ingredients provided." }) };
  }

  const payload = {
    model: MODEL,
    max_tokens: 2000,
    system: "You are a practical, creative home chef. You suggest realistic recipes from the ingredients people already have, prioritizing items that are about to expire to reduce food waste. Respond only with the recipe in the required format.",
    messages: [{ role: "user", content: buildPrompt(have, soon) }],
    output_config: { format: { type: "json_schema", schema: RECIPE_SCHEMA } },
  };

  let res;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    return { statusCode: 502, body: JSON.stringify({ error: "Could not reach the AI service." }) };
  }

  const data = await res.json().catch(() => null);
  if (!res.ok || !data) {
    const msg = (data && data.error && data.error.message) || `AI request failed (${res.status}).`;
    return { statusCode: res.status || 502, body: JSON.stringify({ error: msg }) };
  }
  if (data.stop_reason === "refusal") {
    return { statusCode: 422, body: JSON.stringify({ error: "The AI declined this request. Try different items." }) };
  }

  const textBlock = (data.content || []).find((b) => b.type === "text");
  if (!textBlock) {
    return { statusCode: 502, body: JSON.stringify({ error: "Empty response from the AI." }) };
  }

  let recipe;
  try { recipe = JSON.parse(textBlock.text); }
  catch (e) { return { statusCode: 502, body: JSON.stringify({ error: "Could not parse the AI's recipe." }) }; }

  recipe.ai = true;
  return {
    statusCode: 200,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(recipe),
  };
};
