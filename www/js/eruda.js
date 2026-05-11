// Файл: www/js/eruda.js

async function openEruda() {
  dock.openDock();

  if (!inited) {
    try {
      await ensureErudaLoaded();
    } catch (e) {
      console.warn("[eruda] core not loaded:", e?.message || e);
      return; // не роняем приложение
    }

    try {
      if (!window.eruda?._isInit) {
        window.eruda.init({
          container: dock.mount,
          inline: true,
          useShadowDom: false,
          autoScale: true,
        });
      }

      safeAddPlugin("erudaFps");
    } catch (e) {
      console.warn("[eruda] init failed:", e);
      return;
    }

    inited = true;
  }

  try {
    window.eruda?.show?.();
  } catch {}
}
