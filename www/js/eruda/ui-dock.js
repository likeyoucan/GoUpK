// Файл: www/js/eruda/ui-dock.js

import { el, clamp } from "./loader.js?v=VERSION";

const LS = {
  get(key, fallback) {
    const raw = localStorage.getItem(key);
    return raw == null ? fallback : raw;
  },
  set(key, value) {
    localStorage.setItem(key, String(value));
  },
};

export function createErudaDock() {
  const gear = el("button", { id: "__erudaGear", text: "⚙" }, document.body);
  const bar = el("div", { id: "__erudaBar" }, document.body);

  const header = el("div", null, bar);
  header.style.display = "grid";
  header.style.gridTemplateColumns = "1fr auto";
  header.style.gap = "8px";
  header.style.alignItems = "center";

  const title = el("div", { text: "Eruda Panel" }, header);
  title.style.fontWeight = "700";

  const compactBtn = el("button", { text: "Hide UI" }, header);

  const controls = el("div", null, bar);
  controls.style.display = "grid";
  controls.style.gap = "8px";

  const rowPos = el("div", null, controls);
  rowPos.style.display = "grid";
  rowPos.style.gridTemplateColumns = "repeat(4, 1fr)";
  rowPos.style.gap = "6px";

  const rowTabs = el("div", null, controls);
  rowTabs.style.display = "grid";
  rowTabs.style.gridTemplateColumns = "repeat(3, 1fr)";
  rowTabs.style.gap = "6px";

  const hardReloadBtn = el("button", { text: "Hard Reload" }, controls);
  hardReloadBtn.style.background = "#ff3b30";
  hardReloadBtn.style.color = "#fff";
  hardReloadBtn.style.border = "none";

  const sizeLabel = el("div", { text: "Size: 45vh" }, controls);
  const sizeInput = el(
    "input",
    { type: "range", min: "20", max: "90", step: "1" },
    controls,
  );

  const panel = el("div", { id: "__erudaPanel" }, document.body);
  const resize = el("div", { id: "__erudaResize" }, panel);
  const mount = el("div", { id: "__erudaMount" }, panel);

  let open = LS.get("eruda-open", "false") === "true";
  let compact = LS.get("eruda-ui-compact", "false") === "true";
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
    ["Network", () => window.eruda?.show?.("network")],
  ].forEach(([name, fn]) => {
    const b = el("button", { text: name }, rowTabs);
    b.addEventListener("click", () => {
      try {
        fn();
      } catch {}
    });
  });

  function renderCompact() {
    if (compact) {
      controls.style.display = "none";
      title.style.display = "none";
      header.style.gridTemplateColumns = "1fr";
      compactBtn.textContent = "Show UI";
    } else {
      controls.style.display = "grid";
      title.style.display = "";
      header.style.gridTemplateColumns = "1fr auto";
      compactBtn.textContent = "Hide UI";
    }
    LS.set("eruda-ui-compact", compact);
  }

  compactBtn.addEventListener("click", () => {
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

  function openDock() {
    bar.classList.add("__open");
    panel.classList.add("__open");
    LS.set("eruda-open", "true");
  }

  function closeDock() {
    bar.classList.remove("__open");
    panel.classList.remove("__open");
    LS.set("eruda-open", "false");
  }

  gear.addEventListener("click", () => {
    open = !open;
    if (open) openDock();
    else closeDock();
  });

  window.addEventListener("resize", applyPanelGeometry);

  renderCompact();
  applyPanelGeometry();

  if (open) openDock();
  else closeDock();

  return {
    mount,
    openDock,
    closeDock,
    isOpen: () => open,
  };
}