// Файл: www/js/navigation.js

import { $ } from "./utils.js?v=VERSION";
import { themeManager } from "./theme.js?v=VERSION";

const VIEWS = ["stopwatch", "timer", "tabata", "settings"];

const ANIM = {
  tap: { out: "nav-fade-out", in: "nav-fade-in", dur: 280 },
  swipeForward: { out: "nav-slide-out-left", in: "nav-slide-in-right", dur: 360 },
  swipeBackward: { out: "nav-slide-out-right", in: "nav-slide-in-left", dur: 360 },
};

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

    let profile = ANIM.tap;
    if (source === "swipe") {
      profile = toIdx > fromIdx ? ANIM.swipeForward : ANIM.swipeBackward;
    }

    this._clearAnimClasses(fromEl);
    this._clearAnimClasses(toEl);

    // Подготовка следующего экрана
    toEl.classList.remove("opacity-0", "pointer-events-none");
    toEl.classList.add("z-10");
    toEl.removeAttribute("aria-hidden");
    toEl.removeAttribute("inert");

    // Текущий экран временно оставляем видимым, чтобы проиграть out-анимацию
    fromEl.classList.remove("opacity-0", "pointer-events-none");
    fromEl.classList.add("z-10");
    fromEl.removeAttribute("aria-hidden");
    fromEl.removeAttribute("inert");

    // Запуск анимаций
    fromEl.classList.add("nav-anim-current", profile.out);
    toEl.classList.add("nav-anim-next", profile.in);

    this.updateIcons(viewId);

    const finish = () => {
      this._clearAnimClasses(fromEl);
      this._clearAnimClasses(toEl);

      // Финальное состояние: старый скрыт, новый активен
      fromEl.classList.add("opacity-0", "pointer-events-none");
      fromEl.classList.remove("z-10");
      fromEl.setAttribute("aria-hidden", "true");
      fromEl.setAttribute("inert", "");

      toEl.classList.remove("opacity-0", "pointer-events-none");
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

    // Надежный финиш без зависимости от animationend
    setTimeout(finish, profile.dur + 30);

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
        el.classList.remove("opacity-0", "pointer-events-none");
        el.classList.add("z-10");
        el.removeAttribute("aria-hidden");
        el.removeAttribute("inert");
      } else {
        if (el.contains(document.activeElement)) {
          document.activeElement.blur();
        }
        el.classList.add("opacity-0", "pointer-events-none");
        el.classList.remove("z-10");
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
      "nav-anim-current",
      "nav-anim-next",
      "nav-fade-out",
      "nav-fade-in",
      "nav-slide-out-left",
      "nav-slide-in-right",
      "nav-slide-out-right",
      "nav-slide-in-left",
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