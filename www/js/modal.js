// Файл: www/js/modal.js

import { $ } from "./utils.js?v=VERSION";

class ModalManager {
  constructor() {
    this.modals = {};
    this.activeStack = [];
    this.lastFocusedElement = null;
    this.closeTimeouts = {};
    this.modalContainer = null;

    this._escBound = false;
    this._onKeydown = null;

    this._sheetOverlayEl = null;
    this._sheetOverlayClickHandler = null;

    // Drag state (bottom-sheet only)
    this.drag = {
      active: false,
      started: false,
      pointerType: null, // "touch" | "mouse"
      startY: 0,
      currentY: 0,
      deltaY: 0,
      threshold: 8,
      sheetEl: null,
      modalId: null,
    };

    this._onDragMove = null;
    this._onDragEnd = null;
    this._boundHandlerStart = new Map(); // modalId -> { touchStart, mouseDown }
  }

  init(config) {
    this.destroy();

    this.modalContainer = $("modal-container");
    if (!this.modalContainer) {
      console.error("Modal container with id 'modal-container' not found.");
      return;
    }

    this.modals = {};
    this.activeStack = [];
    this.closeTimeouts = {};
    this.lastFocusedElement = null;
    this._sheetOverlayEl = $("bottom-sheet-overlay");

    config.forEach((modalConfig) => {
      const modalEl = $(modalConfig.id);
      if (!modalEl) return;

      const contentEl = modalConfig.contentId
        ? $(modalConfig.contentId)
        : modalEl.firstElementChild;

      this.modals[modalConfig.id] = {
        ...modalConfig,
        el: modalEl,
        content: contentEl,
        handlerEl: modalConfig.handlerId ? $(modalConfig.handlerId) : null,
      };

      modalEl.querySelectorAll("[data-modal-close]").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          this.close(modalConfig.id);
        });
      });

      if (modalConfig.type === "alert") {
        modalEl.addEventListener("click", () => {
          if (this._getTopModalId() === modalConfig.id) {
            this.closeCurrent();
          }
        });

        if (contentEl) {
          contentEl.addEventListener("click", (e) => e.stopPropagation());
        }
      }
    });

    this._bindBottomSheetStartListeners();
  }

  destroy() {
    Object.keys(this.closeTimeouts).forEach((id) => {
      if (this.closeTimeouts[id]) {
        clearTimeout(this.closeTimeouts[id]);
        this.closeTimeouts[id] = null;
      }
    });

    this._removeEscListener();
    this._detachOverlayClickHandler();
    this._removeDocumentDragListeners();
    this._unbindBottomSheetStartListeners();
    this._resetDragState();

    this.activeStack = [];
    this.lastFocusedElement = null;
    this.modals = {};
    this.closeTimeouts = {};
  }

  hasActiveModal() {
    return this.activeStack.length > 0;
  }

  closeCurrent() {
    const currentId = this._getTopModalId();
    if (currentId) this.close(currentId);
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

    modal.el.classList.remove("hidden");
    modal.el.classList.add("flex");
    modal.el.removeAttribute("inert");
    modal.el.removeAttribute("aria-hidden");

    if (modal.type === "bottom-sheet") {
      modal.el.style.transition = "none";
      modal.el.style.transform = "translateY(100%)";
      this._attachOverlayClickHandlerFor(modal.id);
    }

    if (typeof modal.onOpen === "function") {
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
    this._syncGlobalListeners();
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
    this._syncGlobalListeners();

    const isLastModal = this.activeStack.length === 0;
    const delay = modal.type === "bottom-sheet" ? 400 : 300;

    if (isLastModal) {
      this._detachOverlayClickHandler();
      this._hideBottomSheetOverlay();
      this.modalContainer.classList.remove("active");
    } else {
      const top = this._getTopModal();
      if (top?.type === "bottom-sheet") {
        this._attachOverlayClickHandlerFor(top.id);
      } else {
        this._detachOverlayClickHandler();
        this._hideBottomSheetOverlay();
      }
    }

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
        if (this.lastFocusedElement && this.lastFocusedElement.focus) {
          this.lastFocusedElement.focus();
        }
        this.lastFocusedElement = null;
      }

      if (typeof modal.onClose === "function") {
        modal.onClose();
      }
    }, delay);
  }

  _getTopModalId() {
    return this.activeStack[this.activeStack.length - 1] || null;
  }

  _getTopModal() {
    const id = this._getTopModalId();
    return id ? this.modals[id] : null;
  }

  _toggleInert(shouldBeInert) {
    const appEl = $("app");
    if (!appEl) return;
    const mainContent = appEl.querySelector(".app-bg");
    if (mainContent) mainContent.inert = shouldBeInert;
  }

  _syncGlobalListeners() {
    if (this.hasActiveModal()) this._ensureEscListener();
    else this._removeEscListener();

    // Если активный top modal не bottom-sheet, гасим drag-state.
    const top = this._getTopModal();
    if (!top || top.type !== "bottom-sheet") {
      this._removeDocumentDragListeners();
      this._resetDragState();
    }
  }

  _ensureEscListener() {
    if (this._escBound) return;

    this._onKeydown = (e) => {
      if (e.key === "Escape" && this.hasActiveModal()) {
        e.preventDefault();
        this.closeCurrent();
      }
    };

    document.addEventListener("keydown", this._onKeydown);
    this._escBound = true;
  }

  _removeEscListener() {
    if (!this._escBound) return;
    document.removeEventListener("keydown", this._onKeydown);
    this._onKeydown = null;
    this._escBound = false;
  }

  _showBottomSheetOverlay() {
    if (!this._sheetOverlayEl) return;
    this._sheetOverlayEl.classList.remove("opacity-0");
    this._sheetOverlayEl.removeAttribute("aria-hidden");
  }

  _hideBottomSheetOverlay() {
    if (!this._sheetOverlayEl) return;
    this._sheetOverlayEl.classList.add("opacity-0");
    this._sheetOverlayEl.setAttribute("aria-hidden", "true");
  }

  _attachOverlayClickHandlerFor(modalId) {
    if (!this._sheetOverlayEl) return;

    this._showBottomSheetOverlay();
    this._detachOverlayClickHandler();

    this._sheetOverlayClickHandler = () => {
      if (this._getTopModalId() === modalId) {
        this.closeCurrent();
      }
    };

    this._sheetOverlayEl.addEventListener(
      "click",
      this._sheetOverlayClickHandler,
    );
  }

  _detachOverlayClickHandler() {
    if (!this._sheetOverlayEl || !this._sheetOverlayClickHandler) return;
    this._sheetOverlayEl.removeEventListener(
      "click",
      this._sheetOverlayClickHandler,
    );
    this._sheetOverlayClickHandler = null;
  }

  _bindBottomSheetStartListeners() {
    this._unbindBottomSheetStartListeners();

    Object.values(this.modals).forEach((modal) => {
      if (modal.type !== "bottom-sheet" || !modal.handlerEl) return;

      const touchStart = (e) => this._handleDragStart(e, modal.id, "touch");
      const mouseDown = (e) => this._handleDragStart(e, modal.id, "mouse");

      modal.handlerEl.addEventListener("touchstart", touchStart, {
        passive: true,
      });
      modal.handlerEl.addEventListener("mousedown", mouseDown);

      this._boundHandlerStart.set(modal.id, { touchStart, mouseDown });
    });
  }

  _unbindBottomSheetStartListeners() {
    this._boundHandlerStart.forEach((handlers, modalId) => {
      const modal = this.modals[modalId];
      if (!modal?.handlerEl) return;

      modal.handlerEl.removeEventListener("touchstart", handlers.touchStart);
      modal.handlerEl.removeEventListener("mousedown", handlers.mouseDown);
    });

    this._boundHandlerStart.clear();
  }

  _handleDragStart(e, modalId, pointerType) {
    const topId = this._getTopModalId();
    if (!topId || topId !== modalId) return;

    const modal = this.modals[modalId];
    if (!modal || modal.type !== "bottom-sheet") return;

    const sheet = modal.el;
    if (!sheet || sheet.classList.contains("hidden")) return;

    const y = pointerType === "touch" ? e.touches?.[0]?.clientY : e.clientY;
    if (typeof y !== "number") return;

    // Уже идёт drag — игнорируем.
    if (this.drag.active) return;

    this.drag.active = true;
    this.drag.started = false;
    this.drag.pointerType = pointerType;
    this.drag.startY = y;
    this.drag.currentY = y;
    this.drag.deltaY = 0;
    this.drag.sheetEl = sheet;
    this.drag.modalId = modalId;

    sheet.style.transition = "none";
    this._addDocumentDragListeners(pointerType);

    if (pointerType === "mouse") {
      e.preventDefault();
    }
  }

  _addDocumentDragListeners(pointerType) {
    this._removeDocumentDragListeners();

    this._onDragMove = (e) => this._handleDragMove(e);
    this._onDragEnd = () => this._handleDragEnd();

    if (pointerType === "touch") {
      document.addEventListener("touchmove", this._onDragMove, {
        passive: true,
      });
      document.addEventListener("touchend", this._onDragEnd);
      document.addEventListener("touchcancel", this._onDragEnd);
    } else {
      document.addEventListener("mousemove", this._onDragMove);
      document.addEventListener("mouseup", this._onDragEnd);
      document.addEventListener("mouseleave", this._onDragEnd);
      window.addEventListener("blur", this._onDragEnd);
    }
  }

  _removeDocumentDragListeners() {
    if (this._onDragMove) {
      document.removeEventListener("touchmove", this._onDragMove);
      document.removeEventListener("mousemove", this._onDragMove);
      this._onDragMove = null;
    }

    if (this._onDragEnd) {
      document.removeEventListener("touchend", this._onDragEnd);
      document.removeEventListener("touchcancel", this._onDragEnd);
      document.removeEventListener("mouseup", this._onDragEnd);
      document.removeEventListener("mouseleave", this._onDragEnd);
      window.removeEventListener("blur", this._onDragEnd);
      this._onDragEnd = null;
    }
  }

  _handleDragMove(e) {
    if (!this.drag.active || !this.drag.sheetEl) return;

    let y;
    if (this.drag.pointerType === "touch") {
      y = e.touches?.[0]?.clientY;
    } else {
      y = e.clientY;
    }

    if (typeof y !== "number") return;

    this.drag.currentY = y;
    this.drag.deltaY = this.drag.currentY - this.drag.startY;

    // Жест вверх игнорируем, но drag остаётся активным до завершения.
    if (this.drag.deltaY <= 0) return;

    if (!this.drag.started && this.drag.deltaY < this.drag.threshold) return;

    this.drag.started = true;
    this.drag.sheetEl.style.transform = `translateY(${this.drag.deltaY}px)`;
  }

  _handleDragEnd() {
    if (!this.drag.active || !this.drag.sheetEl) {
      this._removeDocumentDragListeners();
      this._resetDragState();
      return;
    }

    const { sheetEl, deltaY, started, modalId } = this.drag;
    const shouldClose = started && deltaY > 100;

    this._removeDocumentDragListeners();

    if (shouldClose && this._getTopModalId() === modalId) {
      this.closeCurrent();
      this._resetDragState();
      return;
    }

    // Возвращаем шторку назад, если не закрываем.
    sheetEl.style.transition = "transform 400ms cubic-bezier(0.32, 0.72, 0, 1)";
    sheetEl.style.transform = "translateY(0px)";

    setTimeout(() => {
      if (!sheetEl.classList.contains("hidden")) {
        sheetEl.style.transition = "";
        sheetEl.style.transform = "";
      }
    }, 400);

    this._resetDragState();
  }

  _resetDragState() {
    this.drag.active = false;
    this.drag.started = false;
    this.drag.pointerType = null;
    this.drag.startY = 0;
    this.drag.currentY = 0;
    this.drag.deltaY = 0;
    this.drag.sheetEl = null;
    this.drag.modalId = null;
  }
}

export const modalManager = new ModalManager();
