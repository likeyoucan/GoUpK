// Файл: www/js/eruda.js

(function () {
  if (window.__erudaDockLoaded) return;
  window.__erudaDockLoaded = true;

  const enabled =
    /(^|[?&])eruda=true(&|$)/.test(location.search) ||
    localStorage.getItem("active-eruda") === "true";

  if (!enabled) return;

  const ERUDA_CORE = "https://cdn.jsdelivr.net/npm/eruda@3.4.3";
  const ERUDA_PLUGINS = [
    "https://cdn.jsdelivr.net/npm/eruda-fps@1.0.2/eruda-fps.js",
    "https://cdn.jsdelivr.net/npm/eruda-dom@2.0.1/eruda-dom.js",
    "https://cdn.jsdelivr.net/npm/eruda-monitor@1.0.3/eruda-monitor.js",
    "https://cdn.jsdelivr.net/npm/eruda-timing@1.0.1/eruda-timing.js",
  ];

  const LS = {
    get(key, fallback) {
      const raw = localStorage.getItem(key);
      return raw == null ? fallback : raw;
    },
    set(key, value) {
      localStorage.setItem(key, String(value));
    },
  };

  function onReady(cb) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", cb, { once: true });
    } else {
      cb();
    }
  }

  function injectStyle(cssText) {
    const s = document.createElement("style");
    s.type = "text/css";
    s.appendChild(document.createTextNode(cssText));
    document.head.appendChild(s);
  }

  function el(tag, attrs, parent) {
    const n = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach((k) => {
        const v = attrs[k];
        if (k === "style") Object.assign(n.style, v);
        else if (k === "text") n.textContent = v;
        else if (k.startsWith("on") && typeof v === "function") {
          n.addEventListener(k.slice(2), v);
        } else {
          n.setAttribute(k, v);
        }
      });
    }
    if (parent) parent.appendChild(n);
    return n;
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  const scriptPromiseCache = {};
  function loadScriptOnce(src) {
    if (scriptPromiseCache[src]) return scriptPromiseCache[src];

    scriptPromiseCache[src] = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.crossOrigin = "anonymous";
      s.referrerPolicy = "no-referrer";

      s.onload = () => resolve();
      s.onerror = () => reject(new Error(`Failed to load: ${src}`));

      document.body.appendChild(s);
    });

    return scriptPromiseCache[src];
  }

  const CSS = `
#__erudaGear { z-index: 2147483647; }
#__erudaBar { z-index: 2147483646; }
#__erudaPanel { z-index: 2147483645; }
#__erudaGear {
  position: fixed; right: 12px; bottom: 12px;
  width: 48px; height: 48px; border-radius: 14px;
  border: 1px solid rgba(120,120,128,0.25);
  background: rgba(255,255,255,0.92);
  color: #111; font-size: 22px; line-height: 48px; text-align: center;
  box-shadow: 0 4px 12px rgba(0,0,0,0.14);
}
#__erudaBar {
  position: fixed; right: 12px; bottom: 70px;
  display: none; width: 280px; padding: 10px; gap: 8px;
  border-radius: 14px; border: 1px solid rgba(0,0,0,0.08);
  background: rgba(255,255,255,0.94);
  box-shadow: 0 8px 24px rgba(0,0,0,0.15);
  font: 12px/1.4 system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
}
#__erudaBar.__open { display: grid; }
#__erudaBar button {
  min-height: 32px; border-radius: 10px;
  border: 1px solid rgba(0,0,0,0.22);
  background: #fff; color: #111; cursor: pointer;
}
#__erudaPanel {
  position: fixed; inset: auto 0 0 0; height: 45vh; display: none;
  background: transparent; overflow: hidden;
}
#__erudaPanel.__open { display: block; }
#__erudaMount { position: absolute; inset: 0; overflow: hidden; }
#__erudaResize {
  position: absolute; left: 0; right: 0; top: 0; height: 12px;
  background: rgba(0,0,0,0.15); cursor: ns-resize; touch-action: none;
}
@media (prefers-color-scheme: dark) {
  #__erudaGear {
    background: rgba(25,25,30,0.92); color: #fff;
    border-color: rgba(255,255,255,0.12);
  }
  #__erudaBar {
    background: rgba(25,25,30,0.94); color: #eee;
    border-color: rgba(255,255,255,0.12);
  }
  #__erudaBar button {
    background: #1f1f24; color: #eee; border-color: rgba(255,255,255,0.15);
  }
}
`;

  onReady(async function () {
    injectStyle(CSS);

    const gear = el("button", { id: "__erudaGear", text: "⚙" }, document.body);
    const bar = el("div", { id: "__erudaBar" }, document.body);

    const row1 = el("div", null, bar);
    row1.style.display = "grid";
    row1.style.gridTemplateColumns = "1fr auto";
    row1.style.gap = "8px";
    el("div", { text: "Eruda Dock" }, row1);

    const toggleUiBtn = el("button", { text: "Hide UI" }, row1);

    const row2 = el("div", null, bar);
    row2.style.display = "grid";
    row2.style.gridTemplateColumns = "repeat(3, 1fr)";
    row2.style.gap = "6px";

    const hardReloadBtn = el("button", { text: "Hard Reload" }, bar);
    hardReloadBtn.style.background = "#ff3b30";
    hardReloadBtn.style.color = "#fff";
    hardReloadBtn.style.border = "none";

    const sizeLabel = el("div", { text: "Size: 45vh" }, bar);
    const sizeInput = el(
      "input",
      { type: "range", min: "20", max: "90", step: "1" },
      bar,
    );
    sizeInput.value = LS.get("eruda-panel-size-vh", "45");

    const panel = el("div", { id: "__erudaPanel" }, document.body);
    const resize = el("div", { id: "__erudaResize" }, panel);
    const mount = el("div", { id: "__erudaMount" }, panel);

    let open = LS.get("eruda-open", "false") === "true";
    let compact = LS.get("eruda-ui-compact", "false") === "true";
    let inited = false;

    function applySize(vh) {
      const clamped = clamp(Number(vh) || 45, 20, 90);
      panel.style.height = `${clamped}vh`;
      sizeInput.value = String(clamped);
      sizeLabel.textContent = `Size: ${clamped}vh`;
      LS.set("eruda-panel-size-vh", clamped);
    }

    applySize(sizeInput.value);

    const posBtns = [
      ["Console", () => window.eruda?.show?.("console")],
      ["Elements", () => window.eruda?.show?.("elements")],
      ["Network", () => window.eruda?.show?.("network")],
    ];

    posBtns.forEach(([name, fn]) => {
      const b = el("button", { text: name }, row2);
      b.addEventListener("click", () => {
        try {
          fn();
        } catch {}
      });
    });

    function renderCompact() {
      if (compact) {
        sizeLabel.style.display = "none";
        sizeInput.style.display = "none";
        toggleUiBtn.textContent = "Show UI";
      } else {
        sizeLabel.style.display = "";
        sizeInput.style.display = "";
        toggleUiBtn.textContent = "Hide UI";
      }
      LS.set("eruda-ui-compact", compact);
    }

    toggleUiBtn.addEventListener("click", () => {
      compact = !compact;
      renderCompact();
    });

    hardReloadBtn.addEventListener("click", () => {
      if (confirm("Clear cache and reload?")) location.reload();
    });

    sizeInput.addEventListener("input", () => applySize(sizeInput.value));

    let drag = null;
    resize.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      resize.setPointerCapture(e.pointerId);
      drag = { y: e.clientY, h: panel.getBoundingClientRect().height };
    });

    resize.addEventListener("pointermove", (e) => {
      if (!drag) return;
      const vh = window.innerHeight || 1;
      const dy = e.clientY - drag.y;
      const nextPx = drag.h - dy;
      const nextVh = (nextPx / vh) * 100;
      applySize(nextVh);
    });

    const stopDrag = () => {
      drag = null;
    };
    resize.addEventListener("pointerup", stopDrag);
    resize.addEventListener("pointercancel", stopDrag);

    async function ensureErudaLoaded() {
      await loadScriptOnce(ERUDA_CORE);

      // Plugins should not crash the whole initialization.
      await Promise.allSettled(ERUDA_PLUGINS.map((src) => loadScriptOnce(src)));
    }

    function safeAddPlugin(objRefName) {
      try {
        if (window[objRefName] && window.eruda?.add) {
          window.eruda.add(window[objRefName]);
        }
      } catch {}
    }

    async function openEruda() {
      bar.classList.add("__open");
      panel.classList.add("__open");

      if (!inited) {
        await ensureErudaLoaded();

        try {
          if (!window.eruda?._isInit) {
            window.eruda.init({
              container: mount,
              inline: true,
              useShadowDom: false,
              autoScale: true,
            });
          }

          safeAddPlugin("erudaFps");
          safeAddPlugin("erudaDom");
          safeAddPlugin("erudaMonitor");
          safeAddPlugin("erudaTiming");
        } catch (err) {
          console.warn("[eruda] init failed:", err);
        }

        inited = true;
      }

      try {
        window.eruda?.show?.();
      } catch {}
    }

    function closeEruda() {
      bar.classList.remove("__open");
      panel.classList.remove("__open");
      try {
        window.eruda?.hide?.();
      } catch {}
    }

    gear.addEventListener("click", async () => {
      open = !open;
      LS.set("eruda-open", open);
      if (open) await openEruda();
      else closeEruda();
    });

    renderCompact();
    if (open) {
      await openEruda();
    } else {
      closeEruda();
    }
  });
})();
