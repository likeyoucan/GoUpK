// Файл: www/js/eruda.js

import { onReady, injectStyle } from "./eruda/loader.js?v=VERSION";
import { ensureErudaLoaded, safeAddPlugin } from "./eruda/plugins.js?v=VERSION";
import { createErudaDock } from "./eruda/ui-dock.js?v=VERSION";

(function () {
  if (window.__erudaDockLoaded) return;
  window.__erudaDockLoaded = true;

  const enabled =
    /(^|[?&])eruda=true(&|$)/.test(location.search) ||
    localStorage.getItem("active-eruda") === "true";

  if (!enabled) return;

  const CSS = `
#__erudaGear { z-index: 2147483647; }
#__erudaBar { z-index: 2147483646; }
#__erudaPanel { z-index: 2147483645; }

#__erudaGear {
  position: fixed;
  right: 12px;
  bottom: 12px;
  width: 48px;
  height: 48px;
  border-radius: 14px;
  border: 1px solid rgba(120,120,128,0.25);
  background: rgba(255,255,255,0.92);
  color: #111;
  font-size: 22px;
  line-height: 48px;
  text-align: center;
  box-shadow: 0 4px 12px rgba(0,0,0,0.14);
}

#__erudaBar {
  position: fixed;
  right: 12px;
  bottom: 70px;
  display: none;
  width: 300px;
  padding: 10px;
  gap: 8px;
  border-radius: 16px;
  border: 1px solid rgba(0,0,0,0.08);
  background: rgba(255,255,255,0.94);
  backdrop-filter: blur(10px);
  box-shadow: 0 8px 24px rgba(0,0,0,0.15);
  font: 12px/1.4 system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
}
#__erudaBar.__open { display: grid; }

#__erudaBar button {
  min-height: 32px;
  border-radius: 10px;
  border: 1px solid rgba(0,0,0,0.22);
  background: #fff;
  color: #111;
  cursor: pointer;
  font-weight: 600;
}

#__erudaPanel {
  position: fixed;
  display: none;
  background: transparent;
  overflow: hidden;
}
#__erudaPanel.__open { display: block; }

#__erudaPanel.__bottom { left: 0; right: 0; bottom: 0; top: auto; }
#__erudaPanel.__top { left: 0; right: 0; top: 0; bottom: auto; }
#__erudaPanel.__left { left: 0; top: 0; bottom: 0; right: auto; }
#__erudaPanel.__right { right: 0; top: 0; bottom: 0; left: auto; }

#__erudaMount { position: absolute; inset: 0; overflow: hidden; }

#__erudaResize {
  position: absolute;
  background: rgba(0,0,0,0.15);
  touch-action: none;
  user-select: none;
}
#__erudaPanel.__bottom #__erudaResize { left: 0; right: 0; top: 0; height: 12px; cursor: ns-resize; }
#__erudaPanel.__top #__erudaResize { left: 0; right: 0; bottom: 0; height: 12px; cursor: ns-resize; }
#__erudaPanel.__left #__erudaResize { top: 0; bottom: 0; right: 0; width: 12px; cursor: ew-resize; }
#__erudaPanel.__right #__erudaResize { top: 0; bottom: 0; left: 0; width: 12px; cursor: ew-resize; }

@media (prefers-color-scheme: dark) {
  #__erudaGear {
    background: rgba(25,25,30,0.92);
    color: #fff;
    border-color: rgba(255,255,255,0.12);
  }
  #__erudaBar {
    background: rgba(25,25,30,0.94);
    color: #eee;
    border-color: rgba(255,255,255,0.12);
  }
  #__erudaBar button {
    background: #1f1f24;
    color: #eee;
    border-color: rgba(255,255,255,0.15);
  }
}
`;

  onReady(async () => {
    injectStyle(CSS);

    const dock = createErudaDock();
    let inited = false;

    async function openEruda() {
      dock.openDock();

      if (!inited) {
        try {
          await ensureErudaLoaded();
        } catch (e) {
          console.warn("[eruda] core not loaded:", e?.message || e);
          return;
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
        } catch (err) {
          console.warn("[eruda] init failed:", err);
          return;
        }

        inited = true;
      }

      try {
        window.eruda?.show?.();
      } catch {}
    }

    function closeEruda() {
      dock.closeDock();
      try {
        window.eruda?.hide?.();
      } catch {}
    }

    dock.onToggle(async (isOpen) => {
      if (isOpen) await openEruda();
      else closeEruda();
    });

    if (dock.isOpen()) await openEruda();
    else closeEruda();
  });
})();
