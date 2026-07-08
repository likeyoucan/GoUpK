// Файл: www/js/modal.js

import { $ } from "./utils.js?v=VERSION";
import { BottomSheetDragController } from "./modal/bottom-sheet-drag.js?v=VERSION";
import { ModalStackStore } from "./modal/modal-stack-store.js?v=VERSION";
import {
  showBottomSheetOverlay,
  hideBottomSheetOverlay,
  setMainInert,
} from "./modal/modal-overlay.js?v=VERSION";

/** @typedef {import("./types/managers-contracts.js").ModalConfig} ModalConfig */
/** @typedef {import("./types/managers-contracts.js").ModalEntry} ModalEntry */
/** @typedef {import("./types/managers-contracts.js").ModalManagerContract} ModalManagerContract */

/** @implements {ModalManagerContract} */
class ModalManager {
  constructor() {
    /** @type {Record<string, ModalEntry>} */
    this.modals = {};

    this.stack = new ModalStackStore();
    this.lastFocusedElement = null;

    /** @type {Record<string, number | null>} */
    this.closeTimeouts = {};

    this.modalContainer = null;
    this.bottomSheetOverlay = null;

    this._escBound = false;
    this._onKeydown = null;

    this._overlayClickHandler = null;
    this._boundModalListeners = [];

    this.dragController = new BottomSheetDragController({
      getTopModal: () => this._getTopModal(),
      closeCurrent: () => this.closeCurrent(),
    });
  }

  _bind(el, event, fn, options) {
    if (!el || !event || typeof fn !== "function") return;
    el.addEventListener(event, fn, options);
    this._boundModalListeners.push({ el, event, fn, options });
  }

  _removeBoundListeners() {
    this._boundModalListeners.forEach(({ el, event, fn, options }) => {
      el.removeEventListener(event, fn, options);
    });
    this._boundModalListeners = [];
  }

  _clearAllCloseTimeouts() {
    Object.keys(this.closeTimeouts).forEach((id) => {
      if (this.closeTimeouts[id]) {
        clearTimeout(this.closeTimeouts[id]);
      }
      this.closeTimeouts[id] = null;
    });
  }

  _forceHideAllModals() {
    Object.values(this.modals).forEach((modal) => {
      const el = modal?.el;
      if (!el) return;

      el.classList.add("hidden");
      el.classList.remove("flex");
      el.setAttribute("inert", "");
      el.setAttribute("aria-hidden", "true");

      if (modal.type === "bottom-sheet") {
        el.style.transition = "";
        el.style.transform = "";
      }
    });
  }

  _syncAppInteractivity() {
    const appEl = $("app");
    const hasActive = this.stack.hasAny();

    if (this.modalContainer) {
      this.modalContainer.classList.toggle("active", hasActive);
    }

    setMainInert(appEl, hasActive);

    if (!hasActive) {
      this._detachOverlayClick();
      hideBottomSheetOverlay(this.bottomSheetOverlay);
      return;
    }

    const top = this._getTopModal();
    if (top?.type === "bottom-sheet") {
      this._showBottomSheetOverlayFor(top.id);
    } else {
      this._detachOverlayClick();
      hideBottomSheetOverlay(this.bottomSheetOverlay);
    }
  }

  /**
   * @param {ModalConfig[]} config
   */
  init(config) {
    this.destroy();

    this.modalContainer = $("modal-container");
    this.bottomSheetOverlay = $("bottom-sheet-overlay");

    if (!this.modalContainer) {
      console.error("Modal container with id 'modal-container' not found.");
      return;
    }

    this.modals = {};
    this.stack.clear();
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
        const onCloseClick = (e) => {
          e.stopPropagation();
          this.close(modalConfig.id);
        };
        this._bind(btn, "click", onCloseClick);
      });

      if (modalConfig.type === "alert") {
        const onBackdropClick = () => {
          if (this._getTopModalId() === modalConfig.id) {
            this.closeCurrent();
          }
        };
        this._bind(modalEl, "click", onBackdropClick);

        if (contentEl) {
          const onContentClick = (e) => e.stopPropagation();
          this._bind(contentEl, "click", onContentClick);
        }
      }

      if (modalConfig.type === "bottom-sheet" && handlerEl) {
        this.dragController.bindStart(handlerEl, modalConfig.id, () => modalEl);
      }
    });
  }

  destroy() {
    this._clearAllCloseTimeouts();
    this._removeEscListener();
    this._detachOverlayClick();
    this._removeBoundListeners();
    this.dragController.destroy();

    this._forceHideAllModals();

    this.stack.clear();
    this.lastFocusedElement = null;
    this.modals = {};
    this.closeTimeouts = {};

    this._syncAppInteractivity();
  }

  hasActiveModal() {
    return this.stack.hasAny();
  }

  open(id, data = {}) {
    const modal = this.modals[id];
    if (!modal || this.stack.has(id)) return;

    if (this.closeTimeouts[id]) {
      clearTimeout(this.closeTimeouts[id]);
      this.closeTimeouts[id] = null;
      modal.el.classList.remove("hidden");
      modal.el.classList.add("flex");
    }

    if (!this.stack.hasAny()) {
      this.lastFocusedElement = document.activeElement;
    }

    this.stack.push(id);
    this._syncEscListener();
    this._syncAppInteractivity();

    modal.el.classList.remove("hidden");
    modal.el.classList.add("flex");
    modal.el.removeAttribute("inert");
    modal.el.removeAttribute("aria-hidden");

    if (modal.type === "bottom-sheet") {
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

    // Important: defer heavy onOpen work to next frame so first modal open
    // doesn't block the initial paint and animation start.
    if (typeof modal.onOpen === "function") {
      requestAnimationFrame(() => {
        if (this.stack.has(id)) {
          modal.onOpen(data);
        }
      });
    }
  }

  close(id) {
    const modal = this.modals[id];
    if (!modal || !this.stack.has(id)) return;

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

    this.stack.remove(id);
    this._syncEscListener();
    this._syncAppInteractivity();

    const delay = modal.type === "bottom-sheet" ? 400 : 300;

    this.closeTimeouts[id] = setTimeout(() => {
      if (this.stack.has(id)) {
        this.closeTimeouts[id] = null;
        return;
      }

      // Modal might already be destroyed/re-initialized.
      const current = this.modals[id];
      if (!current || !current.el) {
        this.closeTimeouts[id] = null;
        return;
      }

      current.el.classList.add("hidden");
      current.el.classList.remove("flex");

      if (current.type === "bottom-sheet") {
        current.el.style.transition = "";
        current.el.style.transform = "";
      }

      this.closeTimeouts[id] = null;

      if (!this.stack.hasAny()) {
        if (
          this.lastFocusedElement &&
          typeof this.lastFocusedElement.focus === "function"
        ) {
          this.lastFocusedElement.focus();
        }
        this.lastFocusedElement = null;
      }

      this._syncAppInteractivity();

      if (typeof current.onClose === "function") {
        current.onClose();
      }
    }, delay);
  }

  closeCurrent() {
    const currentId = this._getTopModalId();
    if (currentId) this.close(currentId);
  }

  _getTopModalId() {
    return this.stack.topId();
  }

  _getTopModal() {
    const id = this._getTopModalId();
    if (!id) return null;
    return this.modals[id] || null;
  }

  _syncEscListener() {
    if (this.hasActiveModal()) this._ensureEscListener();
    else this._removeEscListener();
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

    showBottomSheetOverlay(this.bottomSheetOverlay);

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
