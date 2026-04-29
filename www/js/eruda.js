(function () {
  if (window.__erudaDockLoaded) return;
  window.__erudaDockLoaded = true;

  // 1. ПРОВЕРКА АКТИВАЦИИ
  const isEnabled = () =>
    /(^|[?&])eruda=true(&|$)/.test(location.search) ||
    localStorage.getItem("active-eruda") === "true";

  // Секретный триггер (10 кликов по элементу с id="debug-trigger")
  let taps = 0,
    timer;
  window.addEventListener("click", (e) => {
    if (e.target.id === "debug-trigger") {
      taps++;
      clearTimeout(timer);
      timer = setTimeout(() => (taps = 0), 5000);
      if (taps >= 10) {
        localStorage.setItem("active-eruda", "true");
        location.reload();
      }
    }
  });

  if (!isEnabled()) return;

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

  const LS = {
    get: (k, d) => localStorage.getItem(k) ?? d,
    set: (k, v) => localStorage.setItem(k, String(v)),
  };

  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

  const CSS = `
  #__erudaGear, #__erudaBarToggle, #__erudaDockBar { z-index: 2147483647 !important; font-family: sans-serif; }
  #__erudaGear { position:fixed; right:12px; bottom:12px; width:44px; height:44px; border-radius:50%; border:1px solid #ccc; background:white; font-size:20px; line-height:44px; text-align:center; cursor:pointer; }
  #__erudaBarToggle { position:fixed; right:64px; bottom:12px; width:44px; height:44px; border-radius:12px; border:1px solid #ccc; background:white; font-size:12px; font-weight:bold; line-height:44px; text-align:center; display:none; cursor:pointer; }
  
  #__erudaDockBar {
    position:fixed; right:12px; bottom:62px; display:none; gap:8px; padding:10px; width:280px;
    border-radius:12px; background:rgba(255,255,255,0.95); box-shadow: 0 4px 15px rgba(0,0,0,0.2);
  }
  #__erudaDockBar.__open { display:grid; }
  #__erudaDockBar.__hidden { display:none !important; }

  #__erudaDockBtns { display:flex; gap:6px; }
  #__erudaDockBtns button { flex:1; padding:6px; border-radius:8px; border:1px solid #ccc; background:#eee; font-size:10px; font-weight:bold; }
  #__erudaDockBtns button.__active { background:#fe5e00; color:white; border-color:#fe5e00; }

  #__erudaSizeRow { display:grid; gap:4px; font-size:11px; }
  #__erudaSize { width:100%; accent-color:#fe5e00; }

  #__erudaDock { position:fixed; z-index:2147483640; display:none; background:black; overflow:hidden !important; }
  #__erudaDock.__bottom { left:0; right:0; bottom:0; }
  #__erudaDock.__top { left:0; right:0; top:0; }
  #__erudaDock.__left { left:0; top:0; bottom:0; }
  #__erudaDock.__right { right:0; top:0; bottom:0; }

  #__erudaMount { position:absolute; inset:0; }
  #__erudaResizeHandle { position:absolute; z-index:2147483646; background:rgba(255,255,255,0.1); touch-action:none; }
  #__erudaResizeHandle::after { content:''; position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); background:#666; border-radius:4px; }
  #__erudaDock.__bottom #__erudaResizeHandle { top:0; left:0; right:0; height:15px; cursor:ns-resize; }
  #__erudaDock.__bottom #__erudaResizeHandle::after { width:40px; height:4px; }
  #__erudaDock.__top #__erudaResizeHandle { bottom:0; left:0; right:0; height:15px; cursor:ns-resize; }
  #__erudaDock.__left #__erudaResizeHandle { right:0; top:0; bottom:0; width:15px; cursor:ew-resize; }
  #__erudaDock.__right #__erudaResizeHandle { left:0; top:0; bottom:0; width:15px; cursor:ew-resize; }

  .eruda-container, .eruda-dev-tools { width:100% !important; height:100% !important; min-width:0 !important; min-height:0 !important; }
  `;

  function setup() {
    const style = document.createElement("style");
    style.innerHTML = CSS;
    document.head.appendChild(style);

    const gear = document.createElement("button");
    gear.id = "__erudaGear";
    gear.innerText = "⚙";
    document.body.appendChild(gear);
    const barToggle = document.createElement("button");
    barToggle.id = "__erudaBarToggle";
    barToggle.innerText = "UI";
    document.body.appendChild(barToggle);
    const bar = document.createElement("div");
    bar.id = "__erudaDockBar";
    document.body.appendChild(bar);
    const btns = document.createElement("div");
    btns.id = "__erudaDockBtns";
    bar.appendChild(btns);
    const sizeRow = document.createElement("div");
    sizeRow.id = "__erudaSizeRow";
    bar.appendChild(sizeRow);
    const sizeLabel = document.createElement("div");
    sizeLabel.innerText = "Размер: --";
    sizeRow.appendChild(sizeLabel);
    const sizeInput = document.createElement("input");
    sizeInput.id = "__erudaSize";
    sizeInput.type = "range";
    sizeInput.min = "5";
    sizeInput.max = "95";
    sizeRow.appendChild(sizeInput);
    const dock = document.createElement("div");
    dock.id = "__erudaDock";
    document.body.appendChild(dock);
    const mount = document.createElement("div");
    mount.id = "__erudaMount";
    dock.appendChild(mount);
    const resizeHandle = document.createElement("div");
    resizeHandle.id = "__erudaResizeHandle";
    dock.appendChild(resizeHandle);

    let open = LS.get("eruda-open", "false") === "true";
    let uiVisible = LS.get("eruda-ui", "true") === "true";
    let pos = LS.get("eruda-pos", "bottom");
    let sizeV = Number(LS.get("eruda-sv", "45"));
    let sizeH = Number(LS.get("eruda-sh", "55"));

    function applyDock() {
      dock.className =
        pos === "bottom"
          ? "__bottom"
          : pos === "top"
            ? "__top"
            : pos === "left"
              ? "__left"
              : "__right";
      dock.style.top =
        dock.style.right =
        dock.style.bottom =
        dock.style.left =
          "";

      const isH = pos === "top" || pos === "bottom";
      if (isH) {
        dock.style.left = dock.style.right = "0";
        dock.style[pos] = "0";
        dock.style.height = sizeV + "vh";
        dock.style.width = "100vw";
        sizeInput.value = sizeV;
        sizeLabel.innerText = `Высота: ${sizeV}vh`;
      } else {
        dock.style.top = dock.style.bottom = "0";
        dock.style[pos] = "0";
        dock.style.width = sizeH + "vw";
        dock.style.height = "100vh";
        sizeInput.value = sizeH;
        sizeLabel.innerText = `Ширина: ${sizeH}vw`;
      }

      btns
        .querySelectorAll("button")
        .forEach((b) => (b.className = b.dataset.p === pos ? "__active" : ""));

      // ФИКС ПУСТОГО ЭКРАНА: Сообщаем Eruda об изменении размеров
      if (window.eruda && open) {
        setTimeout(() => {
          window.dispatchEvent(new Event("resize"));
        }, 50);
      }
    }

    function toggleUI() {
      if (uiVisible) {
        bar.classList.remove("__hidden");
        barToggle.style.background = "white";
      } else {
        bar.classList.add("__hidden");
        barToggle.style.background = "#ccc";
      }
      LS.set("eruda-ui", uiVisible);
    }

    barToggle.onclick = () => {
      uiVisible = !uiVisible;
      toggleUI();
    };

    ["top", "bottom", "left", "right"].forEach((p) => {
      const b = document.createElement("button");
      b.innerText = p.toUpperCase();
      b.dataset.p = p;
      b.onclick = () => {
        pos = p;
        LS.set("eruda-pos", p);
        applyDock();
      };
      btns.appendChild(b);
    });

    sizeInput.oninput = () => {
      if (pos === "top" || pos === "bottom") sizeV = sizeInput.value;
      else sizeH = sizeInput.value;
      applyDock();
    };
    sizeInput.onchange = () => {
      LS.set("eruda-sv", sizeV);
      LS.set("eruda-sh", sizeH);
    };

    // Ресайз
    let drag = null;
    resizeHandle.onpointerdown = (e) => {
      e.preventDefault();
      resizeHandle.setPointerCapture(e.pointerId);
      drag = { x: e.clientX, y: e.clientY, sv: sizeV, sh: sizeH };
    };
    resizeHandle.onpointermove = (e) => {
      if (!drag) return;
      const dx = ((e.clientX - drag.x) / window.innerWidth) * 100;
      const dy = ((e.clientY - drag.y) / window.innerHeight) * 100;
      if (pos === "bottom") sizeV = clamp(drag.sv - dy, 5, 95);
      if (pos === "top") sizeV = clamp(drag.sv + dy, 5, 95);
      if (pos === "left") sizeH = clamp(drag.sh + dx, 5, 95);
      if (pos === "right") sizeH = clamp(drag.sh - dx, 5, 95);
      applyDock();
    };
    resizeHandle.onpointerup = () => {
      drag = null;
      LS.set("eruda-sv", sizeV);
      LS.set("eruda-sh", sizeH);
    };

    const loadScript = (src) =>
      new Promise((res) => {
        const s = document.createElement("script");
        s.src = src;
        s.onload = res;
        document.body.appendChild(s);
      });

    async function doOpen() {
      dock.style.display = "block";
      bar.classList.add("__open");
      barToggle.style.display = "block";
      toggleUI();
      applyDock();

      if (!window.eruda) {
        await loadScript(CORE_SRC);
        for (const s of PLUGINS) await loadScript(s);
        eruda.init({
          container: mount,
          inline: true,
          useShadowDom: false,
          defaults: { displaySize: 100 },
        });
        if (window.erudaDom) eruda.add(erudaDom);
        if (window.erudaMonitor) eruda.add(erudaMonitor);
        if (window.erudaTiming) eruda.add(erudaTiming);
        if (window.erudaFeatures) eruda.add(erudaFeatures);
        if (window.erudaOrientation) eruda.add(erudaOrientation);
        if (window.erudaTouches) eruda.add(erudaTouches);
      }
      eruda.show();
      // Повторный вызов ресайза после инициализации
      setTimeout(() => window.dispatchEvent(new Event("resize")), 100);
    }

    gear.onclick = async () => {
      open = !open;
      LS.set("eruda-open", open);
      if (open) await doOpen();
      else {
        dock.style.display = "none";
        bar.classList.remove("__open");
        barToggle.style.display = "none";
        if (window.eruda) eruda.hide();
      }
    };

    if (open) doOpen();
    else applyDock();
  }

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", setup);
  else setup();
})();
