// Файл: www/js/navigation.js

import { $ } from "./utils.js?v=VERSION";
import { themeManager } from "./theme.js?v=VERSION";

const VIEWS = ["stopwatch", "timer", "tabata", "settings"];

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export const navigation = {
  activeView: "stopwatch",
  clockInterval: null,
  isTransitioning: false,

  init() {
    this.initClock();
    this.updateDOM(this.activeView, { instant: true });
    this.updateIcons(this.activeView);
  },

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
    const appEl = $("app");

    if (!fromEl || !toEl) {
      this.updateDOM(viewId, { instant: true });
      return true;
    }

    this.isTransitioning = true;
    appEl?.classList.add("is-view-transitioning");

    const fromIdx = VIEWS.indexOf(fromId);
    const toIdx = VIEWS.indexOf(viewId);

    const inClass =
      source === "swipe"
        ? toIdx > fromIdx
          ? "nav-swipe-in-right"
          : "nav-swipe-in-left"
        : "nav-tap-in";

    const duration = source === "swipe" ? 360 : 280;

    this._clearAnimClasses(fromEl);
    this._clearAnimClasses(toEl);

    // Текущий экран оставляем как "подложку"
    fromEl.classList.remove("opacity-0", "pointer-events-none");
    fromEl.classList.add("z-10");
    fromEl.removeAttribute("aria-hidden");
    fromEl.removeAttribute("inert");

    // Новый экран выводим поверх и анимируем только его
    toEl.classList.remove("opacity-0", "pointer-events-none");
    toEl.classList.remove("z-10");
    toEl.classList.add("z-20", "nav-anim-layer", inClass);
    toEl.removeAttribute("aria-hidden");
    toEl.removeAttribute("inert");

    this.updateIcons(viewId);

    const finish = () => {
      this._clearAnimClasses(fromEl);
      this._clearAnimClasses(toEl);

      // Финал: скрываем старый, новый делаем обычным активным
      fromEl.classList.add("opacity-0", "pointer-events-none");
      fromEl.classList.remove("z-10", "z-20");
      fromEl.setAttribute("aria-hidden", "true");
      fromEl.setAttribute("inert", "");

      toEl.classList.remove("opacity-0", "pointer-events-none", "z-20");
      toEl.classList.add("z-10");
      toEl.removeAttribute("aria-hidden");
      toEl.removeAttribute("inert");

      this.activeView = viewId;

      if (viewId === "settings") {
        themeManager.syncSliderUIs();
      }

      this.isTransitioning = false;
      appEl?.classList.remove("is-view-transitioning");
    };

    setTimeout(finish, duration + 30);
    return true;
  },

  updateDOM(viewId, options = {}) {
    const { instant = false } = options;
    this.activeView = viewId;

    VIEWS.forEach((id) => {
      const el = $(`view-${id}`);
      if (!el) return;

      this._clearAnimClasses(el);

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

  _clearAnimClasses(el) {
    el.classList.remove(
      "nav-anim-layer",
      "nav-tap-in",
      "nav-swipe-in-right",
      "nav-swipe-in-left",
      "z-20",
    );
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
