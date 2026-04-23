import { $ } from "./utils.js?v=VERSION";

// --- Внутренний класс для управления одним модальным окном ---

class Modal {
  constructor(config) {
    this.id = config.id;
    this.el = $(config.id);
    this.type = config.type;
    this.onOpen = config.onOpen;
    this.onClose = config.onClose;
    this.content = config.contentId ? $(config.contentId) : this.el?.firstElementChild;
    this.handler = config.handlerId ? $(config.handlerId) : null;
    this.animationDuration = this.type === 'bottom-sheet' ? 400 : 300;
  }

  show(data) {
    if (!this.el) return;
    
    this.el.classList.remove("hidden");
    this.el.classList.add("flex");
    this.el.removeAttribute("inert");
    this.el.removeAttribute("aria-hidden");
    
    if (this.type === 'bottom-sheet') {
      this.el.style.transition = 'none'; // Убираем анимацию перед перемещением
      this.el.style.transform = 'translateY(100%)';
    }
    
    this.onOpen?.(data);

    requestAnimationFrame(() => {
      if (this.type === 'bottom-sheet') {
        this.el.style.transition = `transform ${this.animationDuration}ms cubic-bezier(0.32, 0.72, 0, 1)`;
        this.el.style.transform = 'translateY(0%)';
      } else if (this.type === 'alert') {
        this.el.classList.remove("opacity-0");
        this.content?.classList.remove("opacity-0", "scale-95");
      }
    });
  }

  hide() {
    if (!this.el) return;

    this.el.setAttribute("inert", "");
    this.el.setAttribute("aria-hidden", "true");

    if (this.type === 'bottom-sheet') {
      this.el.style.transform = 'translateY(100%)';
    } else if (this.type === 'alert') {
      this.el.classList.add("opacity-0");
      this.content?.classList.add("opacity-0", "scale-95");
    }

    setTimeout(() => {
      this.el.classList.add("hidden");
      this.el.classList.remove("flex");

      if (this.type === 'bottom-sheet') {
        this.el.style.transition = '';
        this.el.style.transform = '';
      }

      this.onClose?.();
    }, this.animationDuration);
  }
}

// --- Основной класс-менеджер ---

class ModalManager {
  constructor() {
    /** @type {Object.<string, Modal>} */
    this.modals = {};
    /** @type {string[]} */
    this.activeStack = [];
    this.lastFocusedElement = null;
    this.isDragging = false;
    this.startY = 0;
    this.currentY = 0;
    this.activeSheet = null;
    this.modalContainer = null;
    this.overlay = null;
  }

  init(config) {
    this.modalContainer = $("modal-container");
    this.overlay = $("bottom-sheet-overlay");

    if (!this.modalContainer || !this.overlay) {
      console.error("Modal container or overlay not found!");
      return;
    }

    config.forEach((modalConfig) => {
      if ($(modalConfig.id)) {
        this.modals[modalConfig.id] = new Modal(modalConfig);
      }
    });

    this._bindGlobalListeners();
  }

  open(id, data = {}) {
    const modal = this.modals[id];
    if (!modal || this.activeStack.includes(id)) return;

    if (this.activeStack.length === 0) {
      this.lastFocusedElement = document.activeElement;
      this._toggleInert(true);
    }
    
    this.modalContainer.classList.add("active");
    if (modal.type === "bottom-sheet") {
        this.overlay.classList.remove("opacity-0", "pointer-events-none");
    }

    modal.show(data);
    this.activeStack.push(id);
  }

  close(id) {
    const modal = this.modals[id];
    if (!modal || !this.activeStack.includes(id)) return;

    modal.hide();

    this.activeStack = this.activeStack.filter((activeId) => activeId !== id);

    if (this.activeStack.length === 0) {
      this.overlay.classList.add("opacity-0", "pointer-events-none");
      this.modalContainer.classList.remove("active");

      setTimeout(() => {
        this._toggleInert(false);
        this.lastFocusedElement?.focus();
        this.lastFocusedElement = null;
      }, modal.animationDuration);
    }
  }

  closeCurrent() {
    if (this.activeStack.length > 0) {
      const currentId = this.activeStack[this.activeStack.length - 1];
      this.close(currentId);
    }
  }

  hasActiveModal() {
    return this.activeStack.length > 0;
  }
  
  _toggleInert(shouldBeInert) {
    const mainContent = document.querySelector("#app > .app-bg");
    if (mainContent) mainContent.inert = shouldBeInert;
  }

  _bindGlobalListeners() {
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.hasActiveModal()) {
        e.preventDefault();
        this.closeCurrent();
      }
    });
    
    this.overlay.addEventListener("click", () => this.closeCurrent());

    document.querySelectorAll("[data-modal-close]").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            this.closeCurrent();
        });
    });

    document.addEventListener("touchstart", (e) => this._handleDragStart(e), { passive: true });
    document.addEventListener("touchmove", (e) => this._handleDragMove(e), { passive: false });
    document.addEventListener("touchend", () => this._handleDragEnd());
  }

  _handleDragStart(e) {
    if (!this.hasActiveModal()) return;

    const currentId = this.activeStack[this.activeStack.length - 1];
    const modal = this.modals[currentId];
    if (modal?.type !== "bottom-sheet" || !modal.handler?.contains(e.target)) return;

    this.activeSheet = modal.el;
    this.startY = e.touches[0].clientY;
    this.currentY = this.startY;
    this.isDragging = true;
    this.activeSheet.style.transition = "none";
  }

  _handleDragMove(e) {
    if (!this.isDragging || !this.activeSheet) return;
    
    e.preventDefault();
    this.currentY = e.touches[0].clientY;
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
      this.activeSheet.style.transition = `transform 400ms cubic-bezier(0.32, 0.72, 0, 1)`;
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