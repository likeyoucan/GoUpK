import { $ } from "./utils.js?v=VERSION";
import { themeManager } from "./theme.js?v=VERSION";

export const navigation = {
  /** @type {string[]} Список всех доступных вкладок в порядке их отображения. */
  VIEWS: ["stopwatch", "timer", "tabata", "settings"],
  
  /** @type {string} ID текущей активной вкладки. */
  activeView: "stopwatch",
  
  /** @type {number|null} ID интервала для часов (если они есть). */
  clockInterval: null,

  init() {
    this.activeView = this.VIEWS[0];
    this._updateDOM(this.activeView); // Устанавливаем начальное состояние без анимации
    this._initClock();
  },

  /**
   * Переключает на указанную вкладку с использованием View Transitions API, если доступно.
   * @param {string} viewId - ID целевой вкладки.
   */
  switchView(viewId) {
    if (this.activeView === viewId || !this.VIEWS.includes(viewId)) {
      return;
    }

    const currentIdx = this.VIEWS.indexOf(this.activeView);
    const nextIdx = this.VIEWS.indexOf(viewId);
    
    // Проверка, поддерживается ли API
    if (!document.startViewTransition) {
      this._updateDOM(viewId);
      return;
    }

    // Определяем направление анимации для CSS
    const direction = nextIdx > currentIdx ? "js-nav-forward" : "js-nav-backward";
    document.documentElement.classList.add(direction);

    // Запускаем переход
    const transition = document.startViewTransition(() => this._updateDOM(viewId));

    // Очищаем классы после завершения анимации
    transition.finished.finally(() => {
      document.documentElement.classList.remove(direction);
    });
  },

  /**
   * Обновляет DOM для отображения новой вкладки и скрытия остальных.
   * @param {string} newViewId - ID вкладки, которую нужно показать.
   * @private
   */
  _updateDOM(newViewId) {
    this.activeView = newViewId;

    this.VIEWS.forEach((id) => {
      const el = $(`view-${id}`);
      if (!el) return;

      const isActive = (id === newViewId);
      
      el.classList.toggle("opacity-0", !isActive);
      el.classList.toggle("pointer-events-none", !isActive);
      el.classList.toggle("z-10", isActive);
      
      el.toggleAttribute("aria-hidden", !isActive);
      el.toggleAttribute("inert", !isActive);

      if (isActive && id === "settings") {
        // Выполняем действия, специфичные для активной вкладки
        themeManager.syncSliderUIs();
      }
      
      if (!isActive && el.contains(document.activeElement)) {
        document.activeElement.blur();
      }
    });

    this._updateIcons(newViewId);
  },

  /**
   * Обновляет стили иконок в навигационной панели.
   * @param {string} activeId - ID активной вкладки.
   * @private
   */
  _updateIcons(activeId) {
    this.VIEWS.forEach((id) => {
      const iconDiv = $(`nav-icon-${id}`);
      if (!iconDiv) return;

      const textSpan = iconDiv.nextElementSibling;
      const iconSvg = iconDiv.querySelector("svg");
      const isActive = (id === activeId);

      iconDiv.classList.toggle("primary-text", isActive);
      iconDiv.classList.toggle("app-text-sec", !isActive);
      
      if (textSpan) {
        textSpan.classList.toggle("primary-text", isActive);
        textSpan.classList.toggle("app-text-sec", !isActive);
      }

      if (iconSvg) {
        iconSvg.setAttribute("stroke-width", isActive ? "2" : "1.5");
      }
    });
  },

  /**
   * Инициализирует часы (если элемент #clock существует).
   * @private
   */
  _initClock() {
    const clockEl = $("clock");
    if (!clockEl) return;

    if (this.clockInterval) {
      clearInterval(this.clockInterval);
    }

    const update = () => {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, "0");
      const m = String(now.getMinutes()).padStart(2, "0");
      // Мигающий разделитель
      clockEl.textContent = now.getSeconds() % 2 === 0 ? `${h}:${m}` : `${h} ${m}`;
    };
    
    update(); // Первый вызов, чтобы не ждать секунду
    this.clockInterval = setInterval(update, 1000);
  },
};