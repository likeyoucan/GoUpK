(function () {
  // ---------- Debug enable ----------
  const enabled =
    /(^|[?&])eruda=true(&|$)/.test(location.search) ||
    localStorage.getItem("active-eruda") === "true";
  if (!enabled) return;

  // Чтобы не запуститься дважды
  if (window.__erudaDockLoaded === true) return;
  window.__erudaDockLoaded = true;

  // ---------- Assets ----------
  // Для APK/offline лучше положить файлы в www/vendor/eruda/ и поставить:
  // const ASSET_BASE = "./vendor/eruda/";
  const ASSET_BASE = "https://cdn.jsdelivr.net/npm/";

  const CORE_SRC = `${ASSET_BASE}eruda`;
  const PLUGINS = [
    `${ASSET_BASE}eruda-dom/eruda-dom.js`,
    `${ASSET_BASE}eruda-monitor/eruda-monitor.js`,
    `${ASSET_BASE}eruda-timing/eruda-timing.js`,
    `${ASSET_BASE}eruda-features/eruda-features.js`,
    `${ASSET_BASE}eruda-orientation/eruda-orientation.js`,
    `${ASSET_BASE}eruda-touches/eruda-touches.js`,
  ];

  // ---------- Helpers ----------
  function onReady(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn, { once: true });
    } else fn();
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
      for (const [k, v] of Object.entries(attrs)) {
        if (k === "style") Object.assign(n.style, v);
        else if (k === "text") n.textContent = v;
        else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v);
        else n.setAttribute(k, v);
      }
    }
    if (parent) parent.appendChild(n);
    return n;
  }

  function loadScriptOnce(src) {
    window.__erudaDockScriptPromises ||= {};
    if (window.__erudaDockScriptPromises[src]) return window.__erudaDockScriptPromises[src];

    window.__erudaDockScriptPromises[src] = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.onload = resolve;
      s.onerror = () => reject(new Error("Failed to load: " + src));
      document.body.appendChild(s);
    });

    return window.__erudaDockScriptPromises[src];
  }

  function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
  }

  const LS = {
    get(k, d) {
      const v = localStorage.getItem(k);
      return v == null ? d : v;
    },
    set(k, v) {
      localStorage.setItem(k, String(v));
    },
  };

  // ---------- CSS ----------
  const CSS = `
  /* Root wrapper for easy cleanup */
  #__erudaDockRoot { position: relative; z-index: 2147483647; }

  /* Always on top */
  #__erudaGear, #__erudaDockBar { z-index: 2147483647; pointer-events:auto; }

  #__erudaGear{
    position:fixed; right:12px; bottom:12px;
    width:44px; height:44px; border-radius:999px;
    border:1px solid rgba(0,0,0,.25);
    background:rgba(255,255,255,.92);
    font-size:20px; line-height:44px; text-align:center;
    color:#111;
    -webkit-tap-highlight-color: transparent;
  }
  #__erudaGear:active{ transform: translateY(1px); }

  /* Dock bar базовый вид */
  #__erudaDockBar{
    position:fixed;
    display:none;
    gap:8px;
    padding:10px;
    width:300px;
    border-radius:12px;
    background:rgba(255,255,255,.82);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    font:12px/1.2 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Arial,sans-serif;
    color:#111;
    box-sizing:border-box;
  }
  #__erudaDockBar.__open{ display:grid; }

  /* Позиции DockBar: br/bl/tr/tl */
  #__erudaDockBar.__pos-br { right:12px; bottom:62px; top:auto; left:auto; }
  #__erudaDockBar.__pos-bl { left:12px;  bottom:62px; top:auto; right:auto; }
  #__erudaDockBar.__pos-tr { right:12px; top:12px; bottom:auto; left:auto; }
  #__erudaDockBar.__pos-tl { left:12px;  top:12px; bottom:auto; right:auto; }

  /* top row */
  #__erudaDockTopRow{ display:flex; align-items:center; justify-content:space-between; gap:8px; }
  #__erudaDockTitle{ font-weight: 600; opacity:.9; }
  #__erudaDockTopBtns{ display:flex; gap:8px; align-items:center; }

  #__erudaDockToggleUi, #__erudaDockMove{
    padding:6px 10px;
    border-radius:10px;
    border:1px solid rgba(0,0,0,.25);
    background:rgba(255,255,255,.92);
    color:#111;
  }

  #__erudaDockBar.__compact #__erudaDockSettings{ display:none; }

  #__erudaDockBtns{ display:flex; gap:6px; margin-top:2px; }
  #__erudaDockBtns button{
    flex:1;
    padding:6px 8px;
    border-radius:10px;
    border:1px solid rgba(0,0,0,.25);
    background:rgba(255,255,255,.92);
    color:#111;
  }

  #__erudaSizeRow{ display:grid; gap:4px; margin-top:6px; }
  #__erudaSize{ width:100%; touch-action: pan-x; }
  #__erudaSizeLabel{ opacity:.85; }

  /* Dock */
  #__erudaDock{
    position:fixed;
    z-index:2147483645;
    display:none;
    background:transparent;
  }
  #__erudaDock.__bottom{ left:0; right:0; bottom:0; }
  #__erudaDock.__top{ left:0; right:0; top:0; }
  #__erudaDock.__left{ left:0; top:0; bottom:0; }
  #__erudaDock.__right{ right:0; top:0; bottom:0; }

  #__erudaMount{ position:absolute; inset:0; }

  /* Resize handle */
  #__erudaResizeHandle{
    position:absolute;
    z-index:2147483646;
    background:rgba(0,0,0,.16);
    touch-action:none;
    user-select:none;
  }
  #__erudaResizeHandle::after{
    content:'';
    position:absolute; left:50%; top:50%;
    transform:translate(-50%,-50%);
    border-radius:999px;
    background:rgba(255,255,255,.65);
    opacity:.95;
  }

  #__erudaDock.__bottom #__erudaResizeHandle{ left:0; right:0; top:0; height:12px; }
  #__erudaDock.__bottom #__erudaResizeHandle::after{ width:44px; height:4px; }

  #__erudaDock.__top #__erudaResizeHandle{ left:0; right:0; bottom:0; height:12px; }
  #__erudaDock.__top #__erudaResizeHandle::after{ width:44px; height:4px; }

  #__erudaDock.__left #__erudaResizeHandle{ top:0; bottom:0; right:0; width:12px; }
  #__erudaDock.__left #__erudaResizeHandle::after{ width:4px; height:44px; }

  #__erudaDock.__right #__erudaResizeHandle{ top:0; bottom:0; left:0; width:12px; }
  #__erudaDock.__right #__erudaResizeHandle::after{ width:4px; height:44px; }

  /* IMPORTANT: keep eruda inside our mount (needs useShadowDom:false) */
  #__erudaDock #eruda{
    position:absolute !important;
    inset:0 !important;
    width:100% !important;
    height:100% !important;
  }
  #__erudaDock .eruda-container{
    position:absolute !important;
    inset:0 !important;
    width:100% !important;
    height:100% !important;
  }
  `;

  onReady(async () => {
    // ---------- Cleanup old instances ----------
    try { window.eruda?.destroy?.(); } catch (_) {}
    document.getElementById("eruda")?.remove();

    document.getElementById("__erudaDockRoot")?.remove();
    [
      "__erudaGear",
      "__erudaDockBar",
      "__erudaDock",
      "__erudaMount",
      "__erudaResizeHandle",
    ].forEach((id) => document.getElementById(id)?.remove());

    injectStyle(CSS);

    // ---------- Build UI ----------
    const root = el("div", { id: "__erudaDockRoot" }, document.body);

    const gear = el("button", { id: "__erudaGear", text: "⚙", title: "Eruda" }, root);

    const bar = el("div", { id: "__erudaDockBar" }, root);

    const topRow = el("div", { id: "__erudaDockTopRow" }, bar);
    el("div", { id: "__erudaDockTitle", text: "Eruda Dock" }, topRow);

    const topBtns = el("div", { id: "__erudaDockTopBtns" }, topRow);
    const moveBtn = el("button", { id: "__erudaDockMove", text: "Move" }, topBtns);
    const toggleUiBtn = el("button", { id: "__erudaDockToggleUi", text: "Hide UI" }, topBtns);

    const settings = el("div", { id: "__erudaDockSettings" }, bar);

    const btns = el("div", { id: "__erudaDockBtns" }, settings);

    const sizeRow = el("div", { id: "__erudaSizeRow" }, settings);
    const sizeLabel = el("div", { id: "__erudaSizeLabel", text: "Size: —" }, sizeRow);
    const sizeInput = el("input", { id: "__erudaSize", type: "range", min: "20", max: "90", step: "1" }, sizeRow);

    const dock = el("div", { id: "__erudaDock" }, root);
    const mount = el("div", { id: "__erudaMount" }, dock);
    const resizeHandle = el("div", { id: "__erudaResizeHandle", title: "Drag to resize" }, dock);

    function bringToFront() {
      document.body.appendChild(root);
    }

    // ---------- State ----------
    let open = LS.get("eruda-open", "false") === "true";
    let compact = LS.get("eruda-ui-compact", "false") === "true";

    // bar position: br/bl/tr/tl
    const barPosOrder = ["br", "bl", "tr", "tl"];
    let barPos = LS.get("eruda-bar-pos", "br");
    if (!barPosOrder.includes(barPos)) barPos = "br";

    const positions = ["top", "bottom", "left", "right"];
    let pos = LS.get("eruda-dock-pos", "bottom");
    if (!positions.includes(pos)) pos = "bottom";

    let sizeV = Number(LS.get("eruda-dock-size-v", "45")); // vh
    let sizeH = Number(LS.get("eruda-dock-size-h", "55")); // vw

    function renderBarPos() {
      bar.classList.remove("__pos-br", "__pos-bl", "__pos-tr", "__pos-tl");
      bar.classList.add(`__pos-${barPos}`);
      LS.set("eruda-bar-pos", barPos);
      bringToFront();
    }

    function renderCompact() {
      if (compact) {
        bar.classList.add("__compact");
        toggleUiBtn.textContent = "Show UI";
      } else {
        bar.classList.remove("__compact");
        toggleUiBtn.textContent = "Hide UI";
      }
      LS.set("eruda-ui-compact", compact);
      bringToFront();
    }

    function applyDock() {
      dock.classList.remove("__top", "__bottom", "__left", "__right");
      dock.classList.add("__" + pos);

      dock.style.top = dock.style.right = dock.style.bottom = dock.style.left = "";
      dock.style.width = dock.style.height = "";

      if (pos === "top" || pos === "bottom") {
        sizeV = clamp(sizeV, 20, 90);
        dock.style.left = "0";
        dock.style.right = "0";
        dock.style[pos] = "0";
        dock.style.height = sizeV + "vh";
        sizeInput.value = String(sizeV);
        sizeLabel.textContent = `Size: ${sizeV}vh (height)`;
      } else {
        sizeH = clamp(sizeH, 20, 90);
        dock.style.top = "0";
        dock.style.bottom = "0";
        dock.style[pos] = "0";
        dock.style.width = sizeH + "vw";
        sizeInput.value = String(sizeH);
        sizeLabel.textContent = `Size: ${sizeH}vw (width)`;
      }

      bringToFront();
    }

    function setPos(p) {
      pos = p;
      LS.set("eruda-dock-pos", pos);
      applyDock();
    }

    // ---------- Dock buttons ----------
    [
      { p: "top", t: "Top" },
      { p: "bottom", t: "Bottom" },
      { p: "left", t: "Left" },
      { p: "right", t: "Right" },
    ].forEach(({ p, t }) => el("button", { text: t, onclick: () => setPos(p) }, btns));

    // ---------- Slider ----------
    function onSize() {
      const val = Number(sizeInput.value);
      if (pos === "top" || pos === "bottom") {
        sizeV = val;
        LS.set("eruda-dock-size-v", sizeV);
      } else {
        sizeH = val;
        LS.set("eruda-dock-size-h", sizeH);
      }
      applyDock();
    }
    sizeInput.addEventListener("input", onSize);
    sizeInput.addEventListener("change", onSize);

    // ---------- Drag resize (throttled to RAF) ----------
    let drag = null;
    let raf = 0;
    let lastMove = null;

    resizeHandle.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      resizeHandle.setPointerCapture(e.pointerId);
      drag = { x: e.clientX, y: e.clientY, sizeV, sizeH };
    });

    resizeHandle.addEventListener("pointermove", (e) => {
      if (!drag) return;
      lastMove = { x: e.clientX, y: e.clientY };
      if (raf) return;

      raf = requestAnimationFrame(() => {
        raf = 0;
        if (!lastMove || !drag) return;

        const vw = Math.max(1, window.innerWidth);
        const vh = Math.max(1, window.innerHeight);

        const dx = lastMove.x - drag.x;
        const dy = lastMove.y - drag.y;

        if (pos === "bottom") sizeV = clamp(drag.sizeV + (-dy / vh) * 100, 20, 90);
        if (pos === "top")    sizeV = clamp(drag.sizeV + ( dy / vh) * 100, 20, 90);
        if (pos === "left")   sizeH = clamp(drag.sizeH + ( dx / vw) * 100, 20, 90);
        if (pos === "right")  sizeH = clamp(drag.sizeH + (-dx / vw) * 100, 20, 90);

        LS.set("eruda-dock-size-v", sizeV);
        LS.set("eruda-dock-size-h", sizeH);

        applyDock();
      });
    });

    function endDrag() {
      drag = null;
      lastMove = null;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    }
    resizeHandle.addEventListener("pointerup", endDrag);
    resizeHandle.addEventListener("pointercancel", endDrag);

    // ---------- Buttons (compact + move) ----------
    toggleUiBtn.addEventListener("click", () => {
      compact = !compact;
      renderCompact();
    });

    moveBtn.addEventListener("click", () => {
      const i = barPosOrder.indexOf(barPos);
      barPos = barPosOrder[(i + 1) % barPosOrder.length];
      renderBarPos();
    });

    // ---------- Load scripts once ----------
    let assetsReady = false;
    async function ensureAssets() {
      if (assetsReady) return;
      await loadScriptOnce(CORE_SRC);
      for (const src of PLUGINS) await loadScriptOnce(src);
      assetsReady = true;
    }

    // ---------- Open/Close (reliable: destroy/init) ----------
    async function openEruda() {
      dock.style.display = "block";
      bar.classList.add("__open");
      applyDock();
      renderBarPos();
      renderCompact();

      await ensureAssets();

      try { window.eruda?.destroy?.(); } catch (_) {}
      document.getElementById("eruda")?.remove();

      // IMPORTANT: useShadowDom:false because we pin eruda DOM with CSS
      eruda.init({
        container: mount,
        inline: true,
        useShadowDom: false,
        autoScale: true,
        defaults: { transparency: 0.95, displaySize: 100 },
      });

      if (window.erudaDom) eruda.add(erudaDom);
      if (window.erudaMonitor) eruda.add(erudaMonitor);
      if (window.erudaTiming) eruda.add(erudaTiming);
      if (window.erudaFeatures) eruda.add(erudaFeatures);
      if (window.erudaOrientation) eruda.add(erudaOrientation);
      if (window.erudaTouches) eruda.add(erudaTouches);

      bringToFront();
    }

    function closeEruda() {
      bar.classList.remove("__open");
      dock.style.display = "none";
      bringToFront();

      try { window.eruda?.destroy?.(); } catch (_) {}
      document.getElementById("eruda")?.remove();
    }

    gear.addEventListener("click", async () => {
      open = !open;
      LS.set("eruda-open", open);
      if (open) await openEruda();
      else closeEruda();
    });

    // Recalc on resize/orientation
    window.addEventListener("resize", () => {
      if (!open) return;
      applyDock();
      renderBarPos();
    });

    // ---------- Initial render ----------
    applyDock();
    renderBarPos();
    renderCompact();
    if (open) await openEruda();
    else closeEruda();

    // ---------- Debug helpers ----------
    window.__erudaDock = {
      open: openEruda,
      close: closeEruda,
      setPos,
      setBarPos: (p) => { barPos = p; renderBarPos(); },
      getState: () => ({ open, compact, barPos, pos, sizeV, sizeH }),
      root,
      dock,
      mount,
      bar,
      gear,
    };
  });
})();