// Файл: www/js/eruda.js

// Файл: www/js/eruda.js
(() => {
  if (window.__erudaBootstrapLoaded) return;
  window.__erudaBootstrapLoaded = true;

  const enabled =
    /(^|[?&])eruda=true(&|$)/.test(location.search) ||
    localStorage.getItem("active-eruda") === "true";

  if (!enabled) return;

  const CORE_URLS = [
    "https://unpkg.com/eruda@3.4.3/eruda.js",
    "https://cdn.jsdelivr.net/npm/eruda@3.4.3",
  ];

  const FPS_URLS = [
    "https://unpkg.com/eruda-fps/eruda-fps.min.js",
    "https://cdn.jsdelivr.net/npm/eruda-fps/eruda-fps.min.js",
  ];

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.onload = () => resolve(src);
      s.onerror = () => reject(new Error(`Failed to load: ${src}`));
      document.head.appendChild(s);
    });
  }

  async function loadFromList(urls) {
    let lastErr = null;
    for (const url of urls) {
      try {
        await loadScript(url);
        return url;
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error("All sources failed");
  }

  async function boot() {
    try {
      const loadedCore = await loadFromList(CORE_URLS);
      console.log("[eruda] core loaded:", loadedCore);

      if (!window.eruda?._isInit) {
        window.eruda.init();
      }

      try {
        await loadFromList(FPS_URLS);
        if (window.erudaFps && window.eruda?.add) {
          window.eruda.add(window.erudaFps);
        }
      } catch (e) {
        console.warn("[eruda] fps plugin skipped:", e?.message || e);
      }

      window.eruda?.show?.();
      console.log("[eruda] ready");
    } catch (e) {
      console.warn("[eruda] bootstrap failed:", e?.message || e);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
