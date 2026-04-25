// Файл: www/js/navigation.js

import { $ } from "./utils.js?v=VERSION";
import { themeManager } from "./theme.js?v=VERSION";

const VIEWS = ["stopwatch", "timer", "tabata", "settings"];

export const navigation = {
  activeView: "stopwatch",
  clockInterval: null,

  init() {
    this.initClock();
  },

  switchView(viewId) {
    if (this.activeView === viewId) return;

    const currentIdx = VIEWS.indexOf(this.activeView);
    const nextIdx = VIEWS.indexOf(viewId);
    const isForward = nextIdx > currentIdx;

    const htmlEl = document.documentElement;
    htmlEl.classList.remove("js-nav-forward", "js-nav-backward");
    htmlEl.classList.add(isForward ? "js-nav-forward" : "js-nav-backward");

    if (!document.startViewTransition) {
      this.updateDOM(viewId);
      this._scheduleDirectionCleanup(htmlEl);
    } else {
      document.startViewTransition(() => {
        this.updateDOM(viewId);
      }).finished.then(() => {
        htmlEl.classList.remove("js-nav-forward", "js-nav-backward");
      }).catch(() => {
        htmlEl.classList.remove("js-nav-forward", "js-nav-backward");
      });
    }
  },

  _scheduleDirectionCleanup(htmlEl) {
    setTimeout(() => {
      htmlEl.classList.remove("js-nav-forward", "js-nav-backward");
    }, 400);
  },

  updateDOM(viewId) {
    this.activeView = viewId;
    VIEWS.forEach((id) => {
      const el = $(`view-${id}`);
      if (!el) return;
      if (id === viewId) {
        el.classList.remove("opacity-0", "pointer-events-none");
        el.classList.add("z-10");
        el.removeAttribute("aria-hidden");
        el.removeAttribute("inert");
        if (id === "settings") {
          themeManager.syncSliderUIs();
        }
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
  },

  updateIcons(activeId) {
    VIEWS.forEach((id) => {
      const iconDiv = $(`nav-icon-${id}`);
      if (!iconDiv) return;
      const textSpan = iconDiv.nextElementSibling;
      const iconSvg = iconDiv.querySelector("svg");

      if (id === activeId) {
        iconDiv.classList.remove("app-text-sec");
        iconDiv.classList.add("primary-text");
        if (textSpan) {
          textSpan.classList.remove("app-text-sec");
          textSpan.classList.add("primary-text");
        }
        if (iconSvg) iconSvg.setAttribute("stroke-width", "2");
      } else {
        iconDiv.classList.remove("primary-text");
        iconDiv.classList.add("app-text-sec");
        if (textSpan) {
          textSpan.classList.remove("primary-text");
          textSpan.classList.add("app-text-sec");
        }
        if (iconSvg) iconSvg.setAttribute("stroke-width", "1.5");
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
