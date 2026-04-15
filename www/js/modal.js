import { $ } from "./utils.js?v=VERSION";

/**
 * Класс для централизованного управления всеми модальными окнами в приложении.
 * Поддерживает окна-шторки (bottom-sheet) и окна-предупреждения (alert).
 * Управляет анимациями, доступностью (inert), фокусом и жестами (свайп для закрытия).
 */
class ModalManager {
  constructor() {
    /** @type {Object.<string, Object>} - Хранилище конфигураций всех модальных окон. */
    this.modals = {};
    /** @type {string[]} - Стек активных (открытых) модальных окон. */
    this.activeStack = [];
    /** @type {HTMLElement|null} - Последний активный элемент перед открытием модального окна. */
    this.lastFocusedElement = null;
    /** @type {number|null} - ID таймера для задержки скрытия окна после анимации. */
    this.closeTimeoutId = null;
    
    // Свойства для управления свайпом для закрытия шторок
    /** @type {boolean} */
    this.isDragging = false;
    /** @type {number} */
    this.startY = 0;
    /** @type {number} */
    this.currentY = 0;
    /** @type {HTMLElement|null} - Активное модальное окно, которое перетаскивается. */
    this.activeSheet = null;

    /** @type {HTMLElement|null} - Главный контейнер для всех модальных окон. */
    this.modalContainer = null;
  }

  /**
   * Инициализирует менеджер. Находит все модальные окна по конфигурации,
   * назначает обработчики и связывает глобальные слушатели событий.
   * @param {Array<Object>} config - Массив объектов с конфигурацией модальных окон.
   */
  init(config) {
    this.modalContainer = $("modal-container");
    if (!this.modalContainer) {
      console.error("Modal container with id 'modal-container' not found!");
      return;
    }

    config.forEach((modalConfig) => {
      const modalEl = $(modalConfig.id);
      if (!modalEl) {
        console.warn(`Modal element with id '${modalConfig.id}' not found.`);
        return;
      }
      
      const contentEl = modalConfig.contentId ? $(modalConfig.contentId) : modalEl.firstElementChild;

      this.modals[modalConfig.id] = {
        ...modalConfig,
        el: modalEl,
        overlay: $(modalConfig.overlayId || "bottom-sheet-overlay"),
        content: contentEl,
      };

      // Назначаем обработчик для всех кнопок с атрибутом [data-modal-close] внутри окна.
      modalEl.querySelectorAll("[data-modal-close]").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation(); // Предотвращаем срабатывание других кликов.
          this.close(modalConfig.id);
        });
      });
      
      // Особая логика для окон типа 'alert'
      if (modalConfig.type === "alert") {
        // Закрываем окно по клику на его фон (сам элемент модального окна).
        modalEl.addEventListener('click', () => {
          if (this.activeStack[this.activeStack.length - 1] === modalConfig.id) {
            this.closeCurrent();
          }
        });
        
        // Предотвращаем закрытие при клике на видимую часть контента.
        if (contentEl) {
          contentEl.addEventListener('click', (e) => e.stopPropagation());
        }
      }
    });

    this._bindGlobalListeners();
  }

  /**
   * Переключает атрибут `inert` для всего контента вне контейнера модальных окон.
   * Это делает основной контент недоступным для скринридеров и событий мыши/клавиатуры.
   * @param {boolean} shouldBeInert - Должен ли контент стать "инертным".
   */
  _toggleInert(shouldBeInert) {
    Array.from(document.body.children).forEach((child) => {
      if (child.id !== "modal-container" && child.tagName !== "SCRIPT") {
        child.setAttribute("inert", shouldBeInert ? "" : null);
        child.inert = shouldBeInert; // Для лучшей поддержки
      }
    });
  }

  /**
   * Открывает модальное окно по его ID.
   * @param {string} id - ID модального окна для открытия.
   * @param {Object} [data={}] - Данные, которые можно передать в хук onOpen.
   */
  open(id, data = {}) {
    const modal = this.modals[id];
    if (!modal || this.activeStack.includes(id)) return;

    if (this.closeTimeoutId) {
      clearTimeout(this.closeTimeoutId);
      this.closeTimeoutId = null;
    }

    this.lastFocusedElement = document.activeElement;

    if (this.activeStack.length === 0) {
      this._toggleInert(true);
    }

    // Показываем общий фон для окон-шторок.
    if (modal.type === "bottom-sheet" && modal.overlay) {
      modal.overlay.classList.remove("opacity-0", "pointer-events-none");
      modal.overlay.onclick = () => {
        if (this.activeStack[this.activeStack.length - 1] === id) {
          this.closeCurrent();
        }
      };
    }

    modal.el.classList.remove("hidden");
    modal.el.classList.add("flex");
    modal.el.removeAttribute("inert");
    modal.el.removeAttribute("aria-hidden");

    if (modal.type === "bottom-sheet") {
      modal.el.style.transition = "none";
      modal.el.style.transform = "translateY(100%)";
    }
    
    if (modal.onOpen) {
      modal.onOpen(data);
    }

    // Запускаем анимацию появления.
    requestAnimationFrame(() => {
      if (modal.type === "bottom-sheet") {
        modal.el.style.transition = "transform 400ms cubic-bezier(0.32, 0.72, 0, 1)";
        modal.el.style.transform = "translateY(0%)";
      } else if (modal.type === "alert") {
        modal.el.classList.remove("opacity-0");
        if (modal.content) {
          modal.content.classList.remove("opacity-0", "scale-95");
        }
      }
    });

    this.activeStack.push(id);
  }

  /**
   * Закрывает модальное окно по его ID.
   * @param {string} id - ID модального окна для закрытия.
   */
  close(id) {
    const modal = this.modals[id];
    if (!modal || !this.activeStack.includes(id)) return;

    if (modal.el.contains(document.activeElement)) {
      document.activeElement.blur();
    }

    modal.el.setAttribute("inert", "");
    modal.el.setAttribute("aria-hidden", "true");

    // Запускаем анимацию исчезновения.
    if (modal.type === "bottom-sheet") {
      modal.el.style.transition = "transform 400ms cubic-bezier(0.32, 0.72, 0, 1)";
      modal.el.style.transform = "translateY(100%)";
    } else if (modal.type === "alert") {
      modal.el.classList.add("opacity-0");
      if (modal.content) {
        modal.content.classList.add("opacity-0", "scale-95");
      }
    }

    this.activeStack = this.activeStack.filter((activeId) => activeId !== id);

    const isLastModal = this.activeStack.length === 0;

    // Скрываем фон, если это было последнее активное окно-шторка.
    if (isLastModal && modal.type === "bottom-sheet" && modal.overlay) {
      modal.overlay.classList.add("opacity-0", "pointer-events-none");
      modal.overlay.onclick = null;
    }

    // Скрываем элемент из DOM после завершения анимации.
    this.closeTimeoutId = setTimeout(() => {
        modal.el.classList.add("hidden");
        modal.el.classList.remove("flex");

        if (modal.type === "bottom-sheet") {
          modal.el.style.transition = "";
          modal.el.style.transform = "";
        }
        this.closeTimeoutId = null;

        if (isLastModal) {
          this._toggleInert(false);
          if (this.lastFocusedElement) {
            this.lastFocusedElement.focus();
            this.lastFocusedElement = null;
          }
        }
        if (modal.onClose) {
          modal.onClose();
        }
      },
      modal.type === "bottom-sheet" ? 400 : 300
    );
  }
  
  /**
   * Закрывает самое верхнее (последнее открытое) модальное окно.
   */
  closeCurrent() {
    if (this.activeStack.length > 0) {
      const currentId = this.activeStack[this.activeStack.length - 1];
      this.close(currentId);
    }
  }

  /**
   * Проверяет, есть ли хотя бы одно активное модальное окно.
   * @returns {boolean}
   */
  hasActiveModal() {
    return this.activeStack.length > 0;
  }

  /**
   * Назначает глобальные слушатели событий (клавиатура, жесты).
   * @private
   */
  _bindGlobalListeners() {
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.hasActiveModal()) {
        e.preventDefault();
        this.closeCurrent();
      }
    });

    document.addEventListener("touchstart", (e) => this._handleDragStart(e), { passive: true });
    document.addEventListener("mousedown", (e) => this._handleDragStart(e));
    document.addEventListener("touchmove", (e) => this._handleDragMove(e), { passive: true });
    document.addEventListener("mousemove", (e) => this._handleDragMove(e));
    document.addEventListener("touchend", () => this._handleDragEnd());
    document.addEventListener("mouseup", () => this._handleDragEnd());
    document.addEventListener("mouseleave", () => this._handleDragEnd());
  }

  /**
   * Обрабатывает начало перетаскивания для закрытия окна-шторки.
   * @param {MouseEvent|TouchEvent} e - Событие.
   * @private
   */
  _handleDragStart(e) {
    if (!this.hasActiveModal()) return;

    const currentId = this.activeStack[this.activeStack.length - 1];
    const modal = this.modals[currentId];
    if (!modal || modal.type !== "bottom-sheet") return;

    const handler = $(modal.handlerId);
    if (!handler || !e.target || !handler.contains(e.target)) return;

    this.activeSheet = modal.el;
    this.startY = e.touches ? e.touches[0].clientY : e.clientY;
    this.currentY = this.startY;
    this.isDragging = true;
    this.activeSheet.style.transition = "none";
    if (e.type === "mousedown") e.preventDefault();
  }

  /**
   * Обрабатывает движение при перетаскивании окна.
   * @param {MouseEvent|TouchEvent} e - Событие.
   * @private
   */
  _handleDragMove(e) {
    if (!this.isDragging || !this.activeSheet) return;
    this.currentY = e.touches ? e.touches[0].clientY : e.clientY;
    const deltaY = this.currentY - this.startY;
    if (deltaY > 0) { // Позволяем тянуть только вниз
      this.activeSheet.style.transform = `translateY(${deltaY}px)`;
    }
  }

  /**
   * Обрабатывает окончание перетаскивания.
   * Закрывает окно, если оно было сдвинуто достаточно далеко, или возвращает на место.
   * @private
   */
  _handleDragEnd() {
    if (!this.isDragging || !this.activeSheet) return;
    const deltaY = this.currentY - this.startY;
    if (deltaY > 100) { // Порог для закрытия
      this.closeCurrent();
    } else {
      // Возвращаем на место с анимацией
      this.activeSheet.style.transition = "transform 400ms cubic-bezier(0.32, 0.72, 0, 1)";
      this.activeSheet.style.transform = "translateY(0px)";
      setTimeout(() => {
        if (this.activeSheet) {
          this.activeSheet.style.transition = "";
          this.activeSheet.style.transform = "";
        }
      }, 400);
    }
    this.isDragging = false;
    this.activeSheet = null;
  }
}

// Экспортируем единственный экземпляр класса для использования в других модулях.
export const modalManager = new ModalManager();