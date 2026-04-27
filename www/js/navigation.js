// Файл: www/js/navigation.js

import { $ } from "./utils.js?v=VERSION";
import { themeManager } from "./theme.js?v=VERSION";

const VIEWS = ["stopwatch", "timer", "tabata", "settings"];
const CLASS_FORWARD = "js-nav-forward";
const CLASS_BACKWARD = "js-nav-backward";
const CLASS_TAP = "js-nav-tap";

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export const navigation = {
  activeView: "stopwatch",
  clockInterval: null,
  isTransitioning: false,

  init() {
    this.initClock();
    this.updateIcons(this.activeView);
    this.updateDOM(this.activeView);
  },

  switchView(viewId, options = {}) {
    const { source = "tap" } = options;

    if (!VIEWS.includes(viewId)) return false;
    if (this.activeView === viewId) return false;
    if (this.isTransitioning) return false;

    const html = document.documentElement;
    const appEl = $("app");

    const fromIdx = VIEWS.indexOf(this.activeView);
    const toIdx = VIEWS.indexOf(viewId);

    html.classList.remove(CLASS_FORWARD, CLASS_BACKWARD, CLASS_TAP);

    // По тапу: без смещения (fade/scale)
    // По свайпу: со смещением (left/right slide)
    if (source === "swipe") {
      if (toIdx > fromIdx) html.classList.add(CLASS_FORWARD);
      else html.classList.add(CLASS_BACKWARD);
    } else {
      html.classList.add(CLASS_TAP);
    }

    const commit = () => {
      this.updateDOM(viewId);
    };

    const finish = () => {
      this.isTransitioning = false;
      appEl?.classList.remove("is-view-transitioning");
      html.classList.remove(CLASS_FORWARD, CLASS_BACKWARD, CLASS_TAP);
    };

    this.isTransitioning = true;
    appEl?.classList.add("is-view-transitioning");

    if (document.startViewTransition && !prefersReducedMotion()) {
      const transition = document.startViewTransition(commit);
      Promise.resolve(transition.finished)
        .catch(() => {})
        .finally(finish);
    } else {
      commit();
      requestAnimationFrame(() => finish());
    }

    return true;
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
    document.querySelectorAll("[data-nav]").forEach((btn) => {
      const id = btn.getAttribute("data-nav");
      const isActive = id === activeId;

      btn.classList.toggle("is-active", isActive);

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
