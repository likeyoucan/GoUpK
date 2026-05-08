// Файл: www/js/custom-select.js

import { getCssVariable, hexToRGB, getLuminance } from "./utils.js?v=VERSION";
import { APP_EVENTS } from "./constants/events.js?v=VERSION";

const activeSelects = new Set();
const TRANSITION_DURATION = 200;
const SELECT_MAX_VIEWPORT_K = 0.6; // 60dvh
const SELECT_MIN_HEIGHT_PX = 120;

// Shared scroll lock state
let scrollLockCount = 0;
let globalScrollBlockAttached = false;
let lockedScrollTargets = [];

/**
 * We lock scroll by:
 * 1) preventing wheel/touchmove/scroll-keys globally
 * 2) temporarily disabling overflow on known scroll containers
 *
 * NOTE: We avoid body: fixed to keep glass/backdrop visuals stable.
 */

function isInsideOpenSelectPanel(target) {
  if (!(target instanceof Node)) return false;

  for (const select of activeSelects) {
    if (!select?.isOpening || !select?.optionsPanel) continue;
    if (select.optionsPanel.contains(target)) return true;
  }

  return false;
}

function preventGlobalScrollEvent(e) {
  // Allow scrolling inside active dropdown panel
  if (isInsideOpenSelectPanel(e.target)) return;
  e.preventDefault();
  e.stopPropagation();
}

function preventGlobalScrollKeys(e) {
  const blockedKeys = [
    "ArrowUp",
    "ArrowDown",
    "PageUp",
    "PageDown",
    "Home",
    "End",
    " ",
  ];

  if (!blockedKeys.includes(e.key)) return;
  if (isInsideOpenSelectPanel(e.target)) return;

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

function collectScrollTargets() {
  const set = new Set();

  // Common page scroll roots
  if (document.scrollingElement instanceof HTMLElement) {
    set.add(document.scrollingElement);
  }
  if (document.documentElement instanceof HTMLElement) set.add(document.documentElement);
  if (document.body instanceof HTMLElement) set.add(document.body);

  // App-specific scrollable containers
  document
    .querySelectorAll(
      "#view-settings, .scroll-lock, .no-scrollbar, #sw-lapsContainer, #tb-workoutsList, #sw-sessionsList, #tb-modal-form",
    )
    .forEach((el) => {
      if (el instanceof HTMLElement) set.add(el);
    });

  return [...set];
}

function disableScrollOnTargets() {
  const targets = collectScrollTargets();
  lockedScrollTargets = targets.map((el) => ({
    el,
    overflow: el.style.overflow,
    overflowY: el.style.overflowY,
    touchAction: el.style.touchAction,
    overscrollBehavior: el.style.overscrollBehavior,
    overscrollBehaviorY: el.style.overscrollBehaviorY,
  }));

  lockedScrollTargets.forEach(({ el }) => {
    el.style.overflow = "hidden";
    el.style.overflowY = "hidden";
    el.style.touchAction = "none";
    el.style.overscrollBehavior = "none";
    el.style.overscrollBehaviorY = "none";
  });
}

function restoreScrollOnTargets() {
  lockedScrollTargets.forEach((row) => {
    row.el.style.overflow = row.overflow;
    row.el.style.overflowY = row.overflowY;
    row.el.style.touchAction = row.touchAction;
    row.el.style.overscrollBehavior = row.overscrollBehavior;
    row.el.style.overscrollBehaviorY = row.overscrollBehaviorY;
  });

  lockedScrollTargets = [];
}

function lockPageScroll() {
  scrollLockCount += 1;
  if (scrollLockCount > 1) return;

  attachGlobalScrollBlock();
  disableScrollOnTargets();
}

function unlockPageScroll() {
  if (scrollLockCount <= 0) {
    scrollLockCount = 0;
    return;
  }

  scrollLockCount -= 1;
  if (scrollLockCount > 0) return;

  detachGlobalScrollBlock();
  restoreScrollOnTargets();
}

export class CustomSelect {
  constructor(elementId, options, onSelect, initialValue) {
    this.container = document.getElementById(elementId);
    if (!this.container) return;

    this.options = options;
    this.onSelect = onSelect;
    this.currentValue = initialValue;
    this.isOpening = false;
    this.focusedIndex = -1;

    this._onViewportChange = null;
    this._rafReposition = 0;
    this._placement = "bottom";
    this._originalParent = null;
    this._nextSibling = null;
    this._didLockScroll = false;

    this.render();
    this.attachEventListeners();
    activeSelects.add(this);
  }

  destroy() {
    if (!this.container) return;

    if (this._onViewportChange) {
      window.removeEventListener("resize", this._onViewportChange);
      window.removeEventListener("scroll", this._onViewportChange, true);
      this._onViewportChange = null;
    }

    if (this._rafReposition) {
      cancelAnimationFrame(this._rafReposition);
      this._rafReposition = 0;
    }

    if (this._didLockScroll) {
      this._didLockScroll = false;
      unlockPageScroll();
    }

    this._restorePanelToContainer();

    activeSelects.delete(this);
    this.container.replaceChildren();
    this.container.classList.remove("custom-select-container", "relative", "is-open");
  }

  render() {
    this.container.replaceChildren();

    this.trigger = document.createElement("div");
    this.trigger.className =
      "custom-select-trigger app-surface rounded-lg border app-border shadow-sm flex items-center justify-between w-full py-1.5 pl-3 pr-2 cursor-pointer transition-colors";
    this.trigger.setAttribute("role", "button");
    this.trigger.setAttribute("tabindex", "0");
    this.trigger.setAttribute("aria-haspopup", "listbox");
    this.trigger.setAttribute("aria-expanded", "false");

    this.selectedValueEl = document.createElement("span");
    this.selectedValueEl.className = "custom-select-value text-sm font-bold";

    const arrowSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    arrowSvg.setAttribute("focusable", "false");
    arrowSvg.setAttribute("aria-hidden", "true");
    arrowSvg.setAttribute("viewBox", "0 0 24 24");
    arrowSvg.classList.add("w-4", "h-4", "app-text-sec", "transition-transform", "duration-300");

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

  populateOptions() {
    this.optionsPanel.replaceChildren();

    const fragment = document.createDocumentFragment();

    this.options.forEach((option, index) => {
      const optionEl = document.createElement("div");
      optionEl.className = "custom-select-option";
      optionEl.setAttribute("role", "option");
      optionEl.setAttribute("tabindex", "-1");
      optionEl.id = `${this.container.id}-option-${index}`;
      optionEl.dataset.value = option.value;
      optionEl.dataset.index = String(index);
      optionEl.appendChild(document.createTextNode(option.text));

      if (option.value === this.currentValue) {
        optionEl.classList.add("is-selected");
        optionEl.setAttribute("aria-selected", "true");
        this.updateSelectedTextColor(optionEl);
        this.focusedIndex = index;
      } else {
        optionEl.setAttribute("aria-selected", "false");
      }

      fragment.appendChild(optionEl);
    });

    this.optionsPanel.appendChild(fragment);
  }

  attachEventListeners() {
    this.trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      this.toggle();
    });

    this.trigger.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        this.toggle();
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (!this.isOpening) this.open();
        this.moveFocus(1);
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (!this.isOpening) this.open();
        this.moveFocus(-1);
      }
    });

    this.optionsPanel.addEventListener("keydown", (e) => {
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
    });

    this.optionsPanel.addEventListener("click", (e) => {
      const target = e.target.closest(".custom-select-option");
      if (target) {
        this.setValue(target.dataset.value);
        this.close();
        this.trigger.focus();
      }
    });

    this.optionsPanel.addEventListener("mouseover", (e) => {
      const target = e.target.closest(".custom-select-option");
      if (!target) return;
      this.focusedIndex = Number(target.dataset.index);
      this.syncAriaActive();
      this.updateSelectedTextColor(target);
    });

    this.optionsPanel.addEventListener("mouseout", (e) => {
      const target = e.target.closest(".custom-select-option");
      if (target) target.classList.remove("needs-dark-text");
    });

    this._onViewportChange = (ev) => {
      if (!this.isOpening) return;
      if (ev?.target && this.optionsPanel.contains(ev.target)) return;
      this.scheduleReposition();
    };

    window.addEventListener("resize", this._onViewportChange, { passive: true });
    window.addEventListener("scroll", this._onViewportChange, {
      passive: true,
      capture: true,
    });
  }

  _movePanelToBody() {
    if (!this.optionsPanel || this.optionsPanel.parentElement === document.body) return;
    this._originalParent = this.optionsPanel.parentElement;
    this._nextSibling = this.optionsPanel.nextSibling;
    document.body.appendChild(this.optionsPanel);
  }

  _restorePanelToContainer() {
    if (!this.optionsPanel || !this._originalParent) return;

    if (this._nextSibling && this._nextSibling.parentNode === this._originalParent) {
      this._originalParent.insertBefore(this.optionsPanel, this._nextSibling);
    } else {
      this._originalParent.appendChild(this.optionsPanel);
    }

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
    if (this._rafReposition) return;
    this._rafReposition = requestAnimationFrame(() => {
      this._rafReposition = 0;
      this.positionPanel();
    });
  }

  positionPanel() {
    if (!this.trigger || !this.optionsPanel) return;

    const rect = this.trigger.getBoundingClientRect();
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
      const panelHeight = Math.min(maxHeight, this.optionsPanel.scrollHeight || maxHeight);
      top = Math.round(rect.top - gap - panelHeight);
      if (top < 8) top = 8;
    } else {
      top = Math.round(rect.bottom + gap);
      const maxTop = vh - 8 - Math.min(maxHeight, 120);
      if (top > maxTop) top = Math.max(8, maxTop);
    }

    this.optionsPanel.style.left = `${left}px`;
    this.optionsPanel.style.top = `${top}px`;
    this.optionsPanel.style.width = `${width}px`;
  }

  toggle() {
    this.isOpening ? this.close() : this.open();
  }

  open() {
    if (this.isOpening) return;
    this.isOpening = true;

    activeSelects.forEach((s) => {
      if (s !== this && s.isOpening) s.close();
    });

    this._movePanelToBody();
    this.optionsPanel.classList.remove("hidden");

    this.decidePlacement();
    this.positionPanel();

    if (!this._didLockScroll) {
      lockPageScroll();
      this._didLockScroll = true;
    }

    requestAnimationFrame(() => {
      this.positionPanel();
      this.optionsPanel.classList.add("is-open");
      this.arrow.style.transform = "rotate(180deg)";
      this.trigger.setAttribute("aria-expanded", "true");
      this.container.classList.add("is-open");

      const selectedIdx = this.options.findIndex((opt) => opt.value === this.currentValue);
      this.focusedIndex = selectedIdx >= 0 ? selectedIdx : 0;

      this.syncAriaActive();
      this.focusCurrentOption();
      this.optionsPanel.focus();
    });
  }

  close() {
    if (!this.isOpening && !this._didLockScroll) return;

    this.isOpening = false;
    this.optionsPanel.classList.remove("is-open");
    this.arrow.style.transform = "";
    this.trigger.setAttribute("aria-expanded", "false");
    this.container.classList.remove("is-open");
    this.trigger.removeAttribute("aria-activedescendant");

    if (this._rafReposition) {
      cancelAnimationFrame(this._rafReposition);
      this._rafReposition = 0;
    }

    if (this._didLockScroll) {
      this._didLockScroll = false;
      unlockPageScroll();
    }

    setTimeout(() => {
      if (!this.isOpening) {
        this.optionsPanel.classList.add("hidden");
        this.optionsPanel.style.left = "";
        this.optionsPanel.style.top = "";
        this.optionsPanel.style.width = "";
        this.optionsPanel.style.maxHeight = "";
        this.optionsPanel.style.overflowY = "";
        this.optionsPanel.style.overscrollBehavior = "";
        this._restorePanelToContainer();
      }
    }, TRANSITION_DURATION);
  }

  moveFocus(direction) {
    const optionEls = this.optionsPanel.querySelectorAll(".custom-select-option");
    if (!optionEls.length) return;

    if (this.focusedIndex < 0) this.focusedIndex = 0;
    else this.focusedIndex = (this.focusedIndex + direction + optionEls.length) % optionEls.length;

    this.syncAriaActive();
    this.focusCurrentOption();
  }

  focusCurrentOption() {
    const focused = this.getFocusedOptionEl();
    if (!focused) return;
    focused.scrollIntoView({ block: "nearest" });
  }

  getFocusedOptionEl() {
    return this.optionsPanel.querySelector(
      `.custom-select-option[data-index="${this.focusedIndex}"]`,
    );
  }

  syncAriaActive() {
    const focused = this.getFocusedOptionEl();
    if (!focused) return;
    this.trigger.setAttribute("aria-activedescendant", focused.id);
  }

  setValue(value, triggerOnSelect = true) {
    const selectedOption = this.options.find((opt) => opt.value === value);
    if (!selectedOption) return;

    this.currentValue = value;
    this.selectedValueEl.replaceChildren(document.createTextNode(selectedOption.text));

    this.optionsPanel.querySelectorAll(".custom-select-option").forEach((el) => {
      const isSelected = el.dataset.value === value;
      el.classList.toggle("is-selected", isSelected);
      el.setAttribute("aria-selected", isSelected.toString());
      if (isSelected) this.updateSelectedTextColor(el);
    });

    const selectedIdx = this.options.findIndex((opt) => opt.value === value);
    this.focusedIndex = selectedIdx;
    this.syncAriaActive();

    if (triggerOnSelect && typeof this.onSelect === "function") {
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
    if (s.isOpening) s.close();
  });
});

document.addEventListener(APP_EVENTS.ACCENT_COLOR_CHANGED, () => {
  activeSelects.forEach((s) => {
    const selectedEl = s.optionsPanel?.querySelector(".is-selected");
    if (selectedEl) s.updateSelectedTextColor(selectedEl);
  });
});
