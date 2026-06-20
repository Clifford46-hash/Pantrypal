/* PantryPal — expiry alerts + opt-in browser notifications. Exposes window.PP_NOTIFY.

   Note: this fires reminders while the app is open (or backgrounded but alive).
   True scheduled push when the app is fully closed needs a backend push server
   — that's on the roadmap. */
(function () {
  "use strict";

  const S = window.PP_STORE;
  const LAST = "pantrypal.lastReminder.v1";

  function supported() { return "Notification" in window; }
  function permission() { return supported() ? Notification.permission : "denied"; }

  function request() {
    if (!supported()) return Promise.resolve("denied");
    try { return Notification.requestPermission(); }
    catch (e) { return Promise.resolve("denied"); }
  }

  /* Items needing attention: expired, or expiring within `withinDays` (default 2). */
  function attentionItems(items, withinDays) {
    const limit = withinDays == null ? 2 : withinDays;
    return items
      .filter((i) => { const d = S.daysUntil(i.expiry); return d !== null && d <= limit; })
      .sort((a, b) => S.daysUntil(a.expiry) - S.daysUntil(b.expiry));
  }

  /* Short human phrase for the alert bar / notification body. */
  function phraseFor(item) {
    const d = S.daysUntil(item.expiry);
    if (d < 0) return `${item.name} expired`;
    if (d === 0) return `${item.name} expires today`;
    if (d === 1) return `${item.name} — 1 day left`;
    return `${item.name} — ${d} days left`;
  }

  function summaryText(items) {
    const list = attentionItems(items);
    if (!list.length) return "";
    if (list.length === 1) return phraseFor(list[0]);
    return `${list.length} items need attention — ${phraseFor(list[0])}, ${phraseFor(list[1])}` +
      (list.length > 2 ? `, +${list.length - 2} more` : "");
  }

  function fire(items) {
    if (permission() !== "granted") return false;
    const list = attentionItems(items);
    if (!list.length) return false;
    const body = list.slice(0, 4).map(phraseFor).join("\n") +
      (list.length > 4 ? `\n+${list.length - 4} more` : "");
    try {
      const n = new Notification("🥗 PantryPal — use it up!", {
        body: body,
        icon: "icons/icon.svg",
        tag: "pantrypal-expiry",
        badge: "icons/icon.svg",
      });
      n.onclick = () => { window.focus(); n.close(); };
      return true;
    } catch (e) { return false; }
  }

  /* Fire at most one reminder per calendar day (when something is urgent). */
  function maybeDailyReminder(items) {
    if (permission() !== "granted") return;
    let last = "";
    try { last = localStorage.getItem(LAST) || ""; } catch (e) {}
    const today = S.todayISO();
    if (last === today) return;
    if (fire(items)) {
      try { localStorage.setItem(LAST, today); } catch (e) {}
    }
  }

  window.PP_NOTIFY = {
    supported, permission, request,
    attentionItems, summaryText, fire, maybeDailyReminder,
  };
})();
