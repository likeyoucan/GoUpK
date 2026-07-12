// Файл: www/js/navigation.js

import { $ } from "./utils.js?v=VERSION";
import { themeManager } from "./theme.js?v=VERSION";

/** @typedef {import("./types/managers-contracts.js").NavigationManagerContract} NavigationManagerContract */
/** @typedef {import("./types/managers-contracts.js").AppView} AppView */

const VIEWS = ["stopwatch", "timer", "tabata", "settings"];

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function stripIds(root) {
  if (!root) return;
  if (root.removeAttribute) root.removeAttribute("id");
  root.querySelectorAll?.("[id]").forEach((el) => el.removeAttribute("id"));
}

/** @type {NavigationManagerContract & {destroy?: () => void}} */
export const navigation = {
  activeView: "stopwatch",
  clockInterval: null,
  isTransitioning: false,

  init() {
    this.initClock();
    this.updateDOM(this.activeView, { instant: true });
    this.updateIcons(this.activeView);
  },

  destroy() {
    if (this.clockInterval) {
      clearInterval(this.clockInterval);
      this.clockInterval = null;
    }
    this.isTransitioning = false;
  },

  /**
   * @param {AppView} viewId
   * @param {{source?: "tap" | "swipe"}} [options]
   * @returns {boolean}
   */
  switchView(viewId, options = {}) {
    const { source = "tap" } = options;

    if (!VIEWS.includes(viewId)) return false;
    if (this.activeView === viewId) return false;
    if (this.isTransitioning) return false;

    if (prefersReducedMotion()) {
      this.updateDOM(viewId, { instant: true });
      return true;
    }

    const fromId = this.activeView;
    const fromEl = $(`view-${fromId}`);
    const toEl = $(`view-${viewId}`);
    const viewsContainer = $("viewsContainer");
    const appEl = $("app");

    if (!fromEl || !toEl || !viewsContainer) {
      this.updateDOM(viewId, { instant: true });
      return true;
    }

    this.isTransitioning = true;
    appEl?.classList.add("is-view-transitioning");

    // Очищаем старые слепки, если они зависли
    viewsContainer
      .querySelectorAll(".nav-snapshot-layer")
      .forEach((n) => n.remove());

    const fromIdx = VIEWS.indexOf(fromId);
    const toIdx = VIEWS.indexOf(viewId);
    const isSwipe = source === "swipe";
    const dirForward = toIdx > fromIdx;

    // 1. Создаем слепок текущего (уходящего) экрана
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

    // Фиксируем позицию слепка поверх всего
    snapshot.style.position = "absolute";
    snapshot.style.inset = "0";
    snapshot.style.width = "100%";
    snapshot.style.height = "100%";
    snapshot.style.left = "0";
    snapshot.style.top = "0";
    snapshot.style.opacity = "1";
    snapshot.style.transform = "translateX(0)";

    viewsContainer.appendChild(snapshot);

    // 2. Мгновенно переключаем реальный DOM под слепком
    this.updateDOM(viewId, { instant: true });

    // 3. Запускаем анимацию ухода слепка
    const duration = isSwipe ? 220 : 320;
    const easing = "cubic-bezier(0.32, 0.72, 0, 1)";

    snapshot.style.transition = `transform ${duration}ms ${easing}, opacity ${duration}ms ${easing}`;

    requestAnimationFrame(() => {
      if (!isSwipe) {
        snapshot.style.opacity = "0";
      } else {
        snapshot.style.transform = `translateX(${dirForward ? "-100%" : "100%"})`;
        snapshot.style.opacity = "0.95";
      }
    });

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      snapshot.remove();
      this.isTransitioning = false;
      appEl?.classList.remove("is-view-transitioning");

      if (viewId === "settings") {
        themeManager.syncSliderUIs();
      }
    };

    snapshot.addEventListener("transitionend", finish, { once: true });
    // Страховочный таймаут на случай сбоя события transitionend
    setTimeout(finish, duration + 80);

    return true;
  },

  /**
   * @param {AppView} viewId
   * @param {{instant?: boolean}} [options]
   */
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
        if (el.contains(document.activeElement)) {
          document.activeElement.blur();
        }
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

  /**
   * @param {AppView} activeId
   */
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