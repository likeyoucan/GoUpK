(function () {
  if (window.__erudaDockLoaded) return;
  window.__erudaDockLoaded = true;

  // ===== ВКЛ/ВЫКЛ режим отладки =====
  const enabled =
    /(^|[?&])eruda=true(&|$)/.test(location.search) ||
    localStorage.getItem("active-eruda") === "true";
  if (!enabled) return;

  // Если в APK нет интернета — скачайте эти файлы в www и поменяйте BASE на локальный путь.
  // Например: const BASE = "vendor/"; и ниже пути вида `${BASE}eruda.js`, `${BASE}eruda-dom.js` и т.д.
  const BASE = "https://cdn.jsdelivr.net/npm/";

  const PLUGINS = [
    { src: `${BASE}eruda-dom/eruda-dom.js`, add: () => eruda.add(erudaDom) },
    {
      src: `${BASE}eruda-monitor/eruda-monitor.js`,
      add: () => eruda.add(erudaMonitor),
    },
    {
      src: `${BASE}eruda-timing/eruda-timing.js`,
      add: () => eruda.add(erudaTiming),
    },
    {
      src: `${BASE}eruda-features/eruda-features.js`,
      add: () => eruda.add(erudaFeatures),
    },
    {
      src: `${BASE}eruda-orientation/eruda-orientation.js`,
      add: () => eruda.add(erudaOrientation),
    },
    {
      src: `${BASE}eruda-touches/eruda-touches.js`,
      add: () => eruda.add(erudaTouches),
    },
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
        else if (k.startsWith("on") && typeof v === "function")
          n.addEventListener(k.slice(2), v);
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

  // ===== UI/CSS =====
  const CSS = `
  #__erudaDock {
    position: fixed;
    z-index: 2147483647;
    display: none; /* закрыто до нажатия на шестерёнку */
    background: transparent;
  }
  #__erudaDock.__bottom { left:0; right:0; bottom:0; }
  #__erudaDock.__top    { left:0; right:0; top:0; }
  #__erudaDock.__left   { left:0; top:0; bottom:0; }
  #__erudaDock.__right  { right:0; top:0; bottom:0; }

  /* Drag-ручка ресайза (лежит поверх Eruda по границе) */
  #__erudaResizeHandle {
    position: absolute;
    z-index: 2147483647;
    background: rgba(0,0,0,.18);
    touch-action: none;
    user-select: none;
  }
  #__erudaResizeHandle::after{
    content:'';
    position:absolute;
    left:50%; top:50%;
    transform: translate(-50%,-50%);
    opacity:.9;
    border-radius: 999px;
    background: rgba(255,255,255,.65);
  }

  /* bottom: ручка сверху */
  #__erudaDock.__bottom #__erudaResizeHandle { left:0; right:0; top:0; height:12px; }
  #__erudaDock.__bottom #__erudaResizeHandle::after { width:44px; height:4px; }

  /* top: ручка снизу */
  #__erudaDock.__top #__erudaResizeHandle { left:0; right:0; bottom:0; height:12px; }
  #__erudaDock.__top #__erudaResizeHandle::after { width:44px; height:4px; }

  /* left: ручка справа */
  #__erudaDock.__left #__erudaResizeHandle { top:0; bottom:0; right:0; width:12px; }
  #__erudaDock.__left #__erudaResizeHandle::after { width:4px; height:44px; }

  /* right: ручка слева */
  #__erudaDock.__right #__erudaResizeHandle { top:0; bottom:0; left:0; width:12px; }
  #__erudaDock.__right #__erudaResizeHandle::after { width:4px; height:44px; }

  /* Кнопка-шестерёнка (вход как раньше) */
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
    -webkit-tap-highlight-color: transparent;
  }
  #__erudaGear:active { transform: translateY(1px); }

  /* Панель управления доком (появляется, когда Eruda открыта) */
  #__erudaDockBar {
    position: fixed;
    z-index: 2147483647;
    right: 12px;
    bottom: 62px;
    display: none; /* видно только когда open */
    gap: 6px;
    padding: 8px;
    border-radius: 12px;
    background: rgba(255,255,255,.80);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    font: 12px/1.2 -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Arial, sans-serif;
    color: #111;
    width: 260px;
    box-sizing: border-box;
  }
  #__erudaDockBar.__open { display: grid; }

  #__erudaDockBtns { display:flex; gap:6px; }
  #__erudaDockBtns button {
    flex: 1;
    padding: 6px 8px;
    border-radius: 10px;
    border: 1px solid rgba(0,0,0,.25);
    background: rgba(255,255,255,.92);
  }

  #__erudaSizeRow { display:grid; gap:4px; }
  #__erudaSizeLabel { opacity: .85; }
  #__erudaSize { width: 100%; }
  `;

  onReady(async () => {
    injectStyle(CSS);

    // элементы
    const dock = el("div", { id: "__erudaDock" }, document.body);
    const resizeHandle = el(
      "div",
      { id: "__erudaResizeHandle", title: "Drag to resize" },
      dock,
    );

    const gear = el("button", { id: "__erudaGear", text: "⚙" }, document.body);

    const bar = el("div", { id: "__erudaDockBar" }, document.body);
    const btns = el("div", { id: "__erudaDockBtns" }, bar);

    const sizeRow = el("div", { id: "__erudaSizeRow" }, bar);
    const sizeLabel = el(
      "div",
      { id: "__erudaSizeLabel", text: "Size: —" },
      sizeRow,
    );
    const sizeInput = el(
      "input",
      {
        id: "__erudaSize",
        type: "range",
        min: "20",
        max: "90",
        step: "1",
        value: "45",
      },
      sizeRow,
    );

    const positions = ["top", "bottom", "left", "right"];

    // состояние (сохраняем в localStorage)
    let open = localStorage.getItem("eruda-open") === "true";

    let pos = localStorage.getItem("eruda-dock-pos");
    if (!positions.includes(pos)) pos = "bottom";

    // размеры в % экрана
    let sizeV = Number(localStorage.getItem("eruda-dock-size-v")) || 45; // vh для top/bottom
    let sizeH = Number(localStorage.getItem("eruda-dock-size-h")) || 55; // vw для left/right

    function applyDock() {
      dock.classList.remove("__top", "__bottom", "__left", "__right");
      dock.classList.add("__" + pos);

      dock.style.width = "";
      dock.style.height = "";

      if (pos === "top" || pos === "bottom") {
        dock.style.height = clamp(sizeV, 20, 90) + "vh";
        dock.style.width = "100%";
        sizeInput.value = String(clamp(sizeV, 20, 90));
        sizeLabel.textContent = `Size: ${clamp(sizeV, 20, 90)}vh (height)`;
      } else {
        dock.style.width = clamp(sizeH, 20, 90) + "vw";
        dock.style.height = "100%";
        sizeInput.value = String(clamp(sizeH, 20, 90));
        sizeLabel.textContent = `Size: ${clamp(sizeH, 20, 90)}vw (width)`;
      }
    }

    function setPos(newPos) {
      pos = newPos;
      localStorage.setItem("eruda-dock-pos", pos);
      applyDock();
    }

    // кнопки дока
    const btnMeta = [
      { p: "top", t: "Top" },
      { p: "bottom", t: "Bottom" },
      { p: "left", t: "Left" },
      { p: "right", t: "Right" },
    ];
    btnMeta.forEach(({ p, t }) => {
      el("button", { text: t, onclick: () => setPos(p) }, btns);
    });

    // ползунок размера
    sizeInput.addEventListener("input", () => {
      const val = Number(sizeInput.value);
      if (pos === "top" || pos === "bottom") {
        sizeV = val;
        localStorage.setItem("eruda-dock-size-v", String(sizeV));
      } else {
        sizeH = val;
        localStorage.setItem("eruda-dock-size-h", String(sizeH));
      }
      applyDock();
    });

    // drag-ресайз
    let drag = null;
    resizeHandle.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      resizeHandle.setPointerCapture(e.pointerId);
      drag = {
        x: e.clientX,
        y: e.clientY,
        sizeV,
        sizeH,
      };
    });

    resizeHandle.addEventListener("pointermove", (e) => {
      if (!drag) return;

      const vw = Math.max(1, window.innerWidth);
      const vh = Math.max(1, window.innerHeight);

      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;

      if (pos === "bottom") {
        // ручка сверху: тянем вверх => размер больше
        sizeV = clamp(drag.sizeV + (-dy / vh) * 100, 20, 90);
        localStorage.setItem("eruda-dock-size-v", String(sizeV));
      } else if (pos === "top") {
        // ручка снизу: тянем вниз => размер больше
        sizeV = clamp(drag.sizeV + (dy / vh) * 100, 20, 90);
        localStorage.setItem("eruda-dock-size-v", String(sizeV));
      } else if (pos === "left") {
        // ручка справа: тянем вправо => шире
        sizeH = clamp(drag.sizeH + (dx / vw) * 100, 20, 90);
        localStorage.setItem("eruda-dock-size-h", String(sizeH));
      } else if (pos === "right") {
        // ручка слева: тянем влево => шире
        sizeH = clamp(drag.sizeH + (-dx / vw) * 100, 20, 90);
        localStorage.setItem("eruda-dock-size-h", String(sizeH));
      }

      applyDock();
    });

    function endDrag() {
      drag = null;
    }
    resizeHandle.addEventListener("pointerup", endDrag);
    resizeHandle.addEventListener("pointercancel", endDrag);

    // ===== Eruda init (лениво, при первом открытии) =====
    let erudaInitPromise = null;

    async function initErudaIfNeeded() {
      if (erudaInitPromise) return erudaInitPromise;

      erudaInitPromise = (async () => {
        // показываем док ДО init, чтобы Eruda корректно измерила размеры
        dock.style.display = "block";
        applyDock();

        await loadScript(`${BASE}eruda`);
        eruda.init({
          container: dock,
          inline: true, // entry button Eruda удаляется в inline-режиме <!--citation:1-->
          autoScale: true,
          useShadowDom: true,
          defaults: { transparency: 0.95, displaySize: 100 },
        });

        for (const p of PLUGINS) {
          await loadScript(p.src);
          p.add();
        }

        // чтобы снаружи можно было управлять
        window.__erudaDock = { setPos, applyDock, dock, bar, gear, eruda };
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
      localStorage.setItem("eruda-open", String(open));
    }

    // шестерёнка: открыть/закрыть
    gear.addEventListener("click", async () => {
      open = !open;
      if (open) await initErudaIfNeeded();
      renderOpenState();
    });

    // стартовое состояние
    applyDock();
    if (open) {
      await initErudaIfNeeded();
    }
    renderOpenState();
  });
})();
