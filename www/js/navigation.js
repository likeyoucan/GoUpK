// Файл: www/js/navigation.js

import { $ } from "./utils.js?v=VERSION";
import { themeManager } from "./theme.js?v=VERSION";

const VIEWS = ["stopwatch", "timer", "tabata", "settings"];

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function createOverlay(direction) {
  const overlay = document.createElement("div");
  overlay.className = `nav-solid-overlay ${
    direction === "left" ? "nav-solid-in-left" : "nav-solid-in-right"
  }`;
  overlay.setAttribute("aria-hidden", "true");
  return overlay;
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
    const viewsContainer = $("viewsContainer");
    const appEl = $("app");
    if (!viewsContainer) {
      this.updateDOM(viewId, { instant: true });
      return true;
    }

    this.isTransitioning = true;
    appEl?.classList.add("is-view-transitioning");

    // cleanup старых оверлеев
    viewsContainer
      .querySelectorAll(".nav-solid-overlay")
      .forEach((n) => n.remove());

    if (source === "tap") {
      // Тап: обычный fade-in нового экрана (быстро и стабильно)
      const nextEl = $(`view-${viewId}`);
      if (nextEl) {
        nextEl.classList.add("nav-tap-in");
      }

      this.updateDOM(viewId, { instant: true });

      this.updateIcons(viewId);

      const finish = () => {
        nextEl?.classList.remove("nav-tap-in");
        this.isTransitioning = false;
        appEl?.classList.remove("is-view-transitioning");
      };

      if (nextEl) {
        let done = false;
        const onEnd = () => {
          if (done) return;
          done = true;
          nextEl.removeEventListener("animationend", onEnd);
          finish();
        };
        nextEl.addEventListener("animationend", onEnd, { once: true });
        setTimeout(onEnd, 320);
      } else {
        setTimeout(finish, 200);
      }

      return true;
    }

    // SWIPE: только solid overlay + мгновенный switch
    const fromIdx = VIEWS.indexOf(fromId);
    const toIdx = VIEWS.indexOf(viewId);
    const direction = toIdx > fromIdx ? "left" : "right";
    const overlay = createOverlay(direction);
    viewsContainer.appendChild(overlay);

    // Мгновенно переключаем реальный экран под оверлеем
    this.updateDOM(viewId, { instant: true });
    this.updateIcons(viewId);

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      overlay.remove();
      this.isTransitioning = false;
      appEl?.classList.remove("is-view-transitioning");

      if (viewId === "settings") {
        themeManager.syncSliderUIs();
      }
    };

    overlay.addEventListener("animationend", finish, { once: true });
    setTimeout(finish, 420);

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
