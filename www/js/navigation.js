// Файл: js/navigation.js

import { $ } from "./utils.js?v=VERSION";
import { themeManager } from "./theme.js?v=VERSION";

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
    document.querySelectorAll(".nav-btn").forEach((btn) => {
      const id = btn.dataset.nav;
      const textSpan = btn.querySelector("span");

      // Просто переключаем один класс на родительской кнопке
      const isActive = id === activeId;
      btn.classList.toggle("is-active", isActive);

      // Цвет текста под иконкой по-прежнему управляем классами
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
