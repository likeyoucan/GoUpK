(function () {
  if (window.__erudaDockLoaded) return;
  window.__erudaDockLoaded = true;

  // ====== ВКЛ/ВЫКЛ (как раньше) ======
  // включение: ?eruda=true  ИЛИ localStorage.active-eruda = 'true'
  const enabled =
    /(^|[?&])eruda=true(&|$)/.test(location.search) ||
    localStorage.getItem("active-eruda") === "true";
  if (!enabled) return;

  // CDN. Если хотите локально (для APK оффлайн) — положите файлы в www/vendor/eruda/
  // и поменяйте BASE на "vendor/eruda/" + имена файлов ниже.
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
  };

  // ===== CSS =====
  const CSS = `
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
  }
  #__erudaGear:active { transform: translateY(1px); }

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
    width: 290px;
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
    color:#111;
  }

  #__erudaSizeRow { display:grid; gap:4px; }
  #__erudaSizeLabel { opacity: .85; }
  #__erudaSize { width: 100%; touch-action: pan-x; }

  /* Dock, внутри него mount (куда рендерится Eruda) + ручка ресайза */
  #__erudaDock {
    position: fixed;
    z-index: 2147483645;
    display: none;            /* скрыто пока не открыли */
    background: transparent;
  }
  #__erudaMount {
    position: absolute;
    inset: 0;
  }

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
  `;

  onReady(async () => {
    injectStyle(CSS);

    // --- DOM ---
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
      value: "45",
    }, sizeRow);

    const dock = el("div", { id: "__erudaDock" }, document.body);
    const mount = el("div", { id: "__erudaMount" }, dock);
    const resizeHandle = el("div", { id: "__erudaResizeHandle", title: "Drag to resize" }, dock);

    function bringControlsToFront() {
      document.body.appendChild(bar);
      document.body.appendChild(gear);
    }

    // --- state ---
    let open = LS.get("eruda-open", "false") === "true";

    const positions = ["top", "bottom", "left", "right"];
    let pos = LS.get("eruda-dock-pos", "bottom");
    if (!positions.includes(pos)) pos = "bottom";

    let sizeV = Number(LS.get("eruda-dock-size-v", "45")); // vh
    let sizeH = Number(LS.get("eruda-dock-size-h", "55")); // vw

    function applyDock() {
      dock.classList.remove("__top", "__bottom", "__left", "__right");
      dock.classList.add("__" + pos);

      // сброс геометрии
      dock.style.top = "";
      dock.style.right = "";
      dock.style.bottom = "";
      dock.style.left = "";
      dock.style.width = "";
      dock.style.height = "";

      if (pos === "bottom") {
        sizeV = clamp(sizeV, 20, 90);
        dock.style.left = "0";
        dock.style.right = "0";
        dock.style.bottom = "0";
        dock.style.height = sizeV + "vh";
        sizeInput.value = String(sizeV);
        sizeLabel.textContent = `Size: ${sizeV}vh (height)`;
      } else if (pos === "top") {
        sizeV = clamp(sizeV, 20, 90);
        dock.style.left = "0";
        dock.style.right = "0";
        dock.style.top = "0";
        dock.style.height = sizeV + "vh";
        sizeInput.value = String(sizeV);
        sizeLabel.textContent = `Size: ${sizeV}vh (height)`;
      } else if (pos === "left") {
        sizeH = clamp(sizeH, 20, 90);
        dock.style.left = "0";
        dock.style.top = "0";
        dock.style.bottom = "0";
        dock.style.width = sizeH + "vw";
        sizeInput.value = String(sizeH);
        sizeLabel.textContent = `Size: ${sizeH}vw (width)`;
      } else if (pos === "right") {
        sizeH = clamp(sizeH, 20, 90);
        dock.style.right = "0";
        dock.style.top = "0";
        dock.style.bottom = "0";
        dock.style.width = sizeH + "vw";
        sizeInput.value = String(sizeH);
        sizeLabel.textContent = `Size: ${sizeH}vw (width)`;
      }

      bringControlsToFront();
    }

    function setPos(newPos) {
      pos = newPos;
      LS.set("eruda-dock-pos", pos);
      applyDock();
    }

    // кнопки дока
    [
      { p: "top", t: "Top" },
      { p: "bottom", t: "Bottom" },
      { p: "left", t: "Left" },
      { p: "right", t: "Right" },
    ].forEach(({ p, t }) => {
      el("button", { text: t, onclick: () => setPos(p) }, btns);
    });

    // ползунок
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

    // drag-ресайз ручкой
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

      if (pos === "bottom") {
        sizeV = clamp(drag.sizeV + (-dy / vh) * 100, 20, 90);
        LS.set("eruda-dock-size-v", sizeV);
      } else if (pos === "top") {
        sizeV = clamp(drag.sizeV + (dy / vh) * 100, 20, 90);
        LS.set("eruda-dock-size-v", sizeV);
      } else if (pos === "left") {
        sizeH = clamp(drag.sizeH + (dx / vw) * 100, 20, 90);
        LS.set("eruda-dock-size-h", sizeH);
      } else if (pos === "right") {
        sizeH = clamp(drag.sizeH + (-dx / vw) * 100, 20, 90);
        LS.set("eruda-dock-size-h", sizeH);
      }

      applyDock();
    });

    function endDrag() { drag = null; }
    resizeHandle.addEventListener("pointerup", endDrag);
    resizeHandle.addEventListener("pointercancel", endDrag);

    // ====== загрузка скриптов один раз ======
    let scriptsLoaded = false;
    async function ensureScripts() {
      if (scriptsLoaded) return;

      await loadScript(CORE_SRC);
      for (const src of PLUGINS) await loadScript(src);

      scriptsLoaded = true;
    }

    // ====== open/close через destroy/init ======
    async function openEruda() {
      dock.style.display = "block";
      bar.classList.add("__open");
      applyDock();

      await ensureScripts();

      // на всякий случай: если где-то уже была Eruda
      try { window.eruda?.destroy?.(); } catch (_) {}

      // по API: inline=true рендерит в container, entry button убирается <!--citation:1-->
      eruda.init({
        container: mount,
        inline: true,
        autoScale: true,
        useShadowDom: true,
        defaults: { transparency: 0.95, displaySize: 100 }
      });

      // плагины: add после того, как eruda и их скрипты загружены
      if (window.erudaDom) eruda.add(erudaDom);
      if (window.erudaMonitor) eruda.add(erudaMonitor);
      if (window.erudaTiming) eruda.add(erudaTiming);
      if (window.erudaFeatures) eruda.add(erudaFeatures);
      if (window.erudaOrientation) eruda.add(erudaOrientation);
      if (window.erudaTouches) eruda.add(erudaTouches);

      bringControlsToFront();
    }

    function closeEruda() {
      bar.classList.remove("__open");
      dock.style.display = "none";
      bringControlsToFront();

      // по API: destroy удаляет Eruda, после него можно снова init <!--citation:1-->
      try { window.eruda?.destroy?.(); } catch (e) { /* ignore */ }
    }

    async function render() {
      if (open) await openEruda();
      else closeEruda();

      LS.set("eruda-open", open);
    }

    gear.addEventListener("click", async () => {
      open = !open;
      await render();
    });

    // initial
    applyDock();
    await render();

    // на случай поворота экрана (чтобы % пересчитались корректно)
    window.addEventListener("resize", () => {
      if (!open) return;
      applyDock();
    });

    // для ручной диагностики из консоли
    window.__erudaDock = { open: () => { open = true; return render(); }, close: () => { open = false; return render(); }, setPos };
  });
})();