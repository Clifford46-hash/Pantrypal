# 🥗 PantryPal

A mobile-first food inventory app that **tracks groceries & expiration dates** and **suggests recipes from what you already have**.

Built as an installable **PWA** (Progressive Web App) with zero build step — it runs instantly, works offline, stores data on-device, and is designed to wrap into a real iOS/Android app store app later (via Capacitor) with no rewrite.

## Features

- **Inventory** — add/edit/delete items with quantity, unit, category, and expiration date. Saved locally, persists across reloads.
- **Smart add** — autocomplete from a 90+ item food database that auto-fills category and a sensible default expiration date.
- **Barcode scanning** — tap 📷 to scan a product barcode with your phone camera; the name is looked up via [Open Food Facts](https://world.openfoodfacts.org) (free, no key) and pre-fills the add form.
- **Expiring dashboard** — items sorted by soonest expiry, color-coded (🔴 expired/≤2 days, 🟠 ≤5 days, 🟢 fresh), with at-a-glance stats and a red badge counter on the tab.
- **Recipe suggestions** — 18 built-in recipes matched against your inventory. Shows "Ready to cook" vs "need 1–2 items," ranked to prioritize recipes that use ingredients **expiring soon** (reduce food waste).
- **AI recipes** — ✨ generate a custom recipe from your ingredients with Claude (`claude-opus-4-8`), prioritizing soon-to-expire items. Requires your own Anthropic API key (stored on-device, sent directly to Anthropic).
- **Shopping list** — add items by hand, or send a recipe's missing ingredients straight to the list. Check items off, then move them into your inventory in one tap (with smart category + expiry).
- **Storage locations** — each item is tagged Fridge / Freezer / Pantry / Counter, defaulted from its category. Shown on every item row.
- **Used vs. wasted tracking** — when an item leaves your pantry, tap it and choose **Used it** or **Threw out**. One tap, logged to history.
- **Stats / Your Impact** — turns that history into the motivating number: **estimated money saved** (from eating food in time), waste rate, your most-wasted category, and a recent-activity feed. Cost estimates are per-category averages — a future version could let users enter real prices.
- **Expiry alerts & reminders** — a global alert bar surfaces items that are expired or expiring within 2 days the moment you open the app, with a one-tap jump to the Expiring tab. Opt in to **browser notifications** (🔔 Remind me) and PantryPal pings you once a day while the app is open/alive. *Background reminders when the app is fully closed need a push backend — see roadmap.*

### About the AI key
The prototype calls the Claude API directly from the browser using the `anthropic-dangerous-direct-browser-access` header and your key from `localStorage`. This is fine for personal testing. **For a shipped product, route AI calls through your own backend** so your users never need a key and your costs are controlled — that's the recommended production setup.

## Run it

From this folder, start any static server. With Python:

```bash
python -m http.server 8766
```

Then open <http://localhost:8766>. (A service worker enables offline use when served over http/https — opening the file directly also works but without offline caching.)

### Install on your phone
1. Serve the folder somewhere your phone can reach (same Wi-Fi LAN IP, or a free host like Netlify/Vercel/GitHub Pages).
2. Open it in mobile Chrome/Safari → browser menu → **Add to Home Screen**. It launches full-screen like a native app.

## Project structure

```
PantryPal/
├── index.html        # app shell + views
├── styles.css        # mobile-first styling, dark-mode aware
├── js/
│   ├── data.js       # food knowledge base (emoji, category, shelf life)
│   ├── storage.js    # localStorage persistence + date math
│   ├── recipes.js    # recipe DB + ingredient matching engine
│   ├── shopping.js   # shopping-list persistence
│   ├── scanner.js    # camera barcode scan + Open Food Facts lookup
│   ├── ai.js         # Claude API recipe generation (browser-direct)
│   ├── stats.js      # usage/waste history + money-saved aggregation
│   ├── notify.js     # expiry alerts + opt-in browser notifications
│   └── app.js        # UI controller
├── manifest.json     # PWA manifest (installable)
├── sw.js             # service worker (offline cache)
└── icons/
```

## Roadmap (toward a sellable product)

- **Backend proxy for AI** so users don't need their own key (and you control cost/limits).
- **Cloud sync & accounts** so inventory follows you across devices.
- **Push notifications** for items about to expire.
- **App Store / Play Store** packaging via Capacitor.
- Monetization: free tier + premium (sync, unlimited AI recipes, notifications), or one-time unlock.

## Data & privacy

All data lives in your browser's `localStorage` on your device. Nothing is uploaded. Clearing site data or uninstalling removes it (cloud sync is on the roadmap).
