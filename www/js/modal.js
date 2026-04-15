// modal.js

import { $ } from "./utils.js?v=VERSION";

class ModalManager {
  constructor() {
    this.modals = {};
    this.activeStack = [];
    this.lastFocusedElement = null;
    this.closeTimeoutId = null;
    this.isDragging = false;
    this.startY = 0;
    this.currentY = 0;
    this.activeSheet = null;
  }

  /**
   * Инициализирует менеджер с конфигурацией модальных окон.
   * @param {Array<object>} config - Массив объектов конфигурации.
   */
  init(config) {
    const mainAppContainer = $("app");

    config.forEach(modalConfig => {
      const modalEl = $(modalConfig.id);
      if (!modalEl) return;

      this.modals[modalConfig.id] = {
        ...modalConfig,
        el: modalEl,
        overlay: $(modalConfig.overlayId || 'bottom-sheet-overlay'),
        content: modalConfig.contentId ? $(modalConfig.contentId) : modalEl.firstElementChild,
      };

      // Добавляем обработчики на кнопки закрытия внутри модалки
      modalEl.querySelectorAll('[data-modal-close]').forEach(btn => {
        btn.addEventListener('click', () => this.close(modalConfig.id));
      });
    });

    this._bindGlobalListeners(mainAppContainer);
  }

  /**
   * Открывает модальное окно по его ID.
   * @param {string} id - ID модального окна.
   * @param {object} [data] - Дополнительные данные для передачи в onOpen.
   */
  open(id, data = {}) {
    const modal = this.modals[id];
    if (!modal || this.activeStack.includes(id)) return;

    if (this.closeTimeoutId) {
      clearTimeout(this.closeTimeoutId);
      this.closeTimeoutId = null;
    }

    this.lastFocusedElement = document.activeElement;
    const isFirstModal = this.activeStack.length === 0;
    if(isFirstModal) {
      $("app").setAttribute('inert', '');
    }

    if (modal.overlay) {
      modal.overlay.classList.remove('opacity-0', 'pointer-events-none');
      // Закрытие по клику на оверлей только для самого верхнего окна
      modal.overlay.onclick = () => {
        if (this.activeStack[this.activeStack.length - 1] === id) {
          this.closeCurrent();
        }
      };
    }
    
    modal.el.classList.remove('hidden');
    modal.el.classList.add(modal.type === 'alert' ? 'flex' : 'flex');
    modal.el.removeAttribute('inert');
    modal.el.removeAttribute('aria-hidden');

    // Анимация
    if (modal.type === 'bottom-sheet') {
      modal.el.style.transition = 'none';
      modal.el.style.transform = 'translateY(100%)';
    }

    // Вызываем колбэк перед анимацией
    if (modal.onOpen) {
      modal.onOpen(data);
    }

    requestAnimationFrame(() => {
      if (modal.type === 'bottom-sheet') {
        modal.el.style.transition = 'transform 400ms cubic-bezier(0.32, 0.72, 0, 1)';
        modal.el.style.transform = 'translateY(0%)';
      } else if (modal.type === 'alert') {
        modal.el.classList.remove('opacity-0');
        if (modal.content) {
            modal.content.classList.remove('opacity-0', 'scale-95');
        }
      }
    });

    this.activeStack.push(id);
  }

  /**
   * Закрывает модальное окно по его ID.
   * @param {string} id - ID модального окна.
   */
  close(id) {
    const modal = this.modals[id];
    if (!modal || !this.activeStack.includes(id)) return;

    if (modal.el.contains(document.activeElement)) {
      document.activeElement.blur();
    }

    modal.el.setAttribute('inert', '');
    modal.el.setAttribute('aria-hidden', 'true');

    if (modal.type === 'bottom-sheet') {
      modal.el.style.transition = 'transform 400ms cubic-bezier(0.32, 0.72, 0, 1)';
      modal.el.style.transform = 'translateY(100%)';
    } else if (modal.type === 'alert') {
      modal.el.classList.add('opacity-0');
       if (modal.content) {
            modal.content.classList.add('opacity-0', 'scale-95');
        }
    }

    this.activeStack = this.activeStack.filter(activeId => activeId !== id);

    const isLastModal = this.activeStack.length === 0;
    if (isLastModal && modal.overlay) {
        modal.overlay.classList.add('opacity-0', 'pointer-events-none');
        modal.overlay.onclick = null;
    }

    this.closeTimeoutId = setTimeout(() => {
      modal.el.classList.add('hidden');
      modal.el.classList.remove(modal.type === 'alert' ? 'flex' : 'flex');
      if (modal.type === 'bottom-sheet') {
        modal.el.style.transition = '';
        modal.el.style.transform = '';
      }
      this.closeTimeoutId = null;

      if (isLastModal) {
         $("app").removeAttribute('inert');
        if (this.lastFocusedElement) {
          this.lastFocusedElement.focus();
          this.lastFocusedElement = null;
        }
      }
      
      if (modal.onClose) {
        modal.onClose();
      }

    }, modal.type === 'bottom-sheet' ? 400 : 300);
  }

  /** Закрывает самое верхнее активное модальное окно. */
  closeCurrent() {
    if (this.activeStack.length > 0) {
      const currentId = this.activeStack[this.activeStack.length - 1];
      this.close(currentId);
    }
  }

  /** Проверяет, открыто ли хоть одно модальное окно. */
  hasActiveModal() {
    return this.activeStack.length > 0;
  }

  _bindGlobalListeners(mainAppContainer) {
    // Обработчик Escape и системной кнопки "назад"
    const backButtonHandler = (e) => {
        if (this.hasActiveModal()) {
            if(e) e.preventDefault(); // Для Escape
            this.closeCurrent();
            return true; // Сигнал для Capacitor, что действие обработано
        }
        return false;
    };
    
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') backButtonHandler(e);
    });

    if (window.Capacitor && window.Capacitor.isNativePlatform()) {
        const { App } = window.Capacitor.Plugins;
        if(App) {
            App.addListener('backButton', ({canGoBack}) => {
                if(!canGoBack) {
                    App.minimizeApp();
                } else if (!backButtonHandler()) {
                    // Если модалок нет, делаем стандартное действие (например, на главный экран)
                    // Ваша логика перехода на главный экран
                    if(navigation.activeView !== 'stopwatch') {
                       navigation.switchView('stopwatch');
                    } else {
                       App.minimizeApp();
                    }
                }
            });
        }
    }


    // Обработчики свайпа для закрытия
    document.addEventListener('touchstart', (e) => this._handleDragStart(e), { passive: true });
    document.addEventListener('mousedown', (e) => this._handleDragStart(e));

    document.addEventListener('touchmove', (e) => this._handleDragMove(e), { passive: true });
    document.addEventListener('mousemove', (e) => this._handleDragMove(e));
    
    document.addEventListener('touchend', () => this._handleDragEnd());
    document.addEventListener('mouseup', () => this._handleDragEnd());
    document.addEventListener('mouseleave', () => this._handleDragEnd());
  }

  _handleDragStart(e) {
    if (!this.hasActiveModal()) return;
    const currentId = this.activeStack[this.activeStack.length - 1];
    const modal = this.modals[currentId];
    if (modal.type !== 'bottom-sheet') return;
    
    const handler = $(modal.handlerId);
    if (!handler || !handler.contains(e.target)) return;

    this.activeSheet = modal.el;
    this.startY = e.touches ? e.touches[0].clientY : e.clientY;
    this.currentY = this.startY;
    this.isDragging = true;
    this.activeSheet.style.transition = "none";
    if (e.type === 'mousedown') e.preventDefault();
  }

  _handleDragMove(e) {
    if (!this.isDragging || !this.activeSheet) return;

    this.currentY = e.touches ? e.touches[0].clientY : e.clientY;
    const deltaY = this.currentY - this.startY;

    if (deltaY > 0) {
      this.activeSheet.style.transform = `translateY(${deltaY}px)`;
    }
  }

  _handleDragEnd() {
    if (!this.isDragging || !this.activeSheet) return;

    const deltaY = this.currentY - this.startY;
    
    if (deltaY > 100) {
      this.closeCurrent();
    } else {
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

export const modalManager = new ModalManager();