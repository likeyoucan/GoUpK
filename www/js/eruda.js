// Файл: www/js/eruda.js

function activateEruda() {
  localStorage.setItem("active-eruda", "true");
  location.reload();
}

(function () {
  if (window.__erudaDockLoaded) return;
  window.__erudaDockLoaded = true;

  var enabled =
    /(^|[?&])eruda=true(&|$)/.test(location.search) ||
    localStorage.getItem("active-eruda") === "true";
  if (!enabled) return;

  var BASE = "https://cdn.jsdelivr.net/npm/";
  var CORE_SRC = BASE + "eruda";
  var PLUGINS = [
    BASE + "eruda-dom/eruda-dom.js",
    BASE + "eruda-monitor/eruda-monitor.js",
    BASE + "eruda-timing/eruda-timing.js",
    BASE + "eruda-features/eruda-features.js",
    BASE + "eruda-orientation/eruda-orientation.js",
    BASE + "eruda-touches/eruda-touches.js",
    BASE + "eruda-code/eruda-code.js",
    BASE + "eruda-fps/eruda-fps.js",
  ];

  function onReady(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn, { once: true });
    } else fn();
  }

  function injectStyle(cssText) {
    var s = document.createElement("style");
    s.type = "text/css";
    s.appendChild(document.createTextNode(cssText));
    document.head.appendChild(s);
  }

  function el(tag, attrs, parent) {
    var n = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (k === "style") {
          Object.assign(n.style, v);
        } else if (k === "text") {
          n.textContent = v;
        } else if (k.indexOf("on") === 0 && typeof v === "function") {
          n.addEventListener(k.slice(2), v);
        } else {
          n.setAttribute(k, v);
        }
      });
    }
    if (parent) parent.appendChild(n);
    return n;
  }

  function loadScriptOnce(src) {
    window.__erudaDockScriptPromises = window.__erudaDockScriptPromises || {};
    if (window.__erudaDockScriptPromises[src])
      return window.__erudaDockScriptPromises[src];

    window.__erudaDockScriptPromises[src] = new Promise(function (
      resolve,
      reject,
    ) {
      var s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.onload = resolve;
      s.onerror = function () {
        reject(new Error("Failed to load: " + src));
      };
      document.body.appendChild(s);
    });
    return window.__erudaDockScriptPromises[src];
  }

  function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
  }

  var LS = {
    get: function (k, d) {
      var v = localStorage.getItem(k);
      return v == null ? d : v;
    },
    set: function (k, v) {
      localStorage.setItem(k, String(v));
    },
  };

  var CSS =
    "\
  #__erudaGear, #__erudaDockBar { z-index: 2147483647; pointer-events:auto; }\
  #__erudaGear{\
    position:fixed; right:12px; bottom:12px;\
    width:48px; height:48px; border-radius:14px;\
    border:1px solid rgba(120,120,128,0.2);\
    background:rgba(255,255,255,0.85);\
    backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);\
    font-size:22px; line-height:48px; text-align:center;\
    -webkit-tap-highlight-color: transparent; cursor: pointer;\
    box-shadow: 0 4px 12px rgba(0,0,0,0.12);\
  }\
  @media (prefers-color-scheme: dark) {\
    #__erudaGear { background: rgba(30,30,35,0.8); color: #fff; border-color: rgba(255,255,255,0.1); }\
  }\
  #__erudaDockBar{\
    position:fixed; right:12px; bottom:70px;\
    display:none; gap:8px; padding:12px; width:280px;\
    border-radius:16px;\
    background:rgba(255,255,255,0.85);\
    backdrop-filter: blur(15px); -webkit-backdrop-filter: blur(15px);\
    font: 13px/1.4 system-ui, -apple-system, sans-serif;\
    box-sizing:border-box; box-shadow: 0 8px 32px rgba(0,0,0,0.15);\
    border: 1px solid rgba(0,0,0,0.05);\
  }\
  @media (prefers-color-scheme: dark) {\
    #__erudaDockBar { background: rgba(25,25,30,0.9); color: #eee; border-color: rgba(255,255,255,0.1); }\
  }\
  #__erudaDockBar.__open{ display:grid; }\
  #__erudaDockTopRow{ display:flex; align-items:center; justify-content:space-between; gap:8px; }\
  #__erudaDockTitle{ font-weight:600; opacity:.9; }\
  #__erudaDockToggleUi{\
    padding:6px 10px; border-radius:10px;\
    border:1px solid rgba(0,0,0,.25); background:rgba(255,255,255,.92);\
    cursor: pointer;\
  }\
  #__erudaDockBar.__compact #__erudaDockSettings{ display:none; }\
  #__erudaDockBtns{ display:flex; gap:6px; }\
  #__erudaDockBtns button{\
    flex:1; padding:6px 8px; border-radius:10px;\
    border:1px solid rgba(0,0,0,.25); background:rgba(255,255,255,.92);\
    cursor: pointer;\
  }\
  #__erudaSizeRow{ display:grid; gap:4px; margin-top: 8px; }\
  #__erudaSize{ width:100%; touch-action: pan-x; }\
  #__erudaSizeLabel{ opacity:.85; }\
  #__erudaDock{\
    position:fixed; z-index:2147483645; display:none;\
    background:transparent; overflow:hidden; box-sizing:border-box;\
  }\
  #__erudaDock.__bottom{ left:0; right:0; bottom:0; }\
  #__erudaDock.__top{ left:0; right:0; top:0; }\
  #__erudaDock.__left{ left:0; top:0; bottom:0; }\
  #__erudaDock.__right{ right:0; top:0; bottom:0; }\
  #__erudaMount{\
    position:absolute; inset:0; overflow:hidden;\
  }\
  #__erudaResizeHandle{\
    position:absolute; z-index:2147483646; background:rgba(0,0,0,.16);\
    touch-action:none; user-select:none; cursor: ns-resize;\
  }\
  #__erudaDock.__left #__erudaResizeHandle, #__erudaDock.__right #__erudaResizeHandle { cursor: ew-resize; }\
  #__erudaResizeHandle::after{\
    content:''; position:absolute; left:50%; top:50%;\
    transform:translate(-50%,-50%); border-radius:999px;\
    background:rgba(255,255,255,.65); opacity:.95;\
  }\
  #__erudaDock.__bottom #__erudaResizeHandle{ left:0; right:0; top:0; height:12px; }\
  #__erudaDock.__bottom #__erudaResizeHandle::after{ width:44px; height:4px; }\
  #__erudaDock.__top #__erudaResizeHandle{ left:0; right:0; bottom:0; height:12px; }\
  #__erudaDock.__top #__erudaResizeHandle::after{ width:44px; height:4px; }\
  #__erudaDock.__left #__erudaResizeHandle{ top:0; bottom:0; right:0; width:12px; }\
  #__erudaDock.__left #__erudaResizeHandle::after{ width:4px; height:44px; }\
  #__erudaDock.__right #__erudaResizeHandle{ top:0; bottom:0; left:0; width:12px; }\
  #__erudaDock.__right #__erudaResizeHandle::after{ width:4px; height:44px; }\
  #__erudaDock #eruda, #__erudaDock .eruda-dev-tools, #__erudaDock .eruda-container{\
    min-width:0 !important; min-height:0 !important;\
    max-width:100% !important; max-height:100% !important;\
    overflow:hidden !important;\
  }\
  ";

  onReady(function () {
    injectStyle(CSS);

    var gear = el("button", { id: "__erudaGear", text: "⚙" }, document.body);
    var bar = el("div", { id: "__erudaDockBar" }, document.body);
    var topRow = el("div", { id: "__erudaDockTopRow" }, bar);
    el("div", { id: "__erudaDockTitle", text: "Eruda Dock" }, topRow);
    var toggleUiBtn = el(
      "button",
      { id: "__erudaDockToggleUi", text: "Hide UI" },
      topRow,
    );
    var settings = el("div", { id: "__erudaDockSettings" }, bar);
    var btns = el("div", { id: "__erudaDockBtns" }, settings);

    // Hard Reload Button for Vite
    el(
      "button",
      {
        text: "Hard Reload",
        style: {
          marginTop: "8px",
          background: "#ff3b30",
          color: "#fff",
          border: "none",
          width: "100%",
        },
        onclick: function () {
          if (confirm("Clear cache and reload?")) {
            location.reload(true);
          }
        },
      },
      settings,
    );

    var sizeRow = el("div", { id: "__erudaSizeRow" }, settings);
    var sizeLabel = el(
      "div",
      { id: "__erudaSizeLabel", text: "Size: —" },
      sizeRow,
    );
    var sizeInput = el(
      "input",
      { id: "__erudaSize", type: "range", min: "20", max: "90", step: "1" },
      sizeRow,
    );

    var dock = el("div", { id: "__erudaDock" }, document.body);
    var mount = el("div", { id: "__erudaMount" }, dock);
    var resizeHandle = el("div", { id: "__erudaResizeHandle" }, dock);

    function bringControlsToFront() {
      document.body.appendChild(bar);
      document.body.appendChild(gear);
    }

    var open = LS.get("eruda-open", "false") === "true";
    var compact = LS.get("eruda-ui-compact", "false") === "true";
    var pos = LS.get("eruda-dock-pos", "bottom");
    var sizeV = Number(LS.get("eruda-dock-size-v", "45"));
    var sizeH = Number(LS.get("eruda-dock-size-h", "55"));
    var erudaInitialized = false;

    function renderCompact() {
      if (compact) {
        bar.classList.add("__compact");
        toggleUiBtn.textContent = "Show UI";
      } else {
        bar.classList.remove("__compact");
        toggleUiBtn.textContent = "Hide UI";
      }
      LS.set("eruda-ui-compact", compact);
      bringControlsToFront();
    }

    toggleUiBtn.addEventListener("click", function () {
      compact = !compact;
      renderCompact();
    });

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
        dock.style.width = "100%";
        sizeInput.value = String(sizeV);
        sizeLabel.textContent = "Size: " + sizeV + "vh (height)";
      } else {
        sizeH = clamp(sizeH, 20, 90);
        dock.style.top = "0";
        dock.style.bottom = "0";
        dock.style[pos] = "0";
        dock.style.width = sizeH + "vw";
        dock.style.height = "100%";
        sizeInput.value = String(sizeH);
        sizeLabel.textContent = "Size: " + sizeH + "vw (width)";
      }
    }

    function setPos(p) {
      pos = p;
      LS.set("eruda-dock-pos", pos);
      applyDock();
      bringControlsToFront();
    }

    ["top", "bottom", "left", "right"].forEach(function (p) {
      el(
        "button",
        {
          text: p.charAt(0).toUpperCase() + p.slice(1),
          onclick: function () {
            setPos(p);
          },
        },
        btns,
      );
    });

    function onSizeInput() {
      var val = Number(sizeInput.value);
      if (pos === "top" || pos === "bottom") {
        sizeV = val;
        LS.set("eruda-dock-size-v", sizeV);
      } else {
        sizeH = val;
        LS.set("eruda-dock-size-h", sizeH);
      }
      applyDock();
    }
    sizeInput.addEventListener("input", onSizeInput);
    sizeInput.addEventListener("change", function () {
      onSizeInput();
      bringControlsToFront();
    });

    var drag = null;
    resizeHandle.addEventListener("pointerdown", function (e) {
      e.preventDefault();
      resizeHandle.setPointerCapture(e.pointerId);
      drag = { x: e.clientX, y: e.clientY, sizeV: sizeV, sizeH: sizeH };
    });

    resizeHandle.addEventListener("pointermove", function (e) {
      if (!drag) return;
      var vw = Math.max(1, window.innerWidth),
        vh = Math.max(1, window.innerHeight);
      var dx = e.clientX - drag.x,
        dy = e.clientY - drag.y;
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
      bringControlsToFront();
    }
    resizeHandle.addEventListener("pointerup", endDrag);
    resizeHandle.addEventListener("pointercancel", endDrag);

    var scriptsLoaded = false;
    function ensureScripts() {
      if (scriptsLoaded) return Promise.resolve();
      return loadScriptOnce(CORE_SRC).then(function () {
        var p = Promise.resolve();
        PLUGINS.forEach(function (src) {
          p = p.then(function () {
            return loadScriptOnce(src);
          });
        });
        return p.then(function () {
          scriptsLoaded = true;
        });
      });
    }

    function initEruda() {
      dock.style.display = "block";
      applyDock();

      return new Promise(function (resolve) {
        setTimeout(function () {
          // Инициализируем только если еще не было создано
          if (!window.eruda._isInit) {
            var isDark =
              window.matchMedia &&
              window.matchMedia("(prefers-color-scheme: dark)").matches;

            eruda.init({
              container: mount,
              inline: true,
              useShadowDom: false,
              autoScale: true,
              theme: isDark ? "dark" : "light",
              defaults: { transparency: 0.95, displaySize: 100 },
            });

            if (window.erudaDom) eruda.add(erudaDom);
            if (window.erudaMonitor) eruda.add(erudaMonitor);
            if (window.erudaTiming) eruda.add(erudaTiming);
            if (window.erudaFeatures) eruda.add(erudaFeatures);
            if (window.erudaOrientation) eruda.add(erudaOrientation);
            if (window.erudaTouches) eruda.add(erudaTouches);
            if (window.erudaCode) eruda.add(erudaCode);
            if (window.erudaFps) eruda.add(erudaFps);
          }

          eruda.show(); // Всегда вызываем show при открытии дока
          bringControlsToFront();
          resolve();
        }, 0);
      });
    }

    function openEruda() {
      bar.classList.add("__open");
      dock.style.display = "block";
      applyDock();
      renderCompact();

      return ensureScripts().then(function () {
        if (!erudaInitialized) {
          return initEruda().then(function () {
            erudaInitialized = true;
          });
        } else {
          if (window.eruda) eruda.show();
          bringControlsToFront();
          return Promise.resolve();
        }
      });
    }

    function closeEruda() {
      bar.classList.remove("__open");
      dock.style.display = "none";
      bringControlsToFront();

      // Скрываем Eruda вместо уничтожения. Это исправляет баг пустого окна.
      if (window.eruda) eruda.hide();
    }

    gear.addEventListener("click", function () {
      open = !open;
      LS.set("eruda-open", open);
      if (open) openEruda();
      else closeEruda();
    });

    window.addEventListener("resize", function () {
      if (!open) return;
      applyDock();
      bringControlsToFront();
    });

    applyDock();
    renderCompact();
    if (open) openEruda();
    else closeEruda();
  });
})();
