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

    this._warmedBottomSheets = new Set();
    this._warmLoadHandler = null;
    this._warmTimeout = 0;

    this._firstBottomSheetShown = false;
    this._cheapFirstOpenDone = new Set();

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

  _warmBottomSheetElement(modalId, el) {
    if (!modalId || !el) return;

    const wasHidden = el.classList.contains("hidden");
    const hadFlex = el.classList.contains("flex");
    const prevInert = el.hasAttribute("inert");
    const prevAriaHidden = el.getAttribute("aria-hidden");

    const prevStyle = {
      transition: el.style.transition,
      transform: el.style.transform,
      visibility: el.style.visibility,
      pointerEvents: el.style.pointerEvents,
    };

    el.classList.remove("hidden");
    el.classList.add("flex");
    el.style.transition = "none";
    el.style.transform = "translateY(100%)";
    el.style.visibility = "hidden";
    el.style.pointerEvents = "none";

    void el.getBoundingClientRect();
    void el.offsetHeight;

    el.style.transition = prevStyle.transition;
    el.style.transform = prevStyle.transform;
    el.style.visibility = prevStyle.visibility;
    el.style.pointerEvents = prevStyle.pointerEvents;

    if (wasHidden) el.classList.add("hidden");
    if (!hadFlex) el.classList.remove("flex");

    if (prevInert) el.setAttribute("inert", "");
    else el.removeAttribute("inert");

    if (prevAriaHidden === null) el.removeAttribute("aria-hidden");
    else el.setAttribute("aria-hidden", prevAriaHidden);

    this._warmedBottomSheets.add(modalId);
  }

  _prewarmBottomSheets() {
    const entries = Object.values(this.modals);
    if (!entries.length) return;

    entries.forEach((modal) => {
      if (!modal || modal.type !== "bottom-sheet" || !modal.el) return;
      if (this._warmedBottomSheets.has(modal.id)) return;
      this._warmBottomSheetElement(modal.id, modal.el);
    });

    if (this.bottomSheetOverlay) {
      const ov = this.bottomSheetOverlay;
      const prevOpacity = ov.style.opacity;
      const prevTransition = ov.style.transition;
      const prevPointer = ov.style.pointerEvents;
      const prevFilter = ov.style.backdropFilter;

      ov.style.transition = "none";
      ov.style.opacity = "0.001";
      ov.style.pointerEvents = "none";
      ov.style.backdropFilter = "none";
      void ov.getBoundingClientRect();
      void ov.offsetHeight;

      ov.style.opacity = prevOpacity;
      ov.style.transition = prevTransition;
      ov.style.pointerEvents = prevPointer;
      ov.style.backdropFilter = prevFilter;
    }
  }

  _schedulePrewarm() {
    requestAnimationFrame(() => this._prewarmBottomSheets());

    this._warmTimeout = window.setTimeout(() => {
      this._prewarmBottomSheets();
      this._warmTimeout = 0;
    }, 180);

    this._warmLoadHandler = () => {
      this._prewarmBottomSheets();
    };
    window.addEventListener("load", this._warmLoadHandler, { once: true });
  }

  _clearPrewarmHooks() {
    if (this._warmTimeout) {
      clearTimeout(this._warmTimeout);
      this._warmTimeout = 0;
    }

    if (this._warmLoadHandler) {
      window.removeEventListener("load", this._warmLoadHandler);
      this._warmLoadHandler = null;
    }
  }

  _applyFirstOpenOverlayOptimization() {
    if (this._firstBottomSheetShown || !this.bottomSheetOverlay)
      return () => {};

    const ov = this.bottomSheetOverlay;
    const prevFilter = ov.style.backdropFilter;
    const prevWillChange = ov.style.willChange;

    ov.style.backdropFilter = "none";
    ov.style.willChange = "opacity";

    let restored = false;
    const restore = () => {
      if (restored) return;
      restored = true;
      ov.style.backdropFilter = prevFilter;
      ov.style.willChange = prevWillChange;
      this._firstBottomSheetShown = true;
    };

    const timer = setTimeout(restore, 560);

    return () => {
      clearTimeout(timer);
      restore();
    };
  }

  _applyCheapFirstOpenForModal(modal) {
    if (!modal || modal.id !== "tb-modal") return () => {};
    if (this._cheapFirstOpenDone.has(modal.id)) return () => {};

    const sheet = modal.el;
    const overlay = this.bottomSheetOverlay;

    const prevSheetFilter = sheet.style.backdropFilter;
    const prevSheetWillChange = sheet.style.willChange;

    let prevOverlayFilter = "";
    let prevOverlayWillChange = "";

    if (overlay) {
      prevOverlayFilter = overlay.style.backdropFilter;
      prevOverlayWillChange = overlay.style.willChange;
      overlay.style.backdropFilter = "none";
      overlay.style.willChange = "opacity";
    }

    sheet.style.backdropFilter = "none";
    sheet.style.willChange = "transform, opacity";

    let restored = false;
    const restore = () => {
      if (restored) return;
      restored = true;

      sheet.style.backdropFilter = prevSheetFilter;
      sheet.style.willChange = prevSheetWillChange;

      if (overlay) {
        overlay.style.backdropFilter = prevOverlayFilter;
        overlay.style.willChange = prevOverlayWillChange;
      }

      this._cheapFirstOpenDone.add(modal.id);
    };

    const timer = setTimeout(restore, 620);

    return () => {
      clearTimeout(timer);
      restore();
    };
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
    this._warmedBottomSheets.clear();
    this._firstBottomSheetShown = false;
    this._cheapFirstOpenDone.clear();

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

    this._schedulePrewarm();
  }

  destroy() {
    Object.keys(this.closeTimeouts).forEach((id) => {
      if (this.closeTimeouts[id]) {
        clearTimeout(this.closeTimeouts[id]);
        this.closeTimeouts[id] = null;
      }
    });

    this._clearPrewarmHooks();
    this._warmedBottomSheets.clear();
    this._cheapFirstOpenDone.clear();

    this._removeEscListener();
    this._detachOverlayClick();
    this._removeBoundListeners();
    this.dragController.destroy();

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
      if (!this._warmedBottomSheets.has(id)) {
        this._warmBottomSheetElement(id, modal.el);
      }

      const restoreFirstOpenOverlay = this._applyFirstOpenOverlayOptimization();
      const restoreCheapForModal = this._applyCheapFirstOpenForModal(modal);

      modal.el.style.transition = "none";
      modal.el.style.transform = "translateY(100%)";
      void modal.el.offsetHeight;

      requestAnimationFrame(() => {
        modal.el.style.transition =
          "transform 400ms cubic-bezier(0.32, 0.72, 0, 1)";
        modal.el.style.transform = "translateY(0%)";
      });

      setTimeout(() => {
        restoreFirstOpenOverlay();
        restoreCheapForModal();
      }, 620);
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

      modal.el.classList.add("hidden");
      modal.el.classList.remove("flex");

      if (modal.type === "bottom-sheet") {
        modal.el.style.transition = "";
        modal.el.style.transform = "";
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
