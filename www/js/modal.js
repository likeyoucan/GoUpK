// Файл: www/js/modal.js

import { $ } from "./utils.js?v=VERSION";

class ModalManager {
  constructor() {
    this.modals = {};
    this.activeStack = [];
    this.lastFocusedElement = null;
    this.closeTimeouts = {};
    this.isDragging = false;
    this.startY = 0;
    this.currentY = 0;
    this.activeSheet = null;
    this.modalContainer = null;

    this._listenersBound = false;
    this._onKeydown = null;
    this._onTouchStart = null;
    this._onMouseDown = null;
    this._onTouchMove = null;
    this._onMouseMove = null;
    this._onTouchEnd = null;
    this._onMouseUp = null;
    this._onMouseLeave = null;
  }

  init(config) {
    if (this._listenersBound) {
      this.destroy();
    }

    this.modalContainer = $("modal-container");
    if (!this.modalContainer) {
      console.error("Modal container with id 'modal-container' not found!");
      return;
    }

    this.modals = {};
    this.activeStack = [];
    this.closeTimeouts = {};

    config.forEach((modalConfig) => {
      const modalEl = $(modalConfig.id);
      if (!modalEl) return;

      const contentEl = modalConfig.contentId
        ? $(modalConfig.contentId)
        : modalEl.firstElementChild;

      this.modals[modalConfig.id] = {
        ...modalConfig,
        el: modalEl,
        overlay: $(modalConfig.overlayId),
        content: contentEl,
      };

      modalEl.querySelectorAll("[data-modal-close]").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          this.close(modalConfig.id);
        });
      });

      if (modalConfig.type === "alert") {
        modalEl.addEventListener("click", () => {
          if (
            this.activeStack[this.activeStack.length - 1] === modalConfig.id
          ) {
            this.closeCurrent();
          }
        });

        if (contentEl) {
          contentEl.addEventListener("click", (e) => e.stopPropagation());
        }
      }
    });

    this._bindGlobalListeners();
  }

  _toggleInert(shouldBeInert) {
    const appEl = $("app");
    if (appEl) {
      const mainContent = appEl.querySelector(".app-bg");
      if (mainContent) mainContent.inert = shouldBeInert;
    }
  }

  open(id, data = {}) {
    const modal = this.modals[id];
    if (!modal || this.activeStack.includes(id)) return;

    if (this.closeTimeouts[id]) {
      clearTimeout(this.closeTimeouts[id]);
      this.closeTimeouts[id] = null;
      modal.el.classList.remove("hidden");
      modal.el.classList.add("flex");
    }

    this.modalContainer.classList.add("active");
    this.lastFocusedElement = document.activeElement;

    if (this.activeStack.length === 0) {
      this._toggleInert(true);
    }

    if (modal.type === "bottom-sheet") {
      const overlay = $("bottom-sheet-overlay");
      if (overlay) {
        overlay.classList.remove("opacity-0");
        overlay.onclick = () => {
          if (this.activeStack[this.activeStack.length - 1] === id) {
            this.closeCurrent();
          }
        };
      }
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

    requestAnimationFrame(() => {
      if (modal.type === "bottom-sheet") {
        modal.el.style.transition =
          "transform 400ms cubic-bezier(0.32, 0.72, 0, 1)";
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

  close(id) {
    const modal = this.modals[id];
    if (!modal || !this.activeStack.includes(id)) return;

    if (this.closeTimeouts[id]) {
      clearTimeout(this.closeTimeouts[id]);
      this.closeTimeouts[id] = null;
    }

    if (modal.el.contains(document.activeElement)) {
      document.activeElement.blur();
    }

    modal.el.setAttribute("inert", "");
    modal.el.setAttribute("aria-hidden", "true");

    if (modal.type === "bottom-sheet") {
      modal.el.style.transition =
        "transform 400ms cubic-bezier(0.32, 0.72, 0, 1)";
      modal.el.style.transform = "translateY(100%)";
    } else if (modal.type === "alert") {
      modal.el.classList.add("opacity-0");
      if (modal.content) {
        modal.content.classList.add("opacity-0", "scale-95");
      }
    }

    this.activeStack = this.activeStack.filter((activeId) => activeId !== id);
    const isLastModal = this.activeStack.length === 0;

    if (isLastModal) {
      const overlay = $("bottom-sheet-overlay");
      if (overlay) {
        overlay.classList.add("opacity-0");
        overlay.onclick = null;
      }
      this.modalContainer.classList.remove("active");
    }

    const delay = modal.type === "bottom-sheet" ? 400 : 300;

    this.closeTimeouts[id] = setTimeout(() => {
      if (this.activeStack.includes(id)) {
        this.closeTimeouts[id] = null;
        return;
      }

      modal.el.classList.add("hidden");
      modal.el.classList.remove("flex");

      if (modal.type === "bottom-sheet") {
        modal.el.style.transition = "";
        modal.el.style.transform = "";
      }

      this.closeTimeouts[id] = null;

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
    }, delay);
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

  _bindGlobalListeners() {
    if (this._listenersBound) return;

    this._onKeydown = (e) => {
      if (e.key === "Escape" && this.hasActiveModal()) {
        e.preventDefault();
        this.closeCurrent();
      }
    };

    this._onTouchStart = (e) => this._handleDragStart(e);
    this._onMouseDown = (e) => this._handleDragStart(e);
    this._onTouchMove = (e) => this._handleDragMove(e);
    this._onMouseMove = (e) => this._handleDragMove(e);
    this._onTouchEnd = () => this._handleDragEnd();
    this._onMouseUp = () => this._handleDragEnd();
    this._onMouseLeave = () => this._handleDragEnd();

    document.addEventListener("keydown", this._onKeydown);
    document.addEventListener("touchstart", this._onTouchStart, {
      passive: true,
    });
    document.addEventListener("mousedown", this._onMouseDown);
    document.addEventListener("touchmove", this._onTouchMove, {
      passive: true,
    });
    document.addEventListener("mousemove", this._onMouseMove);
    document.addEventListener("touchend", this._onTouchEnd);
    document.addEventListener("mouseup", this._onMouseUp);
    document.addEventListener("mouseleave", this._onMouseLeave);

    this._listenersBound = true;
  }

  destroy() {
    Object.keys(this.closeTimeouts).forEach((id) => {
      if (this.closeTimeouts[id]) {
        clearTimeout(this.closeTimeouts[id]);
        this.closeTimeouts[id] = null;
      }
    });

    if (!this._listenersBound) return;

    document.removeEventListener("keydown", this._onKeydown);
    document.removeEventListener("touchstart", this._onTouchStart);
    document.removeEventListener("mousedown", this._onMouseDown);
    document.removeEventListener("touchmove", this._onTouchMove);
    document.removeEventListener("mousemove", this._onMouseMove);
    document.removeEventListener("touchend", this._onTouchEnd);
    document.removeEventListener("mouseup", this._onMouseUp);
    document.removeEventListener("mouseleave", this._onMouseLeave);

    this._listenersBound = false;
    this._onKeydown = null;
    this._onTouchStart = null;
    this._onMouseDown = null;
    this._onTouchMove = null;
    this._onMouseMove = null;
    this._onTouchEnd = null;
    this._onMouseUp = null;
    this._onMouseLeave = null;
  }

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
      this.activeSheet.style.transition =
        "transform 400ms cubic-bezier(0.32, 0.72, 0, 1)";
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
