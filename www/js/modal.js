// Файл: www/js/modal.js

import { $ } from "./utils.js?v=VERSION";
import { BottomSheetDragController } from "./modal/bottom-sheet-drag.js?v=VERSION";

class ModalManager {
  constructor() {
    this.modals = {};
    this.activeStack = [];
    this.lastFocusedElement = null;
    this.closeTimeouts = {};

    this.modalContainer = null;
    this.bottomSheetOverlay = null;

    this._escBound = false;
    this._onKeydown = null;

    this._overlayClickHandler = null;

    this.dragController = new BottomSheetDragController({
      getTopModal: () => this._getTopModal(),
      closeCurrent: () => this.closeCurrent(),
    });
  }

  init(config) {
    this.destroy();

    this.modalContainer = $("modal-container");
    this.bottomSheetOverlay = $("bottom-sheet-overlay");

    if (!this.modalContainer) {
      console.error("Modal container with id 'modal-container' not found.");
      return;
    }

    this.modals = {};
    this.activeStack = [];
    this.closeTimeouts = {};
    this.lastFocusedElement = null;

    config.forEach((modalConfig) => {
      const modalEl = $(modalConfig.id);
      if (!modalEl) return;

      const contentEl = modalConfig.contentId
        ? $(modalConfig.contentId)
        : modalEl.firstElementChild;

      const handlerEl = modalConfig.handlerId ? $(modalConfig.handlerId) : null;

      this.modals[modalConfig.id] = {
        ...modalConfig,
        el: modalEl,
        content: contentEl,
        handlerEl,
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

      if (modalConfig.type === "bottom-sheet" && handlerEl) {
        this.dragController.bindStart(handlerEl, modalConfig.id, () => modalEl);
      }
    });
  }

  destroy() {
    Object.keys(this.closeTimeouts).forEach((id) => {
      if (this.closeTimeouts[id]) {
        clearTimeout(this.closeTimeouts[id]);
        this.closeTimeouts[id] = null;
      }
    });

    this._removeEscListener();
    this._detachOverlayClick();
    this.dragController.destroy();

    this.activeStack = [];
    this.lastFocusedElement = null;
    this.modals = {};
    this.closeTimeouts = {};
  }

  hasActiveModal() {
    return this.activeStack.length > 0;
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

    if (this.activeStack.length === 0) {
      this.lastFocusedElement = document.activeElement;
      this._toggleInert(true);
      this.modalContainer.classList.add("active");
    }

    this.activeStack.push(id);
    this._syncEscListener();

    modal.el.classList.remove("hidden");
    modal.el.classList.add("flex");
    modal.el.removeAttribute("inert");
    modal.el.removeAttribute("aria-hidden");

    if (modal.type === "bottom-sheet") {
      this._showBottomSheetOverlayFor(id);
      modal.el.style.transition = "none";
      modal.el.style.transform = "translateY(100%)";

      requestAnimationFrame(() => {
        modal.el.style.transition =
          "transform 400ms cubic-bezier(0.32, 0.72, 0, 1)";
        modal.el.style.transform = "translateY(0%)";
      });
    } else if (modal.type === "alert") {
      requestAnimationFrame(() => {
        modal.el.classList.remove("opacity-0");
        if (modal.content) {
          modal.content.classList.remove("opacity-0", "scale-95");
        }
      });
    }

    if (typeof modal.onOpen === "function") {
      modal.onOpen(data);
    }
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
    this._syncEscListener();

    const isLastModal = this.activeStack.length === 0;
    const delay = modal.type === "bottom-sheet" ? 400 : 300;

    if (isLastModal) {
      this._detachOverlayClick();
      this._hideBottomSheetOverlay();
      this.modalContainer.classList.remove("active");
    } else {
      const top = this._getTopModal();
      if (top?.type === "bottom-sheet") {
        this._showBottomSheetOverlayFor(top.id);
      } else {
        this._detachOverlayClick();
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

        if (
          this.lastFocusedElement &&
          typeof this.lastFocusedElement.focus === "function"
        ) {
          this.lastFocusedElement.focus();
        }
        this.lastFocusedElement = null;
      }

      if (typeof modal.onClose === "function") {
        modal.onClose();
      }
    }, delay);
  }

  closeCurrent() {
    const currentId = this._getTopModalId();
    if (currentId) this.close(currentId);
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

  _syncEscListener() {
    if (this.hasActiveModal()) {
      this._ensureEscListener();
    } else {
      this._removeEscListener();
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

  _showBottomSheetOverlayFor(modalId) {
    if (!this.bottomSheetOverlay) return;

    this.bottomSheetOverlay.classList.remove("opacity-0");
    this.bottomSheetOverlay.removeAttribute("aria-hidden");

    this._detachOverlayClick();
    this._overlayClickHandler = () => {
      if (this._getTopModalId() === modalId) {
        this.closeCurrent();
      }
    };

    this.bottomSheetOverlay.addEventListener(
      "click",
      this._overlayClickHandler,
    );
  }

  _hideBottomSheetOverlay() {
    if (!this.bottomSheetOverlay) return;
    this.bottomSheetOverlay.classList.add("opacity-0");
    this.bottomSheetOverlay.setAttribute("aria-hidden", "true");
  }

  _detachOverlayClick() {
    if (!this.bottomSheetOverlay || !this._overlayClickHandler) return;
    this.bottomSheetOverlay.removeEventListener(
      "click",
      this._overlayClickHandler,
    );
    this._overlayClickHandler = null;
  }
}

export const modalManager = new ModalManager();
