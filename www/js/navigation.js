// ===== navigation.js (ОБНОВЛЕННАЯ ВЕРСИЯ) =====

import { $ } from "./utils.js";

export const navigation = {
  activeView: "stopwatch",
  navIds: [], // НОВОЕ: Кэшируем ID вкладок

  init() {
    // НОВОЕ: Получаем ID всех вкладок при инициализации
    this.navIds = Array.from(document.querySelectorAll("[data-nav]")).map(
      (btn) => btn.dataset.nav
    );
    this.updateIcons(this.activeView);
    // УДАЛЕНО: Вызов this.initClock()
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
    // ИЗМЕНЕНО: Используем динамический список
    this.navIds.forEach((id) => {
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
    // ИЗМЕНЕНО: Используем динамический список
    this.navIds.forEach((id) => {
      const iconDiv = $(`nav-icon-${id}`);
      if (!iconDiv) return;
      // ИЗМЕНЕНО: Более надежный селектор
      const textSpan = iconDiv.parentElement.querySelector("span");
      const iconSvg = iconDiv.querySelector("svg");

      if (!textSpan || !iconSvg) return;

      if (id === activeId) {
        iconDiv.classList.replace("text-gray-400", "primary-text");
        textSpan.classList.replace("text-gray-400", "primary-text");
        iconSvg.classList.add("stroke-2");
      } else {
        iconDiv.classList.replace("primary-text", "text-gray-400");
        textSpan.classList.replace("primary-text", "text-gray-400");
        iconSvg.classList.remove("stroke-2");
      }
    });
  },
  
  // УДАЛЕНО: Метод initClock()
};