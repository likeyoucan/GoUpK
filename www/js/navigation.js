// Файл: www/js/navigation.js

import { $ } from "./utils.js?v=VERSION";
import { themeManager } from "./theme.js?v=VERSION";

const VIEWS = ["stopwatch", "timer", "tabata", "settings"];
const PANEL_VIEWS = ["stopwatch", "timer", "tabata"];
const SNAP_ORDER = ["min", "mid", "high", "max"];
const PANEL_PEEK = 34;

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function stripIds(root) {
  if (!root) return;
  if (root.removeAttribute) root.removeAttribute("id");
  root.querySelectorAll?.("[id]").forEach((el) => el.removeAttribute("id"));
}

function isHorizontalLayout() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  return w >= 1280 || w > h; // 2/4/5
}

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

function getPanelPrefix(view) {
  if (view === "stopwatch") return "sw";
  if (view === "timer") return "tm";
  return "tb";
}

export const navigation = {
  activeView: "stopwatch",
  clockInterval: null,
  isTransitioning: false,

  panel: {
    activeAxis: "y",
    isDragging: false,
    dragView: null,
    dragPointerId: null,
    dragStartPos: 0,
    dragStartOffset: 0,
    dragMoved: false,
    snapsByView: {
      stopwatch: "mid",
      timer: "mid",
      tabata: "mid",
    },
  },

  init() {
    this.initClock();
    this.updateDOM(this.activeView, { instant: true });
    this.updateIcons(this.activeView);

    this.initPanels();
    this.refreshPanelLayout(true);
  },

  initPanels() {
    PANEL_VIEWS.forEach((view) => {
      const prefix = getPanelPrefix(view);
      const handle = $(`${prefix}-panel-handle`);
      if (!handle || handle.dataset.boundPanel === "1") return;
      handle.dataset.boundPanel = "1";

      handle.addEventListener("pointerdown", (e) =>
        this.onPanelPointerDown(e, view),
      );
      handle.addEventListener("pointermove", (e) => this.onPanelPointerMove(e));
      handle.addEventListener("pointerup", (e) => this.onPanelPointerUp(e));
      handle.addEventListener("pointercancel", (e) => this.onPanelPointerUp(e));
      handle.addEventListener("click", (e) => this.onPanelHandleClick(e, view));
    });

    window.addEventListener("resize", () => this.refreshPanelLayout(true));
    window.addEventListener("orientationchange", () =>
      this.refreshPanelLayout(true),
    );
  },

  getPanelEl(view) {
    if (view === "stopwatch") return $("sw-middle-panel");
    if (view === "timer") return $("tm-middle-panel");
    if (view === "tabata") return $("tb-middle-panel");
    return null;
  },

  getAxis() {
    return isHorizontalLayout() ? "x" : "y";
  },

  getPanelSize(view, axis) {
    const panelEl = this.getPanelEl(view);
    if (!panelEl) return 1;
    const size = axis === "x" ? panelEl.offsetWidth : panelEl.offsetHeight;
    return Math.max(1, size);
  },

  getSnapOffset(size, axis, snap) {
    const mapY = {
      min: Math.max(0, size - PANEL_PEEK),
      mid: size * 0.56,
      high: size * 0.28,
      max: size * 0.06,
    };

    const mapX = {
      min: Math.max(0, size - PANEL_PEEK),
      mid: size * 0.46,
      high: size * 0.2,
      max: size * 0.04,
    };

    return axis === "x" ? mapX[snap] : mapY[snap];
  },

  getSnap(view) {
    return this.panel.snapsByView[view] || "mid";
  },

  setSnap(view, snap) {
    if (!SNAP_ORDER.includes(snap)) return;
    this.panel.snapsByView[view] = snap;
  },

  applyPanelTransform(view, offset, axis, instant = false) {
    const panelEl = this.getPanelEl(view);
    if (!panelEl) return;

    panelEl.dataset.panelAxis = axis;
    if (instant) panelEl.style.transition = "none";

    panelEl.style.transform =
      axis === "x" ? `translateX(${offset}px)` : `translateY(${offset}px)`;

    if (instant) {
      requestAnimationFrame(() => {
        panelEl.style.transition = "";
      });
    }
  },

  refreshPanelLayout(instant = false) {
    const appEl = $("app");
    const axis = this.getAxis();
    this.panel.activeAxis = axis;

    appEl?.classList.toggle("is-horizontal-layout", axis === "x");

    PANEL_VIEWS.forEach((view) => {
      const size = this.getPanelSize(view, axis);
      const snap = this.getSnap(view);
      const offset = this.getSnapOffset(size, axis, snap);
      this.applyPanelTransform(view, offset, axis, instant);
    });
  },

  getCurrentTranslatedOffset(panelEl, axis) {
    if (!panelEl) return 0;
    const matrix = window.getComputedStyle(panelEl).transform;
    if (!matrix || matrix === "none") return 0;

    const values = matrix.match(/matrix.*\((.+)\)/);
    if (!values || !values[1]) return 0;

    const parts = values[1].split(",").map((v) => Number(v.trim()));
    return axis === "x" ? parts[4] || 0 : parts[5] || 0;
  },

  getNearestSnap(size, axis, offset) {
    const points = SNAP_ORDER.map((snap) => ({
      snap,
      value: this.getSnapOffset(size, axis, snap),
    }));
    return points.reduce((acc, curr) =>
      Math.abs(curr.value - offset) < Math.abs(acc.value - offset) ? curr : acc,
    );
  },

  onPanelHandleClick(event, view) {
    if (this.panel.isDragging && this.panel.dragMoved) return;
    if (event.defaultPrevented) return;

    const current = this.getSnap(view);
    const idx = SNAP_ORDER.indexOf(current);
    const next = SNAP_ORDER[(idx + 1) % SNAP_ORDER.length];
    this.setSnap(view, next);

    const axis = this.panel.activeAxis;
    const size = this.getPanelSize(view, axis);
    const offset = this.getSnapOffset(size, axis, next);

    this.applyPanelTransform(view, offset, axis);
  },

  onPanelPointerDown(event, view) {
    if (event.button !== 0 && event.pointerType !== "touch") return;
    const panelEl = this.getPanelEl(view);
    if (!panelEl) return;

    const axis = this.panel.activeAxis;
    const size = this.getPanelSize(view, axis);
    const snap = this.getSnap(view);
    const startOffset = this.getSnapOffset(size, axis, snap);

    this.panel.isDragging = true;
    this.panel.dragMoved = false;
    this.panel.dragView = view;
    this.panel.dragPointerId = event.pointerId;
    this.panel.dragStartPos = axis === "x" ? event.clientX : event.clientY;
    this.panel.dragStartOffset = startOffset;

    event.currentTarget.setPointerCapture(event.pointerId);
    panelEl.style.transition = "none";
  },

  onPanelPointerMove(event) {
    if (!this.panel.isDragging) return;
    if (event.pointerId !== this.panel.dragPointerId) return;

    const view = this.panel.dragView;
    const panelEl = this.getPanelEl(view);
    if (!panelEl) return;

    const axis = this.panel.activeAxis;
    const size = this.getPanelSize(view, axis);

    const pos = axis === "x" ? event.clientX : event.clientY;
    const delta = pos - this.panel.dragStartPos;
    if (Math.abs(delta) > 4) this.panel.dragMoved = true;

    const nextOffset = clamp(
      this.panel.dragStartOffset + delta,
      0,
      this.getSnapOffset(size, axis, "min"),
    );

    this.applyPanelTransform(view, nextOffset, axis, true);
  },

  onPanelPointerUp(event) {
    if (!this.panel.isDragging) return;
    if (event.pointerId !== this.panel.dragPointerId) return;

    const view = this.panel.dragView;
    const panelEl = this.getPanelEl(view);
    if (!panelEl) return;

    const axis = this.panel.activeAxis;
    const size = this.getPanelSize(view, axis);
    const rawOffset = this.getCurrentTranslatedOffset(panelEl, axis);
    const nearest = this.getNearestSnap(size, axis, rawOffset);

    this.setSnap(view, nearest.snap);

    panelEl.style.transition = "";
    this.applyPanelTransform(view, nearest.value, axis);

    this.panel.isDragging = false;
    this.panel.dragView = null;
    this.panel.dragPointerId = null;
    this.panel.dragMoved = false;
  },

  switchView(viewId, options = {}) {
    const { source = "tap" } = options;

    if (!VIEWS.includes(viewId)) return false;
    if (this.activeView === viewId) return false;
    if (this.isTransitioning) return false;
    if (this.panel.isDragging) return false;

    if (prefersReducedMotion()) {
      this.updateDOM(viewId, { instant: true });
      this.refreshPanelLayout(true);
      return true;
    }

    const fromId = this.activeView;
    const fromEl = $(`view-${fromId}`);
    const viewsContainer = $("viewsContainer");
    const appEl = $("app");

    if (!fromEl || !viewsContainer) {
      this.updateDOM(viewId, { instant: true });
      this.refreshPanelLayout(true);
      return true;
    }

    this.isTransitioning = true;
    appEl?.classList.add("is-view-transitioning");

    viewsContainer
      .querySelectorAll(".nav-snapshot-layer")
      .forEach((n) => n.remove());

    const snapshot = fromEl.cloneNode(true);
    stripIds(snapshot);

    snapshot.classList.remove(
      "opacity-0",
      "pointer-events-none",
      "z-10",
      "z-20",
    );
    snapshot.classList.add("nav-snapshot-layer");
    snapshot.setAttribute("aria-hidden", "true");
    snapshot.setAttribute("inert", "");

    snapshot.style.position = "absolute";
    snapshot.style.inset = "0";
    snapshot.style.width = "100%";
    snapshot.style.height = "100%";
    snapshot.style.opacity = "1";
    snapshot.style.transform = "translateX(0)";

    viewsContainer.appendChild(snapshot);

    this.updateDOM(viewId, { instant: true });
    this.updateIcons(viewId);
    this.refreshPanelLayout(true);

    const fromIdx = VIEWS.indexOf(fromId);
    const toIdx = VIEWS.indexOf(viewId);
    const isSwipe = source === "swipe";
    const dirForward = toIdx > fromIdx;

    const duration = isSwipe ? 360 : 260;
    const easing = "cubic-bezier(0.32, 0.72, 0, 1)";
    snapshot.style.transition = `transform ${duration}ms ${easing}, opacity ${duration}ms ${easing}`;

    requestAnimationFrame(() => {
      if (!isSwipe) snapshot.style.opacity = "0";
      else
        snapshot.style.transform = `translateX(${dirForward ? "-100%" : "100%"})`;
    });

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      snapshot.remove();
      this.isTransitioning = false;
      appEl?.classList.remove("is-view-transitioning");

      if (viewId === "settings") themeManager.syncSliderUIs();
    };

    snapshot.addEventListener("transitionend", finish, { once: true });
    setTimeout(finish, duration + 80);

    return true;
  },

  updateDOM(viewId, options = {}) {
    const { instant = false } = options;
    this.activeView = viewId;

    VIEWS.forEach((id) => {
      const el = $(`view-${id}`);
      if (!el) return;

      if (id === viewId) {
        el.classList.remove("opacity-0", "pointer-events-none", "z-20");
        el.classList.add("z-10");
        el.removeAttribute("aria-hidden");
        el.removeAttribute("inert");
      } else {
        if (el.contains(document.activeElement)) document.activeElement.blur();
        el.classList.add("opacity-0", "pointer-events-none");
        el.classList.remove("z-10", "z-20");
        el.setAttribute("aria-hidden", "true");
        el.setAttribute("inert", "");
      }
    });

    this.updateIcons(viewId);

    if (instant && viewId === "settings") {
      themeManager.syncSliderUIs();
    }
  },

  updateIcons(activeId) {
    document.querySelectorAll("[data-nav]").forEach((btn) => {
      const id = btn.getAttribute("data-nav");
      const isActive = id === activeId;

      const iconDiv = btn.querySelector('div[id^="nav-icon-"]');
      const textSpan = btn.querySelector("span[data-i18n]");

      if (iconDiv) {
        iconDiv.classList.toggle("primary-text", isActive);
        iconDiv.classList.toggle("app-text-sec", !isActive);
      }

      if (textSpan) {
        textSpan.classList.toggle("primary-text", isActive);
        textSpan.classList.toggle("app-text-sec", !isActive);
      }
    });
  },

  initClock() {
    const clockEl = $("clock");
    if (!clockEl) return;

    if (this.clockInterval) {
      clearInterval(this.clockInterval);
      this.clockInterval = null;
    }

    const update = () => {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, "0");
      const m = String(now.getMinutes()).padStart(2, "0");
      clockEl.textContent =
        now.getSeconds() % 2 === 0 ? `${h}:${m}` : `${h} ${m}`;
    };

    update();
    this.clockInterval = setInterval(update, 1000);
  },
};
