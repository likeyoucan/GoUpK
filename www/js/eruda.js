(function () {
  // ВКЛ/ВЫКЛ "режим отладки" как вам удобно:
  // 1) по URL: ?eruda=true
  // 2) или по флагу: localStorage.active-eruda = 'true'
  const enabled =
    /(^|[?&])eruda=true(&|$)/.test(location.search) ||
    localStorage.getItem("active-eruda") === "true";

  if (!enabled) return;

  // --- helpers ---
  function injectStyle(cssText) {
    const s = document.createElement("style");
    s.type = "text/css";
    s.appendChild(document.createTextNode(cssText));
    document.head.appendChild(s);
    return s;
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

  // --- UI: dock container + buttons ---
  const CSS = `
    #__erudaDock {
      position: fixed;
      z-index: 2147483647;
      background: transparent;
    }
    /* Позиции дока */
    #__erudaDock.__bottom { left: 0; right: 0; bottom: 0; height: 45vh; }
    #__erudaDock.__top    { left: 0; right: 0; top: 0; height: 45vh; }
    #__erudaDock.__left   { left: 0; top: 0; bottom: 0; width: 55vw; }
    #__erudaDock.__right  { right: 0; top: 0; bottom: 0; width: 55vw; }

    /* Панель кнопок */
    #__erudaDockBtns {
      position: fixed;
      z-index: 2147483647;
      right: 8px;
      top: 8px;
      display: flex;
      gap: 6px;
      font: 12px/1.2 -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Arial, sans-serif;
    }
    #__erudaDockBtns button {
      padding: 6px 8px;
      border-radius: 8px;
      border: 1px solid rgba(0,0,0,.25);
      background: rgba(255,255,255,.92);
      color: #111;
    }
    #__erudaDockBtns button:active { transform: translateY(1px); }

    /* Чтобы кнопки не мешали кликам по странице — можно скрывать их в один тап:
       (опционально, но оставлю класс) */
    #__erudaDockBtns.__hidden { opacity: .2; }
  `;

  // гарантируем head/body
  function onReady(fn) {
    if (document.readyState === "loading")
      document.addEventListener("DOMContentLoaded", fn, { once: true });
    else fn();
  }

  onReady(async () => {
    injectStyle(CSS);

    const dock = el("div", { id: "__erudaDock" }, document.body);
    const btns = el("div", { id: "__erudaDockBtns" }, document.body);

    const positions = ["top", "bottom", "left", "right"];
    const saved = localStorage.getItem("eruda-dock-pos");
    let currentPos = positions.includes(saved) ? saved : "bottom";

    function setDock(pos) {
      currentPos = pos;
      localStorage.setItem("eruda-dock-pos", pos);

      dock.classList.remove("__top", "__bottom", "__left", "__right");
      dock.classList.add("__" + pos);
    }

    // Кнопки переключения
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

    // (опционально) тап по “пустому месту” кнопок — приглушить/показать
    btns.addEventListener("dblclick", () => btns.classList.toggle("__hidden"));

    setDock(currentPos);

    // --- load eruda + plugins ---
    try {
      // Eruda core
      await loadScript("https://cdn.jsdelivr.net/npm/eruda");
      // init: inline=true + container (кнопка входа исчезает, Eruda рендерится в container) <!--citation:1-->
      eruda.init({
        container: dock,
        inline: true,
        autoScale: true,
        useShadowDom: true,
        defaults: { transparency: 0.95, displaySize: 100 },
      });

      // plugins (важно: Eruda должна быть загружена до плагинов, и потом eruda.add(...)) <!--citation:2-->
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

      // пример: сразу открыть нужную вкладку
      // eruda.show('console');

      // наружу — чтобы можно было дергать из консоли
      window.__erudaDock = { setDock, dock, btns, eruda };
    } catch (e) {
      console.error("[eruda dock] init failed:", e);
    }
  });
})();
