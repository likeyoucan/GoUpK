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
    "https://cdn.jsdelivr.net/npm/eruda-timing@1.0.1/eruda-timing.js"
  ];

  const LS = {
    get(key, fallback) {
      const raw = localStorage.getItem(key);
      return raw == null ? fallback : raw;
    },
    set(key, value) {
      localStorage.setItem(key, String(value));
    }
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
        else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v);
        else n.setAttribute(k, v);
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

  onReady(async function () {
    injectStyle(CSS);

    const gear = el("button", { id: "__erudaGear", text: "⚙" }, document.body);
    const bar = el("div", { id: "__erudaBar" }, document.body);

    const headerRow = el("div", null, bar);
    headerRow.style.display = "grid";
    headerRow.style.gridTemplateColumns = "1fr auto";
    headerRow.style.gap = "8px";
    headerRow.style.alignItems = "center";

    const headerTitle = el("div", { text: "Eruda Panel" }, headerRow);
    headerTitle.style.fontWeight = "700";

    const toggleUiBtn = el("button", { text: "Hide UI" }, headerRow);

    const controlsWrap = el("div", null, bar);
    controlsWrap.style.display = "grid";
    controlsWrap.style.gap = "8px";

    const rowPos = el("div", null, controlsWrap);
    rowPos.style.display = "grid";
    rowPos.style.gridTemplateColumns = "repeat(4, 1fr)";
    rowPos.style.gap = "6px";

    const rowTabs = el("div", null, controlsWrap);
    rowTabs.style.display = "grid";
    rowTabs.style.gridTemplateColumns = "repeat(3, 1fr)";
    rowTabs.style.gap = "6px";

    const hardReloadBtn = el("button", { text: "Hard Reload" }, controlsWrap);
    hardReloadBtn.style.background = "#ff3b30";
    hardReloadBtn.style.color = "#fff";
    hardReloadBtn.style.border = "none";

    const sizeLabel = el("div", { text: "Size: 45vh" }, controlsWrap);
    const sizeInput = el("input", { type: "range", min: "20", max: "90", step: "1" }, controlsWrap);

    const panel = el("div", { id: "__erudaPanel" }, document.body);
    const resize = el("div", { id: "__erudaResize" }, panel);
    const mount = el("div", { id: "__erudaMount" }, panel);

    let open = LS.get("eruda-open", "false") === "true";
    let compact = LS.get("eruda-ui-compact", "false") === "true";
    let inited = false;

    let panelPos = LS.get("eruda-panel-pos", "bottom");
    let sizeVh = Number(LS.get("eruda-panel-size-vh", "45"));
    let sizeVw = Number(LS.get("eruda-panel-size-vw", "55"));

    function applyPanelGeometry() {
      panel.classList.remove("__top", "__bottom", "__left", "__right");
      panel.classList.add(`__${panelPos}`);

      if (panelPos === "top" || panelPos === "bottom") {
        sizeVh = clamp(sizeVh, 20, 90);
        panel.style.width = "100%";
        panel.style.height = `${sizeVh}vh`;
        sizeInput.value = String(sizeVh);
        sizeLabel.textContent = `Size: ${sizeVh}vh (height)`;
      } else {
        sizeVw = clamp(sizeVw, 20, 90);
        panel.style.height = "100%";
        panel.style.width = `${sizeVw}vw`;
        sizeInput.value = String(sizeVw);
        sizeLabel.textContent = `Size: ${sizeVw}vw (width)`;
      }

      LS.set("eruda-panel-pos", panelPos);
      LS.set("eruda-panel-size-vh", sizeVh);
      LS.set("eruda-panel-size-vw", sizeVw);
    }

    function setPanelPos(nextPos) {
      panelPos = nextPos;
      applyPanelGeometry();
    }

    ["Top", "Bottom", "Left", "Right"].forEach((name) => {
      const key = name.toLowerCase();
      const b = el("button", { text: name }, rowPos);
      b.addEventListener("click", () => setPanelPos(key));
    });

    [
      ["Console", () => window.eruda?.show?.("console")],
      ["Elements", () => window.eruda?.show?.("elements")],
      ["Network", () => window.eruda?.show?.("network")]
    ].forEach(([name, fn]) => {
      const b = el("button", { text: name }, rowTabs);
      b.addEventListener("click", () => {
        try {
          fn();
        } catch { }
      });
    });

    function renderCompact() {
      if (compact) {
        controlsWrap.style.display = "none";
        headerTitle.style.display = "none";
        headerRow.style.gridTemplateColumns = "1fr";
        toggleUiBtn.textContent = "Show UI";
      } else {
        controlsWrap.style.display = "grid";
        headerTitle.style.display = "";
        headerRow.style.gridTemplateColumns = "1fr auto";
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

    sizeInput.addEventListener("input", () => {
      const val = clamp(Number(sizeInput.value) || 45, 20, 90);
      if (panelPos === "top" || panelPos === "bottom") sizeVh = val;
      else sizeVw = val;
      applyPanelGeometry();
    });

    let drag = null;
    resize.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      resize.setPointerCapture(e.pointerId);
      drag = { x: e.clientX, y: e.clientY, vh: sizeVh, vw: sizeVw };
    });

    resize.addEventListener("pointermove", (e) => {
      if (!drag) return;

      const vw = Math.max(1, window.innerWidth);
      const vh = Math.max(1, window.innerHeight);
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;

      if (panelPos === "bottom") sizeVh = clamp(drag.vh + (-dy / vh) * 100, 20, 90);
      else if (panelPos === "top") sizeVh = clamp(drag.vh + (dy / vh) * 100, 20, 90);
      else if (panelPos === "left") sizeVw = clamp(drag.vw + (dx / vw) * 100, 20, 90);
      else if (panelPos === "right") sizeVw = clamp(drag.vw + (-dx / vw) * 100, 20, 90);

      applyPanelGeometry();
    });

    const stopDrag = () => {
      drag = null;
    };
    resize.addEventListener("pointerup", stopDrag);
    resize.addEventListener("pointercancel", stopDrag);

    async function ensureErudaLoaded() {
      await loadScriptOnce(ERUDA_CORE);
      await Promise.allSettled(ERUDA_PLUGINS.map((src) => loadScriptOnce(src)));
    }

    function safeAddPlugin(objRefName) {
      try {
        if (window[objRefName] && window.eruda?.add) window.eruda.add(window[objRefName]);
      } catch { }
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
              autoScale: true
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
      } catch { }
    }

    function closeEruda() {
      bar.classList.remove("__open");
      panel.classList.remove("__open");
      try {
        window.eruda?.hide?.();
      } catch { }
    }

    gear.addEventListener("click", async () => {
      open = !open;
      LS.set("eruda-open", open);
      if (open) await openEruda();
      else closeEruda();
    });

    window.addEventListener("resize", applyPanelGeometry);

    renderCompact();
    applyPanelGeometry();

    if (open) await openEruda();
    else closeEruda();
  });
})();