(function () {
  if (window.__erudaDockLoaded) return;
  window.__erudaDockLoaded = true;

  const enabled =
    /(^|[?&])eruda=true(&|$)/.test(location.search) ||
    localStorage.getItem("active-eruda") === "true";
  if (!enabled) return;

  const BASE = "https://cdn.jsdelivr.net/npm/";

  const CORE_SRC = `${BASE}eruda`;
  const PLUGINS = [
    `${BASE}eruda-dom/eruda-dom.js`,
    `${BASE}eruda-monitor/eruda-monitor.js`,
    `${BASE}eruda-timing/eruda-timing.js`,
    `${BASE}eruda-features/eruda-features.js`,
    `${BASE}eruda-orientation/eruda-orientation.js`,
    `${BASE}eruda-touches/eruda-touches.js`,
  ];

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

  const LS = {
    get(k, d) {
      const v = localStorage.getItem(k);
      return v == null ? d : v;
    },
    set(k, v) {
      localStorage.setItem(k, String(v));
    },
  };

  const CSS = `
  /* controls always on top */
  #__erudaGear, #__erudaDockBar { z-index: 2147483647; }

  #__erudaGear{
    position:fixed; right:12px; bottom:12px;
    width:44px; height:44px; border-radius:999px;
    border:1px solid rgba(0,0,0,.25);
    background:rgba(255,255,255,.92);
    font-size:20px; line-height:44px; text-align:center;
    -webkit-tap-highlight-color: transparent;
  }

  #__erudaDockBar{
    position:fixed; right:12px; bottom:62px;
    display:none; gap:8px; padding:10px; width:290px;
    border-radius:12px;
    background:rgba(255,255,255,.82);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    font: 12px/1.2 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Arial,sans-serif;
    box-sizing:border-box;
  }
  #__erudaDockBar.__open{ display:grid; }

  #__erudaDockBtns{ display:flex; gap:6px; }
  #__erudaDockBtns button{
    flex:1; padding:6px 8px; border-radius:10px;
    border:1px solid rgba(0,0,0,.25);
    background:rgba(255,255,255,.92);
  }

  #__erudaSizeRow{ display:grid; gap:4px; }
  #__erudaSize{ width:100%; touch-action: pan-x; }
  #__erudaSizeLabel{ opacity:.85; }

  /* dock + mount */
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

  #__erudaMount{
    position:absolute; inset:0;
  }

  /* resize handle */
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

  /* IMPORTANT: force eruda to stay inside our mount (works only with useShadowDom:false) */
  #__erudaDock .eruda-dev-tools{
    position:absolute !important;
    inset:0 !important;
    height:100% !important;
    width:100% !important;
  }
  #__erudaDock .eruda-container{
    position:absolute !important;
    inset:0 !important;
  }
  `;

  onReady(async () => {
    injectStyle(CSS);

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
      { id: "__erudaSize", type: "range", min: "20", max: "90", step: "1" },
      sizeRow,
    );

    const dock = el("div", { id: "__erudaDock" }, document.body);
    const mount = el("div", { id: "__erudaMount" }, dock);
    const resizeHandle = el("div", { id: "__erudaResizeHandle" }, dock);

    function bringControlsToFront() {
      document.body.appendChild(bar);
      document.body.appendChild(gear);
    }

    let open = LS.get("eruda-open", "false") === "true";
    const positions = ["top", "bottom", "left", "right"];

    let pos = LS.get("eruda-dock-pos", "bottom");
    if (!positions.includes(pos)) pos = "bottom";

    let sizeV = Number(LS.get("eruda-dock-size-v", "45")); // vh
    let sizeH = Number(LS.get("eruda-dock-size-h", "55")); // vw

    function applyDock() {
      dock.classList.remove("__top", "__bottom", "__left", "__right");
      dock.classList.add("__" + pos);

      dock.style.top =
        dock.style.right =
        dock.style.bottom =
        dock.style.left =
          "";
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

      bringControlsToFront();
    }

    function setPos(p) {
      pos = p;
      LS.set("eruda-dock-pos", pos);
      applyDock();
    }

    [
      { p: "top", t: "Top" },
      { p: "bottom", t: "Bottom" },
      { p: "left", t: "Left" },
      { p: "right", t: "Right" },
    ].forEach(({ p, t }) =>
      el("button", { text: t, onclick: () => setPos(p) }, btns),
    );

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
      // если Eruda открыта — иногда полезно “пере-обновить” layout
      try {
        window.eruda?.scale?.(window.eruda?.scale?.() || 1);
      } catch (_) {}
    }
    sizeInput.addEventListener("input", onSize);
    sizeInput.addEventListener("change", onSize);

    // drag resize
    let drag = null;
    resizeHandle.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      resizeHandle.setPointerCapture(e.pointerId);
      drag = { x: e.clientX, y: e.clientY, sizeV, sizeH };
    });
    resizeHandle.addEventListener("pointermove", (e) => {
      if (!drag) return;
      const vw = Math.max(1, window.innerWidth);
      const vh = Math.max(1, window.innerHeight);
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;

      if (pos === "bottom")
        sizeV = clamp(drag.sizeV + (-dy / vh) * 100, 20, 90);
      if (pos === "top") sizeV = clamp(drag.sizeV + (dy / vh) * 100, 20, 90);
      if (pos === "left") sizeH = clamp(drag.sizeH + (dx / vw) * 100, 20, 90);
      if (pos === "right") sizeH = clamp(drag.sizeH + (-dx / vw) * 100, 20, 90);

      LS.set("eruda-dock-size-v", sizeV);
      LS.set("eruda-dock-size-h", sizeH);
      applyDock();
    });
    function endDrag() {
      drag = null;
    }
    resizeHandle.addEventListener("pointerup", endDrag);
    resizeHandle.addEventListener("pointercancel", endDrag);

    // load scripts once
    let scriptsLoaded = false;
    async function ensureScripts() {
      if (scriptsLoaded) return;
      await loadScript(CORE_SRC);
      for (const src of PLUGINS) await loadScript(src);
      scriptsLoaded = true;
    }

    let inited = false;
    async function initErudaOnce() {
      if (inited) return;
      await ensureScripts();

      // ВАЖНО: useShadowDom:false, чтобы наш CSS внутри #__erudaDock мог “прибить” position у eruda-элементов
      eruda.init({
        container: mount,
        inline: true,
        useShadowDom: false,
        autoScale: true,
        defaults: { transparency: 0.95, displaySize: 100 },
      });

      // плагины
      if (window.erudaDom) eruda.add(erudaDom);
      if (window.erudaMonitor) eruda.add(erudaMonitor);
      if (window.erudaTiming) eruda.add(erudaTiming);
      if (window.erudaFeatures) eruda.add(erudaFeatures);
      if (window.erudaOrientation) eruda.add(erudaOrientation);
      if (window.erudaTouches) eruda.add(erudaTouches);

      inited = true;
    }

    async function doOpen() {
      dock.style.display = "block";
      bar.classList.add("__open");
      applyDock();

      await initErudaOnce();

      // гарантированно показать
      try {
        eruda.show();
      } catch (_) {}
      bringControlsToFront();
    }

    function doClose() {
      bar.classList.remove("__open");
      dock.style.display = "none";
      bringControlsToFront();

      // даже если eruda вдруг “уехала” из контейнера — hide уберёт её (штатный API)
      try {
        eruda.hide();
      } catch (_) {}
    }

    gear.addEventListener("click", async () => {
      open = !open;
      LS.set("eruda-open", open);
      if (open) await doOpen();
      else doClose();
    });

    // initial
    applyDock();
    if (open) await doOpen();
    else doClose();

    // expose debug helpers
    window.__erudaDock = {
      dock,
      mount,
      bar,
      gear,
      setPos,
      open: doOpen,
      close: doClose,
    };
  });
})();
