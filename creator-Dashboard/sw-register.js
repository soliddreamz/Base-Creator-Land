/* Base System — Creator Dashboard SW register (folder-scoped)
   - Registers ./service-worker.js inside creator-Dashboard/
   - Forces update check on every load
   - Forces activation immediately
   - Reloads once when new SW takes control
*/

(function () {
  if (!("serviceWorker" in navigator)) return;

  const SW_URL = "./service-worker.js";
  let reloading = false;

  window.addEventListener("load", async () => {
    try {
      const reg = await navigator.serviceWorker.register(SW_URL);

      // Always check for updates on load
      await reg.update();

      // If already waiting, activate now
      if (reg.waiting) {
        reg.waiting.postMessage({ type: "SKIP_WAITING" });
      }

      reg.addEventListener("updatefound", () => {
        const nw = reg.installing;
        if (!nw) return;

        nw.addEventListener("statechange", () => {
          if (nw.state === "installed" && navigator.serviceWorker.controller) {
            if (reg.waiting) reg.waiting.postMessage({ type: "SKIP_WAITING" });
          }
        });
      });

      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (reloading) return;
        reloading = true;
        window.location.reload();
      });
    } catch (_) {
      // Silent fail: dashboard still loads without SW
    }
  });
})();
