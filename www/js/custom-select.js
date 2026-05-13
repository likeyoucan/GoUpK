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
  constructor(elementId, options, onSelect, initialValue) {
    this.container = document.getElementById(elementId);
    this.options = Array.isArray(options) ? options : [];
    this.onSelect = typeof onSelect === "function" ? onSelect : null;
    this.currentValue = initialValue;

    this.isOpen = false;
    this.focusedIndex = -1;
    this.isDestroyed = false;

    this._instanceAbort = new AbortController();
    this._openAbort = null;
    this._resizeObserver = null;
    this._rafReposition = 0;
    this._closeTimer = 0;

    this._placement = "bottom";
    this._portalRoot = document.getElementById("app") || document.body;
    this._originalParent = null;
    this._nextSibling = null;

    if (!(this.container instanceof HTMLElement)) {
      console.warn(`[CustomSelect] container not found: ${elementId}`);
      return;
    }

    bindGlobalHandlersOnce();
    this.render();
    this.attachBaseListeners();

    registerSelect(this);
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
    if (!this.optionsPanel) return;
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
    appendOptionContent(this.selectedValueEl, option, createOptionIcon);
  }

  attachBaseListeners() {
    const signal = this._instanceAbort.signal;

    this.trigger.addEventListener(
      "click",
      (e) => {
        e.stopPropagation();
        this.toggle();
      },
      { signal },
    );

    this.trigger.addEventListener(
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

    this.optionsPanel.addEventListener(
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
            this.trigger.focus();
          }
          return;
        }

        if (e.key === "Escape") {
          e.preventDefault();
          this.close();
          this.trigger.focus();
        }
      },
      { signal },
    );

    this.optionsPanel.addEventListener(
      "click",
      (e) => {
        const target = e.target.closest(".custom-select-option");
        if (!target) return;

        this.setValue(target.dataset.value);
        this.close();
        this.trigger.focus();
      },
      { signal },
    );

    this.optionsPanel.addEventListener(
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

    this.optionsPanel.addEventListener(
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
      if (target instanceof Node && this.optionsPanel.contains(target)) return;
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
  }

  _movePanelToPortal() {
    if (
      !this.optionsPanel ||
      this.optionsPanel.parentElement === this._portalRoot
    ) {
      return;
    }

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
    if (!this.isOpen) return;
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
    if (
      this.isOpen ||
      this.isDestroyed ||
      !this.optionsPanel ||
      !this.trigger
    ) {
      return;
    }

    this.isOpen = true;

    if (this._closeTimer) {
      clearTimeout(this._closeTimer);
      this._closeTimer = 0;
    }

    closeAllSelectsExcept(this);

    this._openAbort = new AbortController();
    const openSignal = this._openAbort.signal;

    this._movePanelToPortal();
    this.optionsPanel.classList.remove("hidden");

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

    lockPageScroll();

    document.addEventListener(
      "click",
      (e) => {
        const target = e.target;
        if (
          this.container?.contains(target) ||
          this.optionsPanel?.contains(target)
        ) {
          return;
        }
        this.close();
      },
      { capture: true, signal: openSignal },
    );

    requestAnimationFrame(() => {
      if (!this.isOpen) return;

      positionPanel({
        triggerEl: this.trigger,
        panelEl: this.optionsPanel,
        portalRoot: this._portalRoot,
        placement: this._placement,
      });

      this.optionsPanel.classList.add("is-open");
      this.arrow.style.transform = "rotate(180deg)";
      this.trigger.setAttribute("aria-expanded", "true");
      this.container.classList.add("is-open");

      const selectedIdx = this.options.findIndex(
        (opt) => opt.value === this.currentValue,
      );
      this.focusedIndex = selectedIdx >= 0 ? selectedIdx : 0;

      this.syncAriaActive();
      this.focusCurrentOption();
      this.optionsPanel.focus();
    });
  }

  close({ immediate = false } = {}) {
    if (!this.isOpen && !immediate) return;

    this.isOpen = false;

    if (this._openAbort) {
      this._openAbort.abort();
      this._openAbort = null;
    }

    if (this._rafReposition) {
      cancelAnimationFrame(this._rafReposition);
      this._rafReposition = 0;
    }

    if (this.optionsPanel) this.optionsPanel.classList.remove("is-open");
    if (this.arrow) this.arrow.style.transform = "";
    if (this.trigger) {
      this.trigger.setAttribute("aria-expanded", "false");
      this.trigger.removeAttribute("aria-activedescendant");
    }
    if (this.container) this.container.classList.remove("is-open");

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
    const optionEls = this.optionsPanel?.querySelectorAll(
      ".custom-select-option",
    );
    if (!optionEls?.length) return;

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
    return this.optionsPanel?.querySelector(
      `.custom-select-option[data-index="${this.focusedIndex}"]`,
    );
  }

  syncAriaActive() {
    const focused = this.getFocusedOptionEl();
    if (!focused || !this.trigger) return;
    this.trigger.setAttribute("aria-activedescendant", focused.id);
  }

  setValue(value, triggerOnSelect = true) {
    const selectedOption = this.options.find((opt) => opt.value === value);
    if (!selectedOption || !this.optionsPanel) return;

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
