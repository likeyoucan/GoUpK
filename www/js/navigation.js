// navigation.js

import { $ } from "./utils.js?v=VERSION";

export const navigation = {
  activeView: "stopwatch",
  clockInterval: null,

  init() {
    this.initClock();
    // Инициализируем иконки при запуске
    this.updateIcons(this.activeView);
  },

  switchView(viewId, direction = 'forward') {
    if (this.activeView === viewId) return;

    // Используем View Transitions API, если оно доступно
    if (!document.startViewTransition) {
      this.updateDOM(viewId);
      return;
    }

    const html = document.documentElement;

    // Добавляем класс для направления анимации
    html.classList.add(direction === 'forward' ? 'js-nav-forward' : 'js-nav-backward');

    const transition = document.startViewTransition(() => {
      this.updateDOM(viewId);
    });

    // Очищаем класс после завершения анимации
    transition.finished.then(() => {
      html.classList.remove('js-nav-forward', 'js-nav-backward');
    });
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

      // Более надежный способ найти связанный текстовый элемент
      const navButton = iconDiv.closest('.nav-btn');
      const textSpan = navButton ? navButton.querySelector('span') : null;
      const iconSvg = iconDiv.querySelector("svg");

      const isActive = id === activeId;

      iconDiv.classList.toggle("primary-text", isActive);
      iconDiv.classList.toggle("app-text-sec", !isActive);
      iconDiv.classList.toggle("opacity-70", !isActive);

      if (textSpan) {
        textSpan.classList.toggle("primary-text", isActive);
        textSpan.classList.toggle("app-text-sec", !isActive);
      }
      if (iconSvg) {
        iconSvg.setAttribute("stroke-width", isActive ? "2.5" : "2");
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