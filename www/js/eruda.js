(function () {
  if (window.__erudaDockLoaded) return;
  window.__erudaDockLoaded = true;

  // ====== ВКЛ/ВЫКЛ ======
  // включение: ?eruda=true  ИЛИ localStorage.active-eruda = 'true'
  const enabled =
    /(^|[?&])eruda=true(&|$)/.test(location.search) ||
    localStorage.getItem("active-eruda") === "true";
  if (!enabled) return;

  // CDN (можно заменить на локальную папку, если положите файлы в www/vendor/eruda/)
  // например: const BASE = "vendor/eruda/";
  const BASE = "https://cdn.jsdelivr.net/npm/";

  const CORE_SRC = `${BASE}eruda`;

  const PLUGINS = [
    { src: `${BASE}eruda-dom/eruda-dom.js`, add: () => eruda.add(erudaDom) },
    { src: `${BASE}eruda-monitor/eruda-monitor.js`, add: () => eruda.add(erudaMonitor) },
    { src: `${BASE}eruda-timing/eruda-timing.js`, add: () => eruda.add(erudaTiming) },
    { src: `${BASE}eruda-features/eruda-features.js`, add: () => eruda.add(erudaFeatures) },
    { src: `${BASE}eruda-orientation/eruda-orientation.js`, add: () => eruda.add(erudaOrientation) },
    { src: `${BASE}eruda-touches/eruda-touches.js`, add: () => eruda.add(erudaTouches) },
  ];

  // ===== helpers =====
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

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.onload = resolve;
      s.onerror = () => reject(new Error("Failed to load: " + src));
      document.body.appendChild(s);
    });
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
    del(k) {
      localStorage.removeItem(k);
    }
  };

  // ===== UI/CSS =====
  const CSS = `
  /* Eruda dock ниже, панель управления выше */
  #__erudaDock {
    position: fixed;
    z-index: 2147483645; /* ниже контролов */
    display: none;       /* скрыта до нажатия ⚙ */
    background: transparent;
  }
  #__erudaDock.__bottom { left:0; right:0; bottom:0; }
  #__erudaDock.__top    { left:0; right:0; top:0; }
  #__erudaDock.__left   { left:0; top:0; bottom:0; }
  #__erudaDock.__right  { right:0; top:0; bottom:0; }

  /* Drag-ручка ресайза (только по границе) */
  #__erudaResizeHandle {
    position: absolute;
    z-index: 2147483646;
    background: rgba(0,0,0,.16);
    touch-action: none;
    user-select: none;
  }
  #__erudaResizeHandle::after{
    content:'';
    position:absolute;
    left:50%; top:50%;
    transform: translate(-50%,-50%);
    opacity:.95;
    border-radius: 999px;
    background: rgba(255,255,255,.65);
  }

  #__erudaDock.__bottom #__erudaResizeHandle { left:0; right:0; top:0; height:12px; }
  #__erudaDock.__bottom #__erudaResizeHandle::after { width:44px; height:4px; }

  #__erudaDock.__top #__erudaResizeHandle { left:0; right:0; bottom:0; height:12px; }
  #__erudaDock.__top #__erudaResizeHandle::after { width:44px; height:4px; }

  #__erudaDock.__left #__erudaResizeHandle { top:0; bottom:0; right:0; width:12px; }
  #__erudaDock.__left #__erudaResizeHandle::after { width:4px; height:44px; }

  #__erudaDock.__right #__erudaResizeHandle { top:0; bottom:0; left:0; width:12px; }
  #__erudaDock.__right #__erudaResizeHandle::after { width:4px; height:44px; }

  /* Кнопка-шестерёнка */
  #__erudaGear {
    position: fixed;
    z-index: 2147483647;
    right: 12px;
    bottom: 12px;
    width: 44px;
    height: 44px;
    border-radius: 999px;
    border: 1px solid rgba(0,0,0,.25);
    background: rgba(255,255,255,.92);
    font-size: 20px;
    line-height: 44px;
    text-align:center;
    color:#111;
    -webkit-tap-highlight-color: transparent;
    pointer-events: auto;
  }
  #__erudaGear:active { transform: translateY(1px); }

  /* Панель управления доком */
  #__erudaDockBar {
    position: fixed;
    z-index: 2147483647;
    right: 12px;
    bottom: 62px;
    display: none;
    gap: 8px;
    padding: 10px;
    border-radius: 12px;
    background: rgba(255,255,255,.82);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    font: 12px/1.2 -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Arial, sans-serif;
    color: #111;
    width: 270px;
    box-sizing: border-box;
    pointer-events: auto;
  }
  #__erudaDockBar.__open { display: grid; }

  #__erudaDockBtns { display:flex; gap:6px; }
  #__erudaDockBtns button {
    flex: 1;
    padding: 6px 8px;
    border-radius: 10px;
    border: 1px solid rgba(0,0,0,.25);
    background: rgba(255,255,255,.92);
    color:#111;
    pointer-events: auto;
  }

  #__erudaSizeRow { display:grid; gap:4px; }
  #__erudaSizeLabel { opacity: .85; }
  #__erudaSize {
    width: 100%;
    pointer-events: auto;
    touch-action: pan-x;
  }
  `;

  onReady(async () => {
    injectStyle(CSS);

    // --- DOM ---
    const dock = el("div", { id: "__erudaDock" }, document.body);
    const resizeHandle = el("div", { id: "__erudaResizeHandle", title: "Drag to resize" }, dock);

    const gear = el("button", { id: "__erudaGear", text: "⚙", title: "Toggle eruda" }, document.body);

    const bar = el("div", { id: "__erudaDockBar" }, document.body);
    const btns = el("div", { id: "__erudaDockBtns" }, bar);

    const sizeRow = el("div", { id: "__erudaSizeRow" }, bar);
    const sizeLabel = el("div", { id: "__erudaSizeLabel", text: "Size: —" }, sizeRow);
    const sizeInput = el("input", {
      id: "__erudaSize",
      type: "range",
      min: "20",
      max: "90",
      step: "1",
      value: "45"
    }, sizeRow);

    // --- state ---
    const positions = ["top", "bottom", "left", "right"];

    let open = LS.get("eruda-open", "false") === "true";

    let pos = LS.get("eruda-dock-pos", "bottom");
    if (!positions.includes(pos)) pos = "bottom";

    let sizeV = Number(LS.get("eruda-dock-size-v", "45")); // vh
    let sizeH = Number(LS.get("eruda-dock-size-h", "55")); // vw

    function bringControlsToFront() {
      // на случай, если Eruda добавит свои слои позже
      document.body.appendChild(bar);
      document.body.appendChild(gear);
    }

    function applyDock() {
      dock.classList.remove("__top", "__bottom", "__left", "__right");
      dock.classList.add("__" + pos);

      dock.style.width = "";
      dock.style.height = "";

      if (pos === "top" || pos === "bottom") {
        sizeV = clamp(sizeV, 20, 90);
        dock.style.height = sizeV + "vh";
        dock.style.width = "100%";
        sizeInput.value = String(sizeV);
        sizeLabel.textContent = `Size: ${sizeV}vh (height)`;
      } else {
        sizeH = clamp(sizeH, 20, 90);
        dock.style.width = sizeH + "vw";
        dock.style.height = "100%";
        sizeInput.value = String(sizeH);
        sizeLabel.textContent = `Size: ${sizeH}vw (width)`;
      }

      // controls всегда поверх
      bringControlsToFront();
    }

    function setPos(newPos) {
      pos = newPos;
      LS.set("eruda-dock-pos", pos);
      applyDock();
    }

    // --- dock buttons ---
    [
      { p: "top", t: "Top" },
      { p: "bottom", t: "Bottom" },
      { p: "left", t: "Left" },
      { p: "right", t: "Right" },
    ].forEach(({ p, t }) => {
      el("button", { text: t, onclick: () => setPos(p) }, btns);
    });

    // --- slider size (input + change на всякий случай) ---
    function onSizeChange() {
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
    sizeInput.addEventListener("input", onSizeChange);
    sizeInput.addEventListener("change", onSizeChange);

    // --- drag resize handle ---
    let drag = null;

    resizeHandle.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      resizeHandle.setPointerCapture(e.pointerId);
      drag = {
        x: e.clientX,
        y: e.clientY,
        sizeV,
        sizeH
      };
    });

    resizeHandle.addEventListener("pointermove", (e) => {
      if (!drag) return;

      const vw = Math.max(1, window.innerWidth);
      const vh = Math.max(1, window.innerHeight);

      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;

      if (pos === "bottom") {
        // тянем вверх => больше
        sizeV = clamp(drag.sizeV + (-dy / vh) * 100, 20, 90);
        LS.set("eruda-dock-size-v", sizeV);
      } else if (pos === "top") {
        // тянем вниз => больше
        sizeV = clamp(drag.sizeV + (dy / vh) * 100, 20, 90);
        LS.set("eruda-dock-size-v", sizeV);
      } else if (pos === "left") {
        // тянем вправо => шире
        sizeH = clamp(drag.sizeH + (dx / vw) * 100, 20, 90);
        LS.set("eruda-dock-size-h", sizeH);
      } else if (pos === "right") {
        // тянем влево => шире
        sizeH = clamp(drag.sizeH + (-dx / vw) * 100, 20, 90);
        LS.set("eruda-dock-size-h", sizeH);
      }

      applyDock();
    });

    function endDrag() { drag = null; }
    resizeHandle.addEventListener("pointerup", endDrag);
    resizeHandle.addEventListener("pointercancel", endDrag);

    // ====== Eruda init: лениво при первом открытии ======
    let erudaInitPromise = null;

    async function initErudaIfNeeded() {
      if (erudaInitPromise) return erudaInitPromise;

      erudaInitPromise = (async () => {
        // контейнер должен быть видимым и с размерами ДО init
        dock.style.display = "block";
        applyDock();

        await loadScript(CORE_SRC);

        eruda.init({
          container: dock,
          inline: true,       // Eruda внутри контейнера; entry button не нужен (у нас ⚙)
          autoScale: true,
          useShadowDom: true,
          defaults: { transparency: 0.95, displaySize: 100 }
        });

        for (const p of PLUGINS) {
          await loadScript(p.src);
          p.add();
        }

        bringControlsToFront();

        window.__erudaDock = { dock, bar, gear, setPos, applyDock, eruda };
      })().catch((e) => {
        console.error("[eruda dock] init failed:", e);
        erudaInitPromise = null;
        throw e;
      });

      return erudaInitPromise;
    }

    function renderOpenState() {
      if (open) {
        dock.style.display = "block";
        bar.classList.add("__open");
        applyDock();
      } else {
        dock.style.display = "none";
        bar.classList.remove("__open");
      }
      LS.set("eruda-open", open);
      bringControlsToFront();
    }

    // ⚙ toggle
    gear.addEventListener("click", async () => {
      open = !open;
      if (open) await initErudaIfNeeded();
      renderOpenState();
    });

    // initial
    applyDock();

    if (open) {
      await initErudaIfNeeded();
    }
    renderOpenState();
  });
})();