import { $ } from "./utils.js";

export const navigation = {
  activeView: "stopwatch",
  clockInterval: null,

  init() {
    this.initClock();
  },

  switchView(viewId) {
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
        iconDiv.classList.replace("text-gray-400", "primary-text");
        textSpan.classList.replace("text-gray-400", "primary-text");
        if (iconSvg) iconSvg.classList.add("stroke-2");
      } else {
        iconDiv.classList.replace("primary-text", "text-gray-400");
        textSpan.classList.replace("primary-text", "text-gray-400");
        if (iconSvg) iconSvg.classList.remove("stroke-2");
      }
    });
  },

  initClock() {
    const clockEl = $("clock");
    if (!clockEl) return;
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
