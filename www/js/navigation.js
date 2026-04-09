import { $ } from "./utils.js";

export const navigation = {
  activeView: "stopwatch",
  clockInterval: null,

  init() {
    this.initClock();
  },

  switchView(viewId) {
    if (this.activeView === viewId) return;

    if (!document.startViewTransition) {
      this.updateDOM(viewId);
    } else {
      document.startViewTransition(() => {
        this.updateDOM(viewId);
      });
    }
  },

  updateDOM(viewId) {
    this.activeView = viewId;
    ["stopwatch", "timer", "tabata", "settings"].forEach((id) => {
      const el = $(`view-${id}`);
      if (!el) return;
      if (id === viewId) {
        el.classList.remove("opacity-0", "pointer-events-none");
        el.classList.add("z-10");
        el.removeAttribute("aria-hidden");
        el.removeAttribute("inert");
      } else {
        el.classList.add("opacity-0", "pointer-events-none");
        el.classList.remove("z-10");
        el.setAttribute("aria-hidden", "true");
        el.setAttribute("inert", "");
      }
    });
    this.updateIcons(viewId);
  },

  updateIcons(activeId) {
    ["stopwatch", "timer", "tabata", "settings"].forEach((id) => {
      const iconDiv = $(`nav-icon-${id}`);
      if (!iconDiv) return;
      const textSpan = iconDiv.nextElementSibling;
      const iconSvg = iconDiv.querySelector("svg");

      if (id === activeId) {
        iconDiv.classList.remove("text-gray-400");
        iconDiv.classList.add("primary-text");
        if (textSpan) {
          textSpan.classList.remove("text-gray-400");
          textSpan.classList.add("primary-text");
        }
        if (iconSvg) iconSvg.setAttribute("stroke-width", "2.5");
      } else {
        iconDiv.classList.remove("primary-text");
        iconDiv.classList.add("text-gray-400");
        if (textSpan) {
          textSpan.classList.remove("primary-text");
          textSpan.classList.add("text-gray-400");
        }
        if (iconSvg) iconSvg.setAttribute("stroke-width", "2");
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