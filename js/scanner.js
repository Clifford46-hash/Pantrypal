/* PantryPal — barcode scanning via camera + Open Food Facts product lookup.
   Exposes window.PP_SCAN. Loads the html5-qrcode library from CDN on demand. */
(function () {
  "use strict";

  const CDN = "https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js";
  let libPromise = null;
  let scanner = null;

  function loadLib() {
    if (window.Html5Qrcode) return Promise.resolve();
    if (libPromise) return libPromise;
    libPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = CDN;
      s.onload = resolve;
      s.onerror = () => reject(new Error("Could not load the barcode scanner library. Check your connection."));
      document.head.appendChild(s);
    });
    return libPromise;
  }

  /* Start scanning into the element with id `elementId`.
     onResult(barcode) fires once on the first successful decode. */
  async function start(elementId, onResult, onError) {
    try {
      await loadLib();
    } catch (e) {
      onError && onError(e.message);
      return;
    }
    try {
      scanner = new window.Html5Qrcode(elementId, { verbose: false });
      const config = { fps: 10, qrbox: { width: 260, height: 160 } };
      let handled = false;
      await scanner.start(
        { facingMode: "environment" },
        config,
        (decodedText) => {
          if (handled) return;
          handled = true;
          stop();
          onResult(decodedText);
        },
        () => { /* per-frame decode misses — ignore */ }
      );
    } catch (e) {
      onError && onError(
        "Couldn't access the camera. Grant camera permission and use a secure (https) connection."
      );
    }
  }

  function stop() {
    if (!scanner) return Promise.resolve();
    const s = scanner;
    scanner = null;
    return s.stop().then(() => s.clear()).catch(() => {});
  }

  /* Look up a product name from a barcode via Open Food Facts (free, no key). */
  async function lookup(barcode) {
    const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=product_name,product_name_en,brands,abbreviated_product_name`;
    try {
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) return null;
      const data = await res.json();
      if (data.status !== 1 || !data.product) return null;
      const p = data.product;
      const name = p.product_name_en || p.product_name || p.abbreviated_product_name || "";
      return name ? { name: name.trim(), brand: (p.brands || "").split(",")[0].trim() } : null;
    } catch (e) {
      return null;
    }
  }

  window.PP_SCAN = { start, stop, lookup };
})();
