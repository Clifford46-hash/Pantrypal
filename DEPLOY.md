# Deploying PantryPal (permanent, free, with the AI backend)

This makes PantryPal live at a permanent `https://` link that works even when your
PC is off — with AI recipes working for **any** user, no key required from them.

You'll use two free services: **GitHub** (stores the code) and **Netlify** (hosts
the site + the backend function). Total time: ~10 minutes. You do not need to
install anything.

The code is already prepared and committed to a local git repo. You just need to
push it to GitHub and connect Netlify.

---

## Step 1 — Put the code on GitHub

1. Create a free account at <https://github.com> if you don't have one.
2. Click **+ → New repository**. Name it `pantrypal`. Keep it **Public** (or
   Private — both work). **Do not** add a README/.gitignore (we already have them).
   Click **Create repository**.
3. GitHub shows a page with commands under *"…or push an existing repository."*
   Copy the two lines that look like this and run them in your terminal **from the
   `PantryPal` folder** (replace `YOUR-NAME`):

   ```sh
   git remote add origin https://github.com/YOUR-NAME/pantrypal.git
   git branch -M main
   git push -u origin main
   ```

   The first push will ask you to sign in to GitHub (a browser window opens) — do it.

---

## Step 2 — Connect Netlify

1. Create a free account at <https://netlify.com> — choose **"Sign up with GitHub"**
   (simplest).
2. Click **Add new site → Import an existing project → Deploy with GitHub**.
3. Authorize Netlify, then pick your **`pantrypal`** repository.
4. On the build settings screen, leave everything at the defaults
   (Netlify reads `netlify.toml` automatically — publish dir `.`, functions dir
   `netlify/functions`). Click **Deploy**.

Your site goes live at something like `https://your-name-pantrypal.netlify.app`.

---

## Step 3 — Add your Anthropic key (turns on AI for everyone)

1. Get a key at <https://console.anthropic.com> → **API Keys** → create one
   (starts with `sk-ant-`). Add a little credit to your Anthropic account.
2. In Netlify: **Site configuration → Environment variables → Add a variable**.
   - Key: `ANTHROPIC_API_KEY`
   - Value: your `sk-ant-...` key
   - Save.
3. **Redeploy** so the function picks up the key: **Deploys → Trigger deploy →
   Deploy site**.

That's it. Open your `.netlify.app` link on your phone, **Add to Home Screen**, and
tap **✨ Generate AI Recipe** — it works with no key prompt, because the key is now
safely on the server.

---

## Updating the app later

Whenever you (or I) change the code, push it and Netlify redeploys automatically:

```sh
git add -A
git commit -m "Describe what changed"
git push
```

---

## Custom domain (optional)

In Netlify: **Domain management → Add a custom domain** (e.g. `pantrypal.app`).
You buy the domain (~$10–15/yr from any registrar) and point it at Netlify — they
walk you through it and provision HTTPS automatically.

---

## Before you have real users — security notes

The backend function is intentionally simple. Before promoting it widely:

- **Rate-limit / add quotas** to `netlify/functions/recipe.js` so nobody can spam
  it and burn your Claude credits. (A per-IP or per-user daily cap is enough to
  start.)
- **Gate AI behind sign-in** once you add accounts — that's also your natural
  paid-tier boundary (free users get the built-in recipes; paid users get AI).

Background expiry **push notifications** (reminders when the app is fully closed)
are the next backend piece — they need Web Push (VAPID keys) + storing
subscriptions + a scheduled sender. Not included yet; ask when you want it.
