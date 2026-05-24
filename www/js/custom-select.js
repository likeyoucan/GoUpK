// Файл: www/js/custom-select.js

import { getCssVariable, hexToRGB, getLuminance } from "./utils.js?v=VERSION";
import { APP_EVENTS } from "./constants/events.js?v=VERSION";

import {
  registerSelect,
  unregisterSelect,
  closeAllSelectsExcept,
  closeAllOpenSelects,
  forEachActiveSelect,
} from "./custom-select/registry.js?v=VERSION";
import {
  lockPageScroll,
  unlockPageScroll,
} from "./custom-select/scroll-lock.js?v=VERSION";
import {
  decidePlacement,
  positionPanel,
} from "./custom-select/positioning.js?v=VERSION";
import {
  createTrigger,
  createPanel,
  createOptionIcon,
  appendOptionContent,
} from "./custom-select/view.js?v=VERSION";

const TRANSITION_DURATION = 200;
let globalHandlersBound = false;

/**
 * @typedef {Object} SelectOption
 * @property {string} value
 * @property {string} text
 * @property {string[]} [iconPaths]
 */

/**
 * @callback OnSelectCallback
 * @param {string} value
 * @returns {void}
 */

function bindGlobalHandlersOnce() {
  if (globalHandlersBound) return;
  globalHandlersBound = true;

  document.addEventListener("click", () => {
    closeAllOpenSelects();
  });

  document.addEventListener(APP_EVENTS.ACCENT_COLOR_CHANGED, () => {
    forEachActiveSelect((select) => {
      const selectedEl = select.optionsPanel?.querySelector(".is-selected");
      if (selectedEl) select.updateSelectedTextColor(selectedEl);
    });
  });
}

export class CustomSelect {
  /**
   * @param {string} elementId
   * @param {SelectOption[]} options
   * @param {OnSelectCallback | null | undefined} onSelect
   * @param {string} initialValue
   */
  constructor(elementId, options, onSelect, initialValue) {
    /** @type {HTMLElement | null} */
    this.container = document.getElementById(elementId);

    /** @type {SelectOption[]} */
    this.options = Array.isArray(options) ? options : [];

    /** @type {OnSelectCallback | null} */
    this.onSelect = typeof onSelect === "function" ? onSelect : null;

    this.currentValue = initialValue;

    this.isOpen = false;

    /** @type {number} */
    this.focusedIndex = -1;

    this.isDestroyed = false;

    this._instanceAbort = new AbortController();
    this._openAbort = null;
    this._resizeObserver = null;
    this._rafReposition = 0;
    this._closeTimer = 0;

    /** @type {"top" | "bottom"} */
    this._placement = "bottom";

    /** @type {HTMLElement} */
    this._portalRoot = document.getElementById("app") || document.body;

    this._originalParent = null;
    this._nextSibling = null;

    /** @type {HTMLElement | null} */
    this.trigger = null;

    /** @type {HTMLElement | null} */
    this.selectedValueEl = null;

    /** @type {SVGElement | null} */
    this.arrow = null;

    /** @type {HTMLElement | null} */
    this.optionsPanel = null;

    if (!(this.container instanceof HTMLElement)) {
      console.warn(`[CustomSelect] container not found: ${elementId}`);
      return;
    }

    bindGlobalHandlersOnce();
    this.render();
    this.attachBaseListeners();

    registerSelect(this);
  }

  _hasCoreNodes() {
    return !!(this.container && this.trigger && this.optionsPanel);
  }

  /**
   * @returns {{container: HTMLElement, trigger: HTMLElement, optionsPanel: HTMLElement}}
   */
  _getCoreNodesOrThrow() {
    if (!this._hasCoreNodes()) {
      throw new Error("[CustomSelect] core nodes are not initialized");
    }

    return {
      container: this.container,
      trigger: this.trigger,
      optionsPanel: this.optionsPanel,
    };
  }

  destroy() {
    if (this.isDestroyed) return;
    this.isDestroyed = true;

    if (this._closeTimer) {
      clearTimeout(this._closeTimer);
      this._closeTimer = 0;
    }

    this.close({ immediate: true });

    this._instanceAbort.abort();

    if (this._openAbort) {
      this._openAbort.abort();
      this._openAbort = null;
    }

    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
      this._resizeObserver = null;
    }

    if (this._rafReposition) {
      cancelAnimationFrame(this._rafReposition);
      this._rafReposition = 0;
    }

    this._restorePanelToContainer();
    unregisterSelect(this);

    if (this.container) {
      this.container.replaceChildren();
      this.container.classList.remove(
        "custom-select-container",
        "relative",
        "is-open",
      );
    }
  }

  render() {
    if (!this.container) return;

    this.container.replaceChildren();

    const triggerParts = createTrigger();
    this.trigger = triggerParts.trigger;
    this.selectedValueEl = triggerParts.selectedValueEl;
    this.arrow = triggerParts.arrow;

    this.optionsPanel = createPanel();

    this.container.classList.add("custom-select-container", "relative");
    this.container.append(this.trigger, this.optionsPanel);

    this.populateOptions();
    this.setValue(this.currentValue, false);
  }

  populateOptions() {
    if (!this.optionsPanel || !this.container) return;
    this.optionsPanel.replaceChildren();

    const fragment = document.createDocumentFragment();

    this.options.forEach((option, index) => {
      const optionEl = document.createElement("div");
      optionEl.className = "custom-select-option w-full";
      optionEl.setAttribute("role", "option");
      optionEl.setAttribute("tabindex", "-1");
      optionEl.id = `${this.container.id}-option-${index}`;
      optionEl.dataset.value = option.value;
      optionEl.dataset.index = String(index);

      appendOptionContent(optionEl, option, createOptionIcon);

      if (option.value === this.currentValue) {
        optionEl.classList.add("is-selected");
        optionEl.setAttribute("aria-selected", "true");
        this.focusedIndex = index;
      } else {
        optionEl.setAttribute("aria-selected", "false");
      }

      fragment.appendChild(optionEl);
    });

    this.optionsPanel.appendChild(fragment);
  }

  renderSelectedValue(option) {
    if (!this.selectedValueEl) return;
    appendOptionContent(this.selectedValueEl, option, createOptionIcon);
  }

  attachBaseListeners() {
    if (!this._hasCoreNodes()) return;

    const { trigger, optionsPanel, container } = this._getCoreNodesOrThrow();
    const signal = this._instanceAbort.signal;

    trigger.addEventListener(
      "click",
      (e) => {
        e.stopPropagation();
        this.toggle();
      },
      { signal },
    );

    trigger.addEventListener(
      "keydown",
      (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          this.toggle();
          return;
        }

        if (e.key === "ArrowDown") {
          e.preventDefault();
          if (!this.isOpen) this.open();
          this.moveFocus(1);
          return;
        }

        if (e.key === "ArrowUp") {
          e.preventDefault();
          if (!this.isOpen) this.open();
          this.moveFocus(-1);
        }
      },
      { signal },
    );

    optionsPanel.addEventListener(
      "keydown",
      (e) => {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          this.moveFocus(1);
          return;
        }

        if (e.key === "ArrowUp") {
          e.preventDefault();
          this.moveFocus(-1);
          return;
        }

        if (e.key === "Enter") {
          e.preventDefault();
          const focused = this.getFocusedOptionEl();
          if (focused) {
            this.setValue(focused.dataset.value);
            this.close();
            trigger.focus();
          }
          return;
        }

        if (e.key === "Escape") {
          e.preventDefault();
          this.close();
          trigger.focus();
        }
      },
      { signal },
    );

    optionsPanel.addEventListener(
      "click",
      (e) => {
        const target = e.target.closest(".custom-select-option");
        if (!target) return;

        this.setValue(target.dataset.value);
        this.close();
        trigger.focus();
      },
      { signal },
    );

    optionsPanel.addEventListener(
      "mouseover",
      (e) => {
        const target = e.target.closest(".custom-select-option");
        if (!target) return;

        this.focusedIndex = Number(target.dataset.index);
        this.syncAriaActive();
        this.updateSelectedTextColor(target);
      },
      { signal },
    );

    optionsPanel.addEventListener(
      "mouseout",
      (e) => {
        const target = e.target.closest(".custom-select-option");
        if (target) target.classList.remove("needs-dark-text");
      },
      { signal },
    );

    const viewportHandler = (ev) => {
      if (!this.isOpen) return;
      const target = ev?.target;
      if (target instanceof Node && optionsPanel.contains(target)) return;
      this.scheduleReposition();
    };

    window.addEventListener("resize", viewportHandler, {
      passive: true,
      signal,
    });
    window.addEventListener("scroll", viewportHandler, {
      passive: true,
      capture: true,
      signal,
    });

    window.addEventListener(
      "orientationchange",
      () => {
        if (!this.isOpen) return;
        requestAnimationFrame(() => this.scheduleReposition());
        setTimeout(() => this.scheduleReposition(), 120);
        setTimeout(() => this.scheduleReposition(), 320);
      },
      { passive: true, signal },
    );

    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", viewportHandler, {
        passive: true,
        signal,
      });
      window.visualViewport.addEventListener("scroll", viewportHandler, {
        passive: true,
        signal,
      });
    }

    if ("ResizeObserver" in window && this._portalRoot instanceof HTMLElement) {
      this._resizeObserver = new ResizeObserver(() => {
        if (!this.isOpen) return;
        this.scheduleReposition();
      });
      this._resizeObserver.observe(this._portalRoot);
    }

    // keep reference used by typings / future migration
    void container;
  }

  _movePanelToPortal() {
    if (!this.optionsPanel) return;
    if (this.optionsPanel.parentElement === this._portalRoot) return;

    this._originalParent = this.optionsPanel.parentElement;
    this._nextSibling = this.optionsPanel.nextSibling;
    this._portalRoot.appendChild(this.optionsPanel);

    this.optionsPanel.style.position =
      this._portalRoot === document.body ? "fixed" : "absolute";
  }

  _restorePanelToContainer() {
    if (!this.optionsPanel || !this._originalParent) return;

    if (
      this._nextSibling &&
      this._nextSibling.parentNode === this._originalParent
    ) {
      this._originalParent.insertBefore(this.optionsPanel, this._nextSibling);
    } else {
      this._originalParent.appendChild(this.optionsPanel);
    }

    this.optionsPanel.style.position = "";
    this._originalParent = null;
    this._nextSibling = null;
  }

  scheduleReposition() {
    if (!this.isOpen || !this._hasCoreNodes()) return;
    if (this._rafReposition) cancelAnimationFrame(this._rafReposition);

    this._rafReposition = requestAnimationFrame(() => {
      this._rafReposition = 0;
      this._placement = decidePlacement(
        this.trigger,
        this.optionsPanel,
        this._portalRoot,
      );
      positionPanel({
        triggerEl: this.trigger,
        panelEl: this.optionsPanel,
        portalRoot: this._portalRoot,
        placement: this._placement,
      });
    });
  }

  toggle() {
    this.isOpen ? this.close() : this.open();
  }

  open() {
    if (this.isOpen || this.isDestroyed || !this._hasCoreNodes()) return;

    const { trigger, optionsPanel, container } = this._getCoreNodesOrThrow();

    this.isOpen = true;

    if (this._closeTimer) {
      clearTimeout(this._closeTimer);
      this._closeTimer = 0;
    }

    closeAllSelectsExcept(this);

    this._openAbort = new AbortController();
    const openSignal = this._openAbort.signal;

    this._movePanelToPortal();
    optionsPanel.classList.remove("hidden");

    this._placement = decidePlacement(trigger, optionsPanel, this._portalRoot);
    positionPanel({
      triggerEl: trigger,
      panelEl: optionsPanel,
      portalRoot: this._portalRoot,
      placement: this._placement,
    });

    lockPageScroll();

    document.addEventListener(
      "click",
      (e) => {
        const target = e.target;
        if (container.contains(target) || optionsPanel.contains(target)) {
          return;
        }
        this.close();
      },
      { capture: true, signal: openSignal },
    );

    requestAnimationFrame(() => {
      if (!this.isOpen || !this._hasCoreNodes()) return;

      positionPanel({
        triggerEl: trigger,
        panelEl: optionsPanel,
        portalRoot: this._portalRoot,
        placement: this._placement,
      });

      optionsPanel.classList.add("is-open");
      if (this.arrow) this.arrow.style.transform = "rotate(180deg)";
      trigger.setAttribute("aria-expanded", "true");
      container.classList.add("is-open");

      const selectedIdx = this.options.findIndex(
        (opt) => opt.value === this.currentValue,
      );
      this.focusedIndex = selectedIdx >= 0 ? selectedIdx : 0;

      this.syncAriaActive();
      this.focusCurrentOption();
      optionsPanel.focus();
    });
  }

  close({ immediate = false } = {}) {
    if (!this.isOpen && !immediate) return;
    if (!this._hasCoreNodes()) return;

    const { trigger, optionsPanel, container } = this._getCoreNodesOrThrow();
    this.isOpen = false;

    if (this._openAbort) {
      this._openAbort.abort();
      this._openAbort = null;
    }

    if (this._rafReposition) {
      cancelAnimationFrame(this._rafReposition);
      this._rafReposition = 0;
    }

    optionsPanel.classList.remove("is-open");
    if (this.arrow) this.arrow.style.transform = "";
    trigger.setAttribute("aria-expanded", "false");
    trigger.removeAttribute("aria-activedescendant");
    container.classList.remove("is-open");

    unlockPageScroll();

    const finalize = () => {
      if (this.isOpen || !this.optionsPanel) return;

      this.optionsPanel.classList.add("hidden");
      this.optionsPanel.style.left = "";
      this.optionsPanel.style.top = "";
      this.optionsPanel.style.width = "";
      this.optionsPanel.style.maxHeight = "";
      this.optionsPanel.style.overflowY = "";
      this.optionsPanel.style.overscrollBehavior = "";
      this.optionsPanel.style.zIndex = "";
      this._restorePanelToContainer();
    };

    if (immediate) {
      finalize();
      return;
    }

    if (this._closeTimer) clearTimeout(this._closeTimer);
    this._closeTimer = setTimeout(() => {
      this._closeTimer = 0;
      finalize();
    }, TRANSITION_DURATION);
  }

  moveFocus(direction) {
    if (!this._hasCoreNodes()) return;

    const optionEls = this.optionsPanel.querySelectorAll(
      ".custom-select-option",
    );
    if (!optionEls.length) return;

    if (this.focusedIndex < 0) this.focusedIndex = 0;
    else {
      this.focusedIndex =
        (this.focusedIndex + direction + optionEls.length) % optionEls.length;
    }

    this.syncAriaActive();
    this.focusCurrentOption();
  }

  focusCurrentOption() {
    const focused = this.getFocusedOptionEl();
    if (!focused) return;
    focused.scrollIntoView({ block: "nearest" });
  }

  getFocusedOptionEl() {
    if (!this.optionsPanel) return null;
    return this.optionsPanel.querySelector(
      `.custom-select-option[data-index="${this.focusedIndex}"]`,
    );
  }

  syncAriaActive() {
    const focused = this.getFocusedOptionEl();
    if (!focused || !this.trigger) return;
    this.trigger.setAttribute("aria-activedescendant", focused.id);
  }

  setValue(value, triggerOnSelect = true) {
    if (!this._hasCoreNodes()) return;

    const selectedOption = this.options.find((opt) => opt.value === value);
    if (!selectedOption) return;

    this.currentValue = value;
    this.renderSelectedValue(selectedOption);

    this.optionsPanel
      .querySelectorAll(".custom-select-option")
      .forEach((el) => {
        const isSelected = el.dataset.value === value;
        el.classList.toggle("is-selected", isSelected);
        el.setAttribute("aria-selected", String(isSelected));
        if (isSelected) this.updateSelectedTextColor(el);
      });

    this.focusedIndex = this.options.findIndex((opt) => opt.value === value);
    this.syncAriaActive();

    if (triggerOnSelect && this.onSelect) {
      this.onSelect(value);
    }
  }

  updateSelectedTextColor(selectedEl) {
    if (!selectedEl) return;

    const primaryColor = getCssVariable("--primary-color");
    const { r, g, b } = hexToRGB(primaryColor);
    const luminance = getLuminance(r, g, b);
    selectedEl.classList.toggle("needs-dark-text", luminance > 0.55);
  }
}
