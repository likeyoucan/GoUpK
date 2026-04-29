(function () {
  const enabled =
    /(^|[?&])eruda=true(&|$)/.test(location.search) ||
    localStorage.getItem("active-eruda") === "true";
  if (!enabled) return;

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

  const CSS = `
    #__erudaDock {
      position: fixed;
      z-index: 2147483647;
      background: transparent;
      /* размер будем задавать инлайном через JS (height/width) */
    }
    #__erudaDock.__bottom { left: 0; right: 0; bottom: 0; }
    #__erudaDock.__top    { left: 0; right: 0; top: 0; }
    #__erudaDock.__left   { left: 0; top: 0; bottom: 0; }
    #__erudaDock.__right  { right: 0; top: 0; bottom: 0; }

    #__erudaDockBar {
      position: fixed;
      z-index: 2147483647;
      right: 8px;
      top: 8px;
      display: grid;
      gap: 6px;
      padding: 8px;
      border-radius: 10px;
      background: rgba(255,255,255,.80);
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
      font: 12px/1.2 -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Arial, sans-serif;
      color: #111;
    }

    #__erudaDockBtns { display: flex; gap: 6px; }
    #__erudaDockBtns button {
      padding: 6px 8px;
      border-radius: 8px;
      border: 1px solid rgba(0,0,0,.25);
      background: rgba(255,255,255,.92);
      color: #111;
    }
    #__erudaDockBtns button:active { transform: translateY(1px); }

    #__erudaSizeRow { display: grid; gap: 4px; }
    #__erudaSizeLabel { opacity: .85; }
    #__erudaSize {
      width: 220px;
      touch-action: pan-x;
    }
  `;

  function onReady(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn, { once: true });
    } else fn();
  }

  onReady(async () => {
    injectStyle(CSS);

    const dock = el("div", { id: "__erudaDock" }, document.body);

    // Панель управления: кнопки + ползунок
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

    // размеры в процентах экрана:
    // вертикальный (vh) для top/bottom и горизонтальный (vw) для left/right
    let sizeV = Number(localStorage.getItem("eruda-dock-size-v")) || 45; // height in vh
    let sizeH = Number(localStorage.getItem("eruda-dock-size-h")) || 55; // width in vw

    let currentPos = localStorage.getItem("eruda-dock-pos");
    if (!positions.includes(currentPos)) currentPos = "bottom";

    function applySize() {
      // сброс
      dock.style.height = "";
      dock.style.width = "";

      if (currentPos === "top" || currentPos === "bottom") {
        dock.style.height = sizeV + "vh";
        sizeInput.value = String(sizeV);
        sizeLabel.textContent = `Size: ${sizeV}vh (height)`;
      } else {
        dock.style.width = sizeH + "vw";
        sizeInput.value = String(sizeH);
        sizeLabel.textContent = `Size: ${sizeH}vw (width)`;
      }
    }

    function setDock(pos) {
      currentPos = pos;
      localStorage.setItem("eruda-dock-pos", pos);

      dock.classList.remove("__top", "__bottom", "__left", "__right");
      dock.classList.add("__" + pos);

      applySize();
    }

    positions.forEach((p) => {
      el(
        "button",
        {
          text: p[0].toUpperCase() + p.slice(1),
          onclick: () => setDock(p),
        },
        btns,
      );
    });

    sizeInput.addEventListener("input", () => {
      const val = Number(sizeInput.value);

      if (currentPos === "top" || currentPos === "bottom") {
        sizeV = val;
        localStorage.setItem("eruda-dock-size-v", String(sizeV));
      } else {
        sizeH = val;
        localStorage.setItem("eruda-dock-size-h", String(sizeH));
      }
      applySize();
    });

    setDock(currentPos); // выставит и позицию, и размер

    // --- load eruda + plugins ---
    try {
      await loadScript("https://cdn.jsdelivr.net/npm/eruda");

      eruda.init({
        container: dock,
        inline: true,
        autoScale: true,
        useShadowDom: true,
        defaults: { transparency: 0.95, displaySize: 100 },
      });

      await loadScript("https://cdn.jsdelivr.net/npm/eruda-dom/eruda-dom.js");
      await loadScript(
        "https://cdn.jsdelivr.net/npm/eruda-monitor/eruda-monitor.js",
      );
      await loadScript(
        "https://cdn.jsdelivr.net/npm/eruda-timing/eruda-timing.js",
      );
      await loadScript(
        "https://cdn.jsdelivr.net/npm/eruda-features/eruda-features.js",
      );
      await loadScript(
        "https://cdn.jsdelivr.net/npm/eruda-orientation/eruda-orientation.js",
      );
      await loadScript(
        "https://cdn.jsdelivr.net/npm/eruda-touches/eruda-touches.js",
      );

      eruda.add(erudaDom);
      eruda.add(erudaMonitor);
      eruda.add(erudaTiming);
      eruda.add(erudaFeatures);
      eruda.add(erudaOrientation);
      eruda.add(erudaTouches);

      window.__erudaDock = { setDock, dock, bar, applySize, eruda };
    } catch (e) {
      console.error("[eruda dock] init failed:", e);
    }
  });
})();
