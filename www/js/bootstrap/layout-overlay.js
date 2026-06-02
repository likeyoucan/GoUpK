// Файл: www/js/bootstrap/layout-overlay.js

export function bindLayoutOverlay(options = {}) {
  const minDeltaPx = Number(options.minDeltaPx || 18);
  const settleDelayMs = Number(options.settleDelayMs || 220);
  const holdMs = Number(options.holdMs || 100);

  const app = document.getElementById("app");
  if (!app) return () => {};

  let overlay = document.getElementById("layout-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "layout-overlay";
    overlay.setAttribute("aria-hidden", "true");
    app.appendChild(overlay);
  }

  let lastW = window.innerWidth || 0;
  let lastH = window.innerHeight || 0;
  let hideTimer = null;
  let settleTimer = null;

  const clearTimers = () => {
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
    if (settleTimer) {
      clearTimeout(settleTimer);
      settleTimer = null;
    }
  };

  const show = () => overlay.classList.add("is-visible");
  const hide = () => overlay.classList.remove("is-visible");

  const onViewportChange = () => {
    const w = window.innerWidth || 0;
    const h = window.innerHeight || 0;
    const dw = Math.abs(w - lastW);
    const dh = Math.abs(h - lastH);

    lastW = w;
    lastH = h;

    if (dw < minDeltaPx && dh < minDeltaPx) return;

    show();
    clearTimers();

    settleTimer = setTimeout(() => {
      hideTimer = setTimeout(() => {
        hide();
        hideTimer = null;
      }, holdMs);
      settleTimer = null;
    }, settleDelayMs);
  };

  window.addEventListener("resize", onViewportChange, { passive: true });
  window.addEventListener("orientationchange", onViewportChange, {
    passive: true,
  });

  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", onViewportChange, {
      passive: true,
    });
  }

  return () => {
    clearTimers();
    window.removeEventListener("resize", onViewportChange);
    window.removeEventListener("orientationchange", onViewportChange);
    if (window.visualViewport) {
      window.visualViewport.removeEventListener("resize", onViewportChange);
    }
  };
}
