/* PantryPal — UI controller. Depends on PP_DATA, PP_STORE, PP_RECIPES. */
(function () {
  "use strict";

  const D = window.PP_DATA;
  const S = window.PP_STORE;
  const R = window.PP_RECIPES;
  const SHOP = window.PP_SHOP;
  const SCAN = window.PP_SCAN;
  const AI = window.PP_AI;
  const STATS = window.PP_STATS;
  const NOTIFY = window.PP_NOTIFY;

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  let items = [];
  let shopping = [];
  let history = [];
  let activeView = "inventory";
  let categoryFilter = "all";
  let searchTerm = "";
  let alertDismissed = false;

  /* ---------------- init ---------------- */
  function init() {
    S.seedIfFirstRun();
    items = S.load();
    shopping = SHOP.load();
    history = STATS.load();
    buildCategoryControls();
    bindEvents();
    render();
    NOTIFY.maybeDailyReminder(items); // ping once/day if reminders are enabled
  }

  function buildCategoryControls() {
    // filter chips
    const chips = $("#categoryFilter");
    const cats = [{ id: "all", label: "All" }].concat(D.CATEGORIES);
    chips.innerHTML = cats.map((c) =>
      `<button class="chip${c.id === "all" ? " is-active" : ""}" data-cat="${c.id}">${c.emoji ? c.emoji + " " : ""}${c.label}</button>`
    ).join("");

    // category select in form
    $("#itemCategory").innerHTML = D.CATEGORIES.map((c) =>
      `<option value="${c.id}">${c.emoji} ${c.label}</option>`
    ).join("");

    // location select in form
    $("#itemLocation").innerHTML = D.LOCATIONS.map((l) =>
      `<option value="${l.id}">${l.emoji} ${l.label}</option>`
    ).join("");
  }

  /* ---------------- events ---------------- */
  function bindEvents() {
    // tab switching
    $$(".tab").forEach((t) => t.addEventListener("click", () => switchView(t.dataset.tab)));

    // add button
    $("#addBtn").addEventListener("click", () => openModal());

    // category chips
    $("#categoryFilter").addEventListener("click", (e) => {
      const chip = e.target.closest(".chip");
      if (!chip) return;
      categoryFilter = chip.dataset.cat;
      $$("#categoryFilter .chip").forEach((c) => c.classList.toggle("is-active", c === chip));
      renderInventory();
    });

    // search
    $("#searchInput").addEventListener("input", (e) => {
      searchTerm = e.target.value.trim().toLowerCase();
      renderInventory();
    });

    // item tap (event delegation across lists)
    $("#main").addEventListener("click", (e) => {
      const row = e.target.closest(".item");
      if (row) openModal(row.dataset.id);
    });

    // modal
    $$("[data-close]").forEach((el) => el.addEventListener("click", closeModal));
    $("#itemForm").addEventListener("submit", onSubmit);
    $("#deleteBtn").addEventListener("click", onDelete);
    $("#usedBtn").addEventListener("click", () => removeWithOutcome("used"));
    $("#wastedBtn").addEventListener("click", () => removeWithOutcome("wasted"));

    // quick date buttons
    $$(".quickdate").forEach((b) => b.addEventListener("click", () => {
      $("#itemExpiry").value = S.addDaysISO(b.dataset.days);
    }));

    // name autocomplete + smart defaults
    const nameInput = $("#itemName");
    nameInput.addEventListener("input", onNameInput);
    $("#nameSuggest").addEventListener("click", (e) => {
      const opt = e.target.closest(".suggest__item");
      if (opt) applyNameSuggestion(opt.dataset.name);
    });
    document.addEventListener("click", (e) => {
      if (!e.target.closest(".field")) hideSuggest();
    });

    // barcode scanner
    $("#scanBtn").addEventListener("click", openScanner);
    $$("[data-scanclose]").forEach((el) => el.addEventListener("click", closeScanner));

    // AI recipes
    $("#aiBtn").addEventListener("click", onGenerateAI);
    $("#keyForm").addEventListener("submit", onSaveKey);
    $$("[data-keyclose]").forEach((el) => el.addEventListener("click", () => { $("#keyModal").hidden = true; }));

    // shopping list
    $("#shopAddForm").addEventListener("submit", onShopAdd);
    $("#shoppingList").addEventListener("click", onShopListClick);
    $("#shopMoveBtn").addEventListener("click", moveCheckedToInventory);
    $("#shopClearBtn").addEventListener("click", clearChecked);

    // "add missing to shopping list" on recipe cards (delegated)
    $("#recipeList").addEventListener("click", onRecipeListClick);
    $("#aiResult").addEventListener("click", onRecipeListClick);

    // expiry alert bar
    $("#alertView").addEventListener("click", () => switchView("expiring"));
    $("#alertClose").addEventListener("click", () => { alertDismissed = true; $("#alertBar").hidden = true; });
    $("#alertNotify").addEventListener("click", onEnableReminders);
  }

  async function onEnableReminders() {
    const result = await NOTIFY.request();
    if (result === "granted") {
      toast("Reminders on 🔔");
      NOTIFY.fire(items);
      renderAlert();
    } else {
      toast("Notifications blocked — enable them in your browser settings");
    }
  }

  /* ---------------- view switching ---------------- */
  function switchView(view) {
    activeView = view;
    $$(".tab").forEach((t) => t.classList.toggle("is-active", t.dataset.tab === view));
    $$(".view").forEach((v) => { v.hidden = v.dataset.view !== view; });
    render();
  }

  /* ---------------- render ---------------- */
  function render() {
    if (activeView === "inventory") renderInventory();
    else if (activeView === "expiring") renderExpiring();
    else if (activeView === "recipes") renderRecipes();
    else if (activeView === "shopping") renderShopping();
    else if (activeView === "stats") renderStats();
    renderBadge();
    renderAlert();
  }

  /* Global alert bar — surfaces items that are expired or expiring within 2 days. */
  function renderAlert() {
    const bar = $("#alertBar");
    if (alertDismissed) { bar.hidden = true; return; }
    const text = NOTIFY.summaryText(items);
    if (!text) { bar.hidden = true; return; }
    $("#alertText").textContent = text;
    // offer the "Remind me" button only if notifications are supported and not yet granted
    $("#alertNotify").hidden = !(NOTIFY.supported() && NOTIFY.permission() !== "granted");
    bar.hidden = false;
  }

  function itemRowHTML(it) {
    const level = S.levelFor(it.expiry);
    const emoji = D.emojiFor(it.name, it.category);
    const qty = [it.qty, it.unit].filter(Boolean).join(" ");
    const loc = D.LOCATION_BY_ID[it.location || D.defaultLocation(it.category)];
    const badgeClass = level === "red" ? "badge--red" : level === "amber" ? "badge--amber" : level === "green" ? "badge--green" : "badge--gray";
    return `
      <div class="item" data-id="${it.id}" data-level="${level}">
        <div class="item__emoji">${emoji}</div>
        <div class="item__body">
          <div class="item__name">${escapeHTML(it.name)}</div>
          <div class="item__meta">
            ${qty ? `<span>${escapeHTML(qty)}</span>` : ""}
            ${loc ? `<span>· ${loc.emoji} ${loc.label}</span>` : ""}
          </div>
        </div>
        <div class="item__right">
          <span class="badge ${badgeClass}">${S.expiryLabel(it.expiry)}</span>
        </div>
      </div>`;
  }

  function renderInventory() {
    let list = items.slice();
    if (categoryFilter !== "all") list = list.filter((i) => i.category === categoryFilter);
    if (searchTerm) list = list.filter((i) => i.name.toLowerCase().includes(searchTerm));
    list.sort((a, b) => {
      const da = S.daysUntil(a.expiry), db = S.daysUntil(b.expiry);
      if (da === null) return 1;
      if (db === null) return -1;
      return da - db;
    });

    const empty = items.length === 0;
    $("#inventoryEmpty").hidden = !empty;
    $("#inventoryList").innerHTML = list.map(itemRowHTML).join("");
    if (!empty && list.length === 0) {
      $("#inventoryList").innerHTML = `<p class="empty__text" style="text-align:center;padding:24px">No items match your filter.</p>`;
    }
  }

  function renderExpiring() {
    const withDates = items.filter((i) => i.expiry);
    const soon = withDates.filter((i) => S.daysUntil(i.expiry) <= 7)
      .sort((a, b) => S.daysUntil(a.expiry) - S.daysUntil(b.expiry));

    const expired = withDates.filter((i) => S.daysUntil(i.expiry) < 0).length;
    const within3 = withDates.filter((i) => { const d = S.daysUntil(i.expiry); return d >= 0 && d <= 3; }).length;
    const within7 = withDates.filter((i) => { const d = S.daysUntil(i.expiry); return d >= 0 && d <= 7; }).length;

    $("#expStats").innerHTML = `
      <div class="stat stat--red"><div class="stat__num">${expired}</div><div class="stat__label">Expired</div></div>
      <div class="stat stat--amber"><div class="stat__num">${within3}</div><div class="stat__label">≤ 3 days</div></div>
      <div class="stat"><div class="stat__num">${within7}</div><div class="stat__label">≤ 7 days</div></div>`;

    $("#expiringEmpty").hidden = soon.length > 0;
    $("#expiringList").innerHTML = soon.map(itemRowHTML).join("");
  }

  function renderRecipes() {
    if (items.length === 0) {
      $("#recipesEmpty").hidden = false;
      $("#recipeList").innerHTML = "";
      return;
    }
    $("#recipesEmpty").hidden = true;

    const matches = R.match(items, S.daysUntil).slice(0, 12);
    $("#recipeList").innerHTML = matches.map(recipeCardHTML).join("");
  }

  function recipeCardHTML(m) {
    const r = m.recipe;
    const pct = Math.round(m.ratio * 100);
    const matchClass = m.canMake ? "badge--green" : pct >= 60 ? "badge--amber" : "badge--gray";
    const matchText = m.canMake ? "Ready to cook" : `${m.haveCount}/${m.total} ingredients`;

    // ingredient chips — mark which you have, which are missing, which expiring-soon
    const soonNames = new Set(
      items.filter((i) => { const d = S.daysUntil(i.expiry); return d !== null && d <= 5; }).map((i) => i.name)
    );
    const ingHTML = r.ingredients.map((ing) => {
      const have = m.have.includes(ing);
      const usesSoon = have && Array.from(soonNames).some((n) => R.nameMatches(n, ing));
      const cls = !have ? "ing ing--missing" : usesSoon ? "ing ing--soon" : "ing";
      return `<span class="${cls}">${escapeHTML(ing)}</span>`;
    }).join("");

    const missingNote = m.missing.length
      ? `<div class="recipe__missing">Need: ${m.missing.map(escapeHTML).join(", ")}
           <button type="button" class="addmissing" data-missing="${escapeAttr(JSON.stringify(m.missing))}">+ Add to list</button>
         </div>` : "";

    const steps = r.steps.map((s) => `<li>${escapeHTML(s)}</li>`).join("");

    return `
      <article class="recipe">
        <div class="recipe__top">
          <span class="recipe__emoji">${r.emoji}</span>
          <span class="recipe__name">${escapeHTML(r.name)}</span>
          <span class="recipe__match badge ${matchClass}">${matchText}</span>
        </div>
        <div class="recipe__meta"><span>⏱ ${r.time} min</span><span>🍽 Serves ${r.serves}</span></div>
        <div class="recipe__bar"><span style="width:${pct}%"></span></div>
        <div class="recipe__ings">${ingHTML}</div>
        ${missingNote}
        <details class="recipe__steps"><summary>How to make it</summary><ol>${steps}</ol></details>
      </article>`;
  }

  function renderBadge() {
    const count = items.filter((i) => { const d = S.daysUntil(i.expiry); return d !== null && d <= 3; }).length;
    const badge = $("#expBadge");
    badge.hidden = count === 0;
    badge.textContent = count;

    const unchecked = shopping.filter((i) => !i.checked).length;
    const sb = $("#shopBadge");
    sb.hidden = unchecked === 0;
    sb.textContent = unchecked;
  }

  /* ---------------- shopping list ---------------- */
  function renderShopping() {
    const empty = shopping.length === 0;
    $("#shoppingEmpty").hidden = !empty;
    $("#shoppingActions").hidden = !shopping.some((i) => i.checked);

    // unchecked first, then checked
    const sorted = shopping.slice().sort((a, b) => (a.checked === b.checked ? 0 : a.checked ? 1 : -1));
    $("#shoppingList").innerHTML = sorted.map((it) => `
      <div class="shopitem${it.checked ? " is-checked" : ""}" data-id="${it.id}">
        <button class="shopcheck" data-act="toggle" aria-label="Toggle">${it.checked ? "✓" : ""}</button>
        <span class="shopname">${escapeHTML(it.name)}</span>
        <button class="shopdel" data-act="del" aria-label="Remove">✕</button>
      </div>`).join("");
  }

  function onShopAdd(e) {
    e.preventDefault();
    const input = $("#shopInput");
    if (SHOP.add(shopping, input.value)) {
      SHOP.save(shopping);
      input.value = "";
      render();
    } else {
      toast("Already on your list");
      input.value = "";
    }
  }

  function onShopListClick(e) {
    const row = e.target.closest(".shopitem");
    if (!row) return;
    const act = e.target.closest("[data-act]");
    if (!act) return;
    const it = shopping.find((i) => i.id === row.dataset.id);
    if (!it) return;
    if (act.dataset.act === "toggle") it.checked = !it.checked;
    else if (act.dataset.act === "del") shopping = shopping.filter((i) => i.id !== it.id);
    SHOP.save(shopping);
    render();
  }

  function clearChecked() {
    shopping = shopping.filter((i) => !i.checked);
    SHOP.save(shopping);
    render();
    toast("Cleared");
  }

  /* Move checked shopping items into inventory (with smart category + expiry). */
  function moveCheckedToInventory() {
    const checked = shopping.filter((i) => i.checked);
    if (!checked.length) return;
    checked.forEach((s) => {
      const known = D.lookupFood(s.name);
      const cat = known ? known.category : "other";
      items.push({
        id: S.uid(), createdAt: Date.now(),
        name: s.name, qty: "", unit: "",
        category: cat, location: D.defaultLocation(cat),
        expiry: known ? S.addDaysISO(known.shelfLife) : "",
      });
    });
    shopping = shopping.filter((i) => !i.checked);
    S.save(items);
    SHOP.save(shopping);
    render();
    toast(`Moved ${checked.length} item${checked.length > 1 ? "s" : ""} to inventory`);
  }

  function onRecipeListClick(e) {
    const btn = e.target.closest(".addmissing");
    if (!btn) return;
    let missing = [];
    try { missing = JSON.parse(btn.dataset.missing); } catch (err) { return; }
    let added = 0;
    missing.forEach((n) => { if (SHOP.add(shopping, n)) added++; });
    SHOP.save(shopping);
    renderBadge();
    toast(added ? `Added ${added} to shopping list` : "Already on your list");
  }

  /* ---------------- stats ---------------- */
  function renderStats() {
    const s = STATS.summarize(history);
    const empty = s.total === 0;
    $("#statsEmpty").hidden = !empty;
    if (empty) { $("#statsBody").innerHTML = ""; return; }

    const topCat = s.topWasted ? (D.CATEGORY_BY_ID[s.topWasted] || { label: s.topWasted, emoji: "🛒" }) : null;
    const rate = s.wasteRate;
    const rateClass = rate <= 20 ? "good" : rate <= 40 ? "ok" : "bad";

    const recent = s.recent.map((h) => {
      const cat = D.CATEGORY_BY_ID[h.category] || { emoji: "🛒" };
      const tag = h.action === "used"
        ? `<span class="histtag histtag--used">Used +$${(h.cost || 0).toFixed(0)}</span>`
        : `<span class="histtag histtag--wasted">Wasted −$${(h.cost || 0).toFixed(0)}</span>`;
      return `<div class="histrow">
        <span class="histemoji">${cat.emoji}</span>
        <span class="histname">${escapeHTML(h.name)}</span>
        ${tag}
      </div>`;
    }).join("");

    $("#statsBody").innerHTML = `
      <div class="hero">
        <div class="hero__label">Estimated money saved</div>
        <div class="hero__num">$${s.saved.toFixed(0)}</div>
        <div class="hero__sub">$${s.savedThisMonth.toFixed(0)} this month · from eating ${s.usedCount} item${s.usedCount === 1 ? "" : "s"} in time</div>
      </div>

      <div class="stats" style="margin-top:14px">
        <div class="stat"><div class="stat__num">${s.usedCount}</div><div class="stat__label">Used in time</div></div>
        <div class="stat stat--red"><div class="stat__num">${s.wastedCount}</div><div class="stat__label">Thrown out</div></div>
        <div class="stat"><div class="stat__num">${rate}%</div><div class="stat__label">Waste rate</div></div>
      </div>

      <div class="ratebar ratebar--${rateClass}">
        <div class="ratebar__fill" style="width:${rate}%"></div>
        <span class="ratebar__cap">${rate <= 20 ? "Great — very little waste 🌱" : rate <= 40 ? "Not bad — room to improve" : "Lots of waste — let's cut it down"}</span>
      </div>

      ${s.lost > 0 ? `<div class="lostnote">You've thrown out about <strong>$${s.lost.toFixed(0)}</strong> of food${topCat ? ` — most often <strong>${topCat.emoji} ${escapeHTML(topCat.label)}</strong>. Buy a little less of that, or freeze it sooner.` : "."}</div>` : ""}

      <h3 class="stats__h3">Recent activity</h3>
      <div class="hist">${recent}</div>`;
  }

  /* ---------------- barcode scanner ---------------- */
  function openScanner() {
    $("#scanModal").hidden = false;
    $("#scanStatus").textContent = "Point your camera at a product barcode…";
    SCAN.start("reader", onScanned, (msg) => { $("#scanStatus").textContent = msg; });
  }

  function closeScanner() {
    SCAN.stop();
    $("#scanModal").hidden = true;
  }

  async function onScanned(barcode) {
    $("#scanStatus").textContent = "Looking up product…";
    const product = await SCAN.lookup(barcode);
    $("#scanModal").hidden = true;
    // Open the add form, prefilled with whatever we found.
    openModal();
    if (product && product.name) {
      $("#itemName").value = product.name;
      const known = D.lookupFood(product.name);
      if (known) {
        $("#itemCategory").value = known.category;
        $("#itemLocation").value = D.defaultLocation(known.category);
        $("#itemExpiry").value = S.addDaysISO(known.shelfLife);
      }
      toast("Product found — set the expiry date");
    } else {
      $("#itemName").value = "";
      $("#itemName").placeholder = `Barcode ${barcode} — type the item name`;
      toast("Not in the product database — add it by name");
    }
  }

  /* ---------------- AI recipes ---------------- */
  function soonNamesList() {
    return items
      .filter((i) => { const d = S.daysUntil(i.expiry); return d !== null && d <= 5; })
      .sort((a, b) => S.daysUntil(a.expiry) - S.daysUntil(b.expiry))
      .map((i) => i.name);
  }

  async function onGenerateAI() {
    if (items.length === 0) { toast("Add some items first"); return; }

    const btn = $("#aiBtn");
    btn.disabled = true;
    btn.textContent = "✨ Cooking up an idea…";
    $("#aiResult").innerHTML = "";
    try {
      const recipe = await AI.generate(items, soonNamesList());
      $("#aiResult").innerHTML = aiRecipeCardHTML(recipe);
    } catch (err) {
      if (err && err.code === "NEEDS_KEY") {
        // No backend deployed and no personal key — ask for one (local/dev path).
        $("#keyInput").value = "";
        $("#keyModal").hidden = false;
      } else {
        $("#aiResult").innerHTML = `<div class="aierror">⚠️ ${escapeHTML((err && err.message) || "Something went wrong.")}</div>`;
      }
    } finally {
      btn.disabled = false;
      btn.textContent = "✨ Generate AI Recipe";
    }
  }

  function onSaveKey(e) {
    e.preventDefault();
    const k = $("#keyInput").value.trim();
    if (!k) return;
    AI.setKey(k);
    $("#keyModal").hidden = true;
    toast("Key saved");
    onGenerateAI();
  }

  function aiRecipeCardHTML(r) {
    const uses = (r.uses || []).map((i) => `<span class="ing">${escapeHTML(i)}</span>`).join("");
    const missing = (r.missing || []).map((i) => `<span class="ing ing--missing">${escapeHTML(i)}</span>`).join("");
    const steps = (r.steps || []).map((s) => `<li>${escapeHTML(s)}</li>`).join("");
    const missingBtn = (r.missing && r.missing.length)
      ? `<button type="button" class="addmissing" data-missing="${escapeAttr(JSON.stringify(r.missing))}">+ Add missing to list</button>` : "";
    return `
      <article class="recipe recipe--ai">
        <div class="recipe__top">
          <span class="recipe__emoji">${escapeHTML(r.emoji || "✨")}</span>
          <span class="recipe__name">${escapeHTML(r.name || "AI Recipe")}</span>
          <span class="recipe__match badge badge--ai">AI</span>
        </div>
        <div class="recipe__meta"><span>⏱ ${Number(r.time) || "?"} min</span><span>🍽 Serves ${Number(r.serves) || "?"}</span></div>
        <div class="recipe__ings">${uses}${missing}</div>
        ${missingBtn}
        <details class="recipe__steps" open><summary>How to make it</summary><ol>${steps}</ol></details>
      </article>`;
  }

  /* ---------------- modal / form ---------------- */
  function openModal(id) {
    const form = $("#itemForm");
    form.reset();
    hideSuggest();
    if (id) {
      const it = items.find((i) => i.id === id);
      if (!it) return;
      $("#modalTitle").textContent = "Edit Item";
      $("#itemId").value = it.id;
      $("#itemName").value = it.name;
      $("#itemQty").value = it.qty || "";
      $("#itemUnit").value = it.unit || "";
      $("#itemCategory").value = it.category || "other";
      $("#itemLocation").value = it.location || D.defaultLocation(it.category);
      $("#itemExpiry").value = it.expiry || "";
      $("#deleteBtn").hidden = false;
      $("#outcomeActions").hidden = false; // "Used it" / "Threw out" for existing items
    } else {
      $("#modalTitle").textContent = "Add Item";
      $("#itemId").value = "";
      $("#itemCategory").value = "other";
      $("#itemLocation").value = "pantry";
      $("#deleteBtn").hidden = true;
      $("#outcomeActions").hidden = true;
    }
    $("#modal").hidden = false;
    if (!id) setTimeout(() => $("#itemName").focus(), 50);
  }

  function closeModal() { $("#modal").hidden = true; }

  function onSubmit(e) {
    e.preventDefault();
    const name = $("#itemName").value.trim();
    if (!name) return;
    const id = $("#itemId").value;
    const data = {
      name,
      qty: $("#itemQty").value.trim(),
      unit: $("#itemUnit").value,
      category: $("#itemCategory").value,
      location: $("#itemLocation").value,
      expiry: $("#itemExpiry").value,
    };

    if (id) {
      const idx = items.findIndex((i) => i.id === id);
      if (idx >= 0) items[idx] = Object.assign({}, items[idx], data);
      toast("Item updated");
    } else {
      items.push(Object.assign({ id: S.uid(), createdAt: Date.now() }, data));
      toast("Item added");
    }
    S.save(items);
    closeModal();
    render();
  }

  function onDelete() {
    const id = $("#itemId").value;
    items = items.filter((i) => i.id !== id);
    S.save(items);
    closeModal();
    toast("Item deleted");
    render();
  }

  /* Remove an item and log whether it was used or wasted (drives the Stats tab). */
  function removeWithOutcome(action) {
    const id = $("#itemId").value;
    const it = items.find((i) => i.id === id);
    if (!it) return;
    STATS.log(history, it, action);
    items = items.filter((i) => i.id !== id);
    S.save(items);
    closeModal();
    render();
    const cost = D.estCost(it).toFixed(0);
    toast(action === "used" ? `Nice — ~$${cost} saved 🎉` : `Logged. ~$${cost} wasted 😕`);
  }

  /* ---------------- name autocomplete ---------------- */
  function onNameInput(e) {
    const val = e.target.value.trim().toLowerCase();
    if (val.length < 1) { hideSuggest(); return; }
    const matches = D.FOOD_NAMES
      .filter((n) => n.includes(val))
      .sort((a, b) => a.indexOf(val) - b.indexOf(val) || a.length - b.length)
      .slice(0, 6);
    if (!matches.length) { hideSuggest(); return; }
    const box = $("#nameSuggest");
    box.innerHTML = matches.map((n) =>
      `<div class="suggest__item" data-name="${n}">${D.FOODS[n].emoji} ${n}</div>`
    ).join("");
    box.hidden = false;

    // also auto-fill category + location from a known food
    const known = D.lookupFood(val);
    if (known) {
      $("#itemCategory").value = known.category;
      $("#itemLocation").value = D.defaultLocation(known.category);
    }
  }

  function applyNameSuggestion(name) {
    $("#itemName").value = name.charAt(0).toUpperCase() + name.slice(1);
    const f = D.FOODS[name];
    if (f) {
      $("#itemCategory").value = f.category;
      $("#itemLocation").value = D.defaultLocation(f.category);
      if (!$("#itemExpiry").value) $("#itemExpiry").value = S.addDaysISO(f.shelfLife);
    }
    hideSuggest();
    $("#itemQty").focus();
  }

  function hideSuggest() { $("#nameSuggest").hidden = true; }

  /* ---------------- util ---------------- */
  let toastTimer;
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 1800);
  }

  function escapeHTML(s) {
    return String(s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  // for values placed inside double-quoted HTML attributes (e.g. JSON payloads)
  function escapeAttr(s) {
    return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  document.addEventListener("DOMContentLoaded", init);
})();
