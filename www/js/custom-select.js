// Файл: www/js/custom-select.js

import { getCssVariable, hexToRGB, getLuminance } from "./utils.js?v=VERSION";
import { APP_EVENTS } from "./constants/events.js?v=VERSION";

const activeSelects = new Set();
const TRANSITION_DURATION = 200;
const SELECT_MAX_VIEWPORT_K = 0.6;
const SELECT_MIN_HEIGHT_PX = 120;

let globalScrollBlockAttached = false;
let openSelectCount = 0;

const SCROLL_LOCK_CLASS_HTML = "cs-scroll-lock-html";
const SCROLL_LOCK_CLASS_BODY = "cs-scroll-lock-body";

function isNodeInsideOpenPanel(node) {
  if (!(node instanceof Node)) return false;

  for (const select of activeSelects) {
    if (!select?.isOpen || !select?.optionsPanel) continue;
    if (select.optionsPanel.contains(node)) return true;
  }
  return false;
}

function preventGlobalScrollEvent(e) {
  if (isNodeInsideOpenPanel(e.target)) return;
  e.preventDefault();
  e.stopPropagation();
}

function preventGlobalScrollKeys(e) {
  const blocked = [
    "ArrowUp",
    "ArrowDown",
    "PageUp",
    "PageDown",
    "Home",
    "End",
    " ",
  ];
  if (!blocked.includes(e.key)) return;
  if (isNodeInsideOpenPanel(e.target)) return;

  e.preventDefault();
  e.stopPropagation();
}

function attachGlobalScrollBlock() {
  if (globalScrollBlockAttached) return;
  globalScrollBlockAttached = true;

  document.addEventListener("wheel", preventGlobalScrollEvent, {
    passive: false,
    capture: true,
  });
  document.addEventListener("touchmove", preventGlobalScrollEvent, {
    passive: false,
    capture: true,
  });
  document.addEventListener("keydown", preventGlobalScrollKeys, {
    capture: true,
  });
}

function detachGlobalScrollBlock() {
  if (!globalScrollBlockAttached) return;
  globalScrollBlockAttached = false;

  document.removeEventListener("wheel", preventGlobalScrollEvent, true);
  document.removeEventListener("touchmove", preventGlobalScrollEvent, true);
  document.removeEventListener("keydown", preventGlobalScrollKeys, true);
}

function lockPageScroll() {
  openSelectCount += 1;
  if (openSelectCount > 1) return;

  attachGlobalScrollBlock();
  document.documentElement.classList.add(SCROLL_LOCK_CLASS_HTML);
  document.body.classList.add(SCROLL_LOCK_CLASS_BODY);
}

function unlockPageScroll() {
  if (openSelectCount <= 0) {
    openSelectCount = 0;
    return;
  }

  openSelectCount -= 1;
  if (openSelectCount > 0) return;

  detachGlobalScrollBlock();
  document.documentElement.classList.remove(SCROLL_LOCK_CLASS_HTML);
  document.body.classList.remove(SCROLL_LOCK_CLASS_BODY);
}

function ensureGlobalStyles() {
  if (document.getElementById("__custom_select_global_styles__")) return;

  const style = document.createElement("style");
  style.id = "__custom_select_global_styles__";
  style.textContent = `
    html.${SCROLL_LOCK_CLASS_HTML},
    body.${SCROLL_LOCK_CLASS_BODY} {
      overscroll-behavior: none !important;
      touch-action: none !important;
    }
    body.${SCROLL_LOCK_CLASS_BODY} {
      overflow: hidden !important;
    }
  `;
  document.head.appendChild(style);
}

export class CustomSelect {
  constructor(elementId, options, onSelect, initialValue) {
    this.container = document.getElementById(elementId);
    this.options = Array.isArray(options) ? options : [];
    this.onSelect = typeof onSelect === "function" ? onSelect : null;
    this.currentValue = initialValue;
    this.focusedIndex = -1;

    this.isOpen = false;
    this.isDestroyed = false;

    this._portalRoot = document.getElementById("app") || document.body;
    this._originalParent = null;
    this._nextSibling = null;
    this._placement = "bottom";
    this._rafReposition = 0;
    this._closeTimer = 0;

    this._instanceAbort = new AbortController();
    this._openAbort = null;
    this._resizeObserver = null;

    this.valid = this.container instanceof HTMLElement;
    if (!this.valid) {
      console.warn(`[CustomSelect] container not found: ${elementId}`);
      return;
    }

    ensureGlobalStyles();
    this.render();
    this.attachBaseListeners();
    activeSelects.add(this);
  }

  destroy() {
    if (this.isDestroyed) return;
    this.isDestroyed = true;

    if (this._closeTimer) {
      clearTimeout(this._closeTimer);
      this._closeTimer = 0;
    }

    this.close({ immediate: true });

    if (this._instanceAbort) {
      this._instanceAbort.abort();
    }

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
    activeSelects.delete(this);

    if (this.valid && this.container) {
      this.container.replaceChildren();
      this.container.classList.remove(
        "custom-select-container",
        "relative",
        "is-open",
      );
    }
  }

  render() {
    if (!this.valid) return;
    this.container.replaceChildren();

    this.trigger = document.createElement("div");
    this.trigger.className =
      "custom-select-trigger app-surface rounded-lg border app-border shadow-sm flex items-center justify-between w-full py-1.5 pl-3 pr-2 cursor-pointer transition-colors";
    this.trigger.setAttribute("role", "button");
    this.trigger.setAttribute("tabindex", "0");
    this.trigger.setAttribute("aria-haspopup", "listbox");
    this.trigger.setAttribute("aria-expanded", "false");

    this.selectedValueEl = document.createElement("span");
    this.selectedValueEl.className =
      "custom-select-value text-sm font-bold inline-flex items-center gap-2 whitespace-nowrap";

    const arrowSvg = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "svg",
    );
    arrowSvg.setAttribute("focusable", "false");
    arrowSvg.setAttribute("aria-hidden", "true");
    arrowSvg.setAttribute("viewBox", "0 0 24 24");
    arrowSvg.classList.add(
      "w-4",
      "h-4",
      "app-text-sec",
      "transition-transform",
      "duration-300",
    );

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
    path.setAttribute("stroke-width", "2");
    path.setAttribute("d", "M19 9l-7 7-7-7");
    arrowSvg.appendChild(path);
    this.arrow = arrowSvg;

    this.trigger.append(this.selectedValueEl, this.arrow);

    this.optionsPanel = document.createElement("div");
    this.optionsPanel.className = "custom-select-options hidden";
    this.optionsPanel.setAttribute("role", "listbox");
    this.optionsPanel.setAttribute("tabindex", "-1");

    this.container.classList.add("custom-select-container", "relative");
    this.container.append(this.trigger, this.optionsPanel);

    this.populateOptions();
    this.setValue(this.currentValue, false);
  }

  createOptionIcon(option) {
    if (!option?.iconPaths || !Array.isArray(option.iconPaths)) return null;

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("focusable", "false");
    svg.setAttribute("aria-hidden", "true");
    svg.classList.add("w-4", "h-4", "shrink-0");

    option.iconPaths.forEach((d) => {
      const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
      p.setAttribute("d", d);
      svg.appendChild(p);
    });

    return svg;
  }

  appendOptionContent(container, option) {
    container.replaceChildren();

    const icon = this.createOptionIcon(option);
    const text = document.createElement("span");
    text.className = "whitespace-nowrap";
    text.textContent = option.text;

    if (container === this.selectedValueEl) {
      container.classList.add("inline-flex", "items-center", "gap-2");
      if (icon) container.appendChild(icon);
      container.appendChild(text);
      return;
    }

    const row = document.createElement("div");
    row.className = "flex items-center gap-2 w-full";
    if (icon) row.appendChild(icon);
    row.appendChild(text);
    container.appendChild(row);
  }

  renderSelectedValue(option) {
    this.appendOptionContent(this.selectedValueEl, option);
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

      this.appendOptionContent(optionEl, option);

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

  decidePlacement() {
    const rect = this.trigger.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight || 0;
    const gap = 8;

    const spaceBelow = Math.max(0, vh - rect.bottom - gap - 8);
    const spaceAbove = Math.max(0, rect.top - gap - 8);

    this._placement =
      spaceBelow >= 140 || spaceBelow >= spaceAbove ? "bottom" : "top";
  }

  scheduleReposition() {
    if (!this.isOpen) return;
    if (this._rafReposition) cancelAnimationFrame(this._rafReposition);

    this._rafReposition = requestAnimationFrame(() => {
      this._rafReposition = 0;
      this.decidePlacement();
      this.positionPanel();
    });
  }

  positionPanel() {
    if (!this.trigger || !this.optionsPanel) return;

    const rect = this.trigger.getBoundingClientRect();
    const portalRect = this._portalRoot.getBoundingClientRect();
    const gap = 8;

    const vw = window.innerWidth || document.documentElement.clientWidth || 0;
    const vh = window.innerHeight || document.documentElement.clientHeight || 0;

    const panelWidth = Math.max(120, Math.round(rect.width));
    const maxPanelWidth = Math.max(120, vw - 16);
    const width = Math.min(panelWidth, maxPanelWidth);

    let left = Math.round(rect.left);
    if (left + width > vw - 8) left = Math.max(8, vw - width - 8);
    if (left < 8) left = 8;

    const spaceBelow = Math.max(0, vh - rect.bottom - gap - 8);
    const spaceAbove = Math.max(0, rect.top - gap - 8);
    const viewportCap = Math.floor(vh * SELECT_MAX_VIEWPORT_K);
    const availableSpace = this._placement === "top" ? spaceAbove : spaceBelow;

    const maxHeight = Math.max(
      SELECT_MIN_HEIGHT_PX,
      Math.min(viewportCap, Math.floor(availableSpace)),
    );

    this.optionsPanel.style.maxHeight = `${maxHeight}px`;
    this.optionsPanel.style.overflowY = "auto";
    this.optionsPanel.style.overscrollBehavior = "contain";

    let top;
    if (this._placement === "top") {
      const panelHeight = Math.min(
        maxHeight,
        this.optionsPanel.scrollHeight || maxHeight,
      );
      top = Math.round(rect.top - gap - panelHeight);
      if (top < 8) top = 8;
    } else {
      top = Math.round(rect.bottom + gap);
      const maxTop = vh - 8 - Math.min(maxHeight, 120);
      if (top > maxTop) top = Math.max(8, maxTop);
    }

    const isFixedToBody = this._portalRoot === document.body;
    const localLeft = isFixedToBody ? left : left - portalRect.left;
    const localTop = isFixedToBody ? top : top - portalRect.top;

    this.optionsPanel.style.left = `${localLeft}px`;
    this.optionsPanel.style.top = `${localTop}px`;
    this.optionsPanel.style.width = `${width}px`;
    this.optionsPanel.style.zIndex = "1000";
  }

  toggle() {
    this.isOpen ? this.close() : this.open();
  }

  open() {
    if (!this.valid || this.isOpen || this.isDestroyed) return;
    this.isOpen = true;

    if (this._closeTimer) {
      clearTimeout(this._closeTimer);
      this._closeTimer = 0;
    }

    activeSelects.forEach((s) => {
      if (s !== this && s.isOpen) s.close();
    });

    this._openAbort = new AbortController();
    const openSignal = this._openAbort.signal;

    this._movePanelToPortal();
    this.optionsPanel.classList.remove("hidden");

    this.decidePlacement();
    this.positionPanel();

    lockPageScroll();

    const onDocClick = (e) => {
      const target = e.target;
      if (
        this.container?.contains(target) ||
        this.optionsPanel?.contains(target)
      ) {
        return;
      }
      this.close();
    };

    document.addEventListener("click", onDocClick, {
      capture: true,
      signal: openSignal,
    });

    requestAnimationFrame(() => {
      if (!this.isOpen) return;

      this.positionPanel();
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
    if (this.trigger) this.trigger.setAttribute("aria-expanded", "false");
    if (this.container) this.container.classList.remove("is-open");
    if (this.trigger) this.trigger.removeAttribute("aria-activedescendant");

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
    if (!optionEls || !optionEls.length) return;

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
    if (!this.valid || !this.optionsPanel) return;

    const selectedOption = this.options.find((opt) => opt.value === value);
    if (!selectedOption) return;

    this.currentValue = value;
    this.renderSelectedValue(selectedOption);

    this.optionsPanel
      .querySelectorAll(".custom-select-option")
      .forEach((el) => {
        const isSelected = el.dataset.value === value;
        el.classList.toggle("is-selected", isSelected);
        el.setAttribute("aria-selected", isSelected.toString());
        if (isSelected) this.updateSelectedTextColor(el);
      });

    const selectedIdx = this.options.findIndex((opt) => opt.value === value);
    this.focusedIndex = selectedIdx;
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

document.addEventListener("click", () => {
  activeSelects.forEach((s) => {
    if (s.isOpen) s.close();
  });
});

document.addEventListener(APP_EVENTS.ACCENT_COLOR_CHANGED, () => {
  activeSelects.forEach((s) => {
    const selectedEl = s.optionsPanel?.querySelector(".is-selected");
    if (selectedEl) s.updateSelectedTextColor(selectedEl);
  });
});
