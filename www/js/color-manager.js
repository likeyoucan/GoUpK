// Файл: www/js/color-manager.js

import {
  $,
  safeGetLS,
  safeSetLS,
  showToast,
  createSVGIcon,
  getLuminance,
  hexToRGB,
  getCssVariable,
  normalizeHexColor,
} from "./utils.js?v=VERSION";
import { t } from "./i18n.js?v=VERSION";
import { sm } from "./sound.js?v=VERSION";
import { themeManager } from "./theme.js?v=VERSION";
import { APP_EVENTS } from "./constants/events.js?v=VERSION";

import {
  MAX_CUSTOM_COLORS,
  LONG_PRESS_DURATION,
  MOVE_CANCEL_THRESHOLD,
  normalizeColor,
  loadCustomColors,
  persistCustomColors,
  removeColorFromList,
  buildBlocklist,
} from "./color/color-data.js?v=VERSION";

import {
  populateColorSection,
  addColorToDOM,
  updateAddButtonColor,
  updateSelectionUI,
} from "./color/color-ui.js?v=VERSION";

const normalize = (c) => normalizeColor(normalizeHexColor, c);

export const colorManager = {
  customAccentColors: [],
  customBgColors: [],
  activeActionTarget: null,
  longPressTimer: null,

  standardAccentColors: [
    "default",
    "#3b82f6",
    "#a855f7",
    "#ec4899",
    "#f97316",
    "#ef4444",
    "#6366f1",
    "#e11d48",
  ],
  standardBgColors: [
    "default",
    "#60a5fa",
    "#c084fc",
    "#f472b6",
    "#34d399",
    "#facc15",
    "#f87171",
    "#2dd4bf",
  ],

  init() {
    this.loadColors();
    this.populateColorSection("accent");
    this.populateColorSection("bg");
    this._bindEvents();
  },

  loadColors() {
    const data = loadCustomColors({ safeGetLS });
    this.customAccentColors = data.accent;
    this.customBgColors = data.bg;
  },

  _bindEvents() {
    this._bindContainerEvents("accent-colors-container", "accent");
    this._bindContainerEvents("bg-colors-container", "bg");

    const bindPicker = (type) => {
      const picker = $(
        type === "accent" ? "customColorInput" : "customBgInput",
      );
      if (!picker) return;

      picker.addEventListener("change", (e) => {
        document.dispatchEvent(
          new CustomEvent(APP_EVENTS.COLOR_SELECTED, {
            detail: { type, color: e.target.value, fromPicker: true },
          }),
        );
      });

      picker.addEventListener("input", (e) => {
        const pickerWrapper = picker.closest(".color-picker-wrapper");
        if (this.activeActionTarget === pickerWrapper) {
          const actionBtn = pickerWrapper.querySelector(
            '.color-action-btn[data-action="add"]',
          );
          if (actionBtn) {
            updateAddButtonColor({
              button: actionBtn,
              color: e.target.value,
              hexToRGB,
              getLuminance,
            });
          }
        }
      });
    };

    bindPicker("accent");
    bindPicker("bg");
  },

  _bindContainerEvents(containerId, type) {
    const container = $(containerId);
    if (!container) return;

    container.addEventListener("click", (e) => this._handleClick(e, type));

    container.addEventListener("contextmenu", (e) => {
      const swatch = e.target.closest(
        '.color-swatch-wrapper[data-custom="true"]',
      );
      if (!swatch) return;
      e.preventDefault();
      this._showActionButton(swatch, "delete");
    });

    let touchMoved = false;
    let touchStartX = 0;
    let touchStartY = 0;

    container.addEventListener(
      "touchstart",
      (e) => {
        const swatch = e.target.closest(
          '.color-swatch-wrapper[data-custom="true"]',
        );
        if (!swatch) return;

        touchMoved = false;
        const touch = e.touches?.[0];
        touchStartX = touch?.clientX ?? 0;
        touchStartY = touch?.clientY ?? 0;

        if (this.longPressTimer) clearTimeout(this.longPressTimer);

        this.longPressTimer = setTimeout(() => {
          if (!touchMoved) this._showActionButton(swatch, "delete");
          this.longPressTimer = null;
        }, LONG_PRESS_DURATION);
      },
      { passive: true },
    );

    container.addEventListener(
      "touchmove",
      (e) => {
        const touch = e.touches?.[0];
        if (!touch) return;

        const dx = Math.abs(touch.clientX - touchStartX);
        const dy = Math.abs(touch.clientY - touchStartY);

        if (dx > MOVE_CANCEL_THRESHOLD || dy > MOVE_CANCEL_THRESHOLD) {
          touchMoved = true;
          if (this.longPressTimer) {
            clearTimeout(this.longPressTimer);
            this.longPressTimer = null;
          }
        }
      },
      { passive: true },
    );

    const endTouch = () => {
      if (this.longPressTimer) {
        clearTimeout(this.longPressTimer);
        this.longPressTimer = null;
      }
    };

    container.addEventListener("touchend", endTouch, { passive: true });
    container.addEventListener("touchcancel", endTouch, { passive: true });
  },

  _handleClick(event, type) {
    const swatchWrapper = event.target.closest(".color-swatch-wrapper");
    const pickerWrapper = event.target.closest(".color-picker-wrapper");
    const actionBtn = event.target.closest(".color-action-btn");

    if (actionBtn) {
      event.stopPropagation();
      if (actionBtn.dataset.action === "add") this.addCustomColor(type);
      else if (actionBtn.dataset.action === "delete") {
        this._deleteColor(actionBtn.dataset.color, type);
      }
      return;
    }

    if (pickerWrapper) {
      if (this.activeActionTarget === pickerWrapper) this._hideActionButton();
      else this._showActionButton(pickerWrapper, "add");
      return;
    }

    if (
      this.activeActionTarget &&
      !this.activeActionTarget.contains(event.target)
    ) {
      this._hideActionButton();
    }

    if (!swatchWrapper) return;

    if (this.activeActionTarget === swatchWrapper) {
      this._hideActionButton();
      return;
    }

    const color = swatchWrapper.dataset.color;
    document.dispatchEvent(
      new CustomEvent(APP_EVENTS.COLOR_SELECTED, {
        detail: { type, color, fromPicker: false },
      }),
    );

    if (swatchWrapper.dataset.custom === "true") {
      this._showActionButton(swatchWrapper, "delete");
    }
  },

  _showActionButton(targetWrapper, action) {
    if (this.activeActionTarget && this.activeActionTarget !== targetWrapper) {
      this._hideActionButton();
    }

    sm.vibrate(30, "medium");
    this.activeActionTarget = targetWrapper;

    const isAdd = action === "add";
    const color = isAdd
      ? targetWrapper.querySelector('input[type="color"]').value
      : targetWrapper.dataset.color;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.action = action;
    btn.className = isAdd
      ? "color-action-btn w-full h-full inset-0 m-auto flex items-center justify-center rounded-full shadow-lg focus:outline-none custom-focus active:scale-90 transition-all"
      : "color-action-btn flex items-center justify-center rounded-full shadow-lg focus:outline-none custom-focus active:scale-90 transition-all";

    if (isAdd) {
      btn.setAttribute("aria-label", t("add_color"));
      updateAddButtonColor({ button: btn, color, hexToRGB, getLuminance });
      btn.append(createSVGIcon("M12 4.5v15m7.5-7.5h-15", ["w-5", "h-5"]));
    } else {
      btn.setAttribute("aria-label", `${t("delete")} ${color}`);
      btn.classList.add("bg-red-500", "text-white");
      btn.dataset.color = color;
      btn.append(createSVGIcon("M6 18L18 6M6 6l12 12", ["w-5", "h-5"]));
    }

    targetWrapper.append(btn);
  },

  _hideActionButton() {
    if (!this.activeActionTarget) return;

    const btn = this.activeActionTarget.querySelector(".color-action-btn");
    if (btn) {
      btn.classList.add("is-hiding");
      btn.addEventListener("animationend", () => btn.remove(), { once: true });
    }

    this.activeActionTarget = null;
  },

  addCustomColor(type) {
    const isAccent = type === "accent";
    const customColors = isAccent
      ? this.customAccentColors
      : this.customBgColors;

    if (customColors.length >= MAX_CUSTOM_COLORS) {
      showToast(t(isAccent ? "accent_limit_msg" : "bg_limit_msg"));
      return;
    }

    const picker = $(isAccent ? "customColorInput" : "customBgInput");
    const newColor = normalize(picker.value);

    const blocklist = buildBlocklist({
      isAccent,
      standardAccentColors: this.standardAccentColors,
      standardBgColors: this.standardBgColors,
      customAccentColors: this.customAccentColors,
      customBgColors: this.customBgColors,
      normalizeHexColor,
    });

    if (blocklist.includes(newColor)) {
      this._hideActionButton();
      showToast(t("color_already_exists"));
      return;
    }

    const currentTheme = themeManager.getCurrentTheme();
    const cssVarName = isAccent
      ? `--default-accent-${currentTheme}`
      : `--default-bg-${currentTheme}`;
    const activeDefaultColor = normalize(getCssVariable(cssVarName));

    if (newColor === activeDefaultColor) {
      this._hideActionButton();
      showToast(t("color_already_exists"));
      return;
    }

    this._hideActionButton();
    sm.vibrate(40, "medium");

    customColors.push(newColor);
    persistCustomColors({ safeSetLS }, type, customColors);

    addColorToDOM({
      container: $(
        isAccent ? "accent-colors-container" : "bg-colors-container",
      ),
      color: newColor,
      type,
      t,
    });

    document.dispatchEvent(
      new CustomEvent(APP_EVENTS.COLOR_SELECTED, {
        detail: { type, color: newColor, fromPicker: false },
      }),
    );
  },

  _deleteColor(color, type) {
    sm.vibrate(40, "medium");
    this._hideActionButton();

    const isAccent = type === "accent";
    const container = $(
      isAccent ? "accent-colors-container" : "bg-colors-container",
    );
    const wrapper = container?.querySelector(
      `.color-swatch-wrapper[data-color="${color}"]`,
    );
    if (!wrapper) return;

    document.dispatchEvent(
      new CustomEvent(APP_EVENTS.COLOR_DELETED, { detail: { type, color } }),
    );

    let removed = false;

    const doRemove = () => {
      if (removed) return;
      removed = true;

      wrapper.remove();

      const customColors = isAccent
        ? this.customAccentColors
        : this.customBgColors;
      const didRemove = removeColorFromList(
        { normalizeHexColor },
        customColors,
        color,
      );
      if (didRemove) {
        persistCustomColors({ safeSetLS }, type, customColors);
      }
    };

    wrapper.classList.add("is-collapsing");
    wrapper.addEventListener("transitionend", doRemove, { once: true });
    setTimeout(doRemove, 600);
  },

  populateColorSection(type) {
    const isAccent = type === "accent";
    const container = $(
      isAccent ? "accent-colors-container" : "bg-colors-container",
    );

    populateColorSection({
      container,
      type,
      standardColors: isAccent
        ? this.standardAccentColors
        : this.standardBgColors,
      customColors: isAccent ? this.customAccentColors : this.customBgColors,
      t,
    });
  },

  updateSelectionUI(type, color, doScroll = true) {
    const container = $(
      type === "accent" ? "accent-colors-container" : "bg-colors-container",
    );

    updateSelectionUI({
      container,
      type,
      color,
      doScroll,
      normalizeColor: normalize,
      themeManager,
      getCssVariable,
      hexToRGB,
      getLuminance,
      createSVGIcon,
    });
  },

  syncPickers(accentColor, bgColor) {
    const accentPicker = $("customColorInput");
    const bgPicker = $("customBgInput");
    const currentTheme = themeManager.getCurrentTheme();

    if (accentPicker) {
      const resolvedAccent =
        accentColor === "default"
          ? getCssVariable(`--default-accent-${currentTheme}`)
          : accentColor;
      accentPicker.value = normalizeHexColor(resolvedAccent);
    }

    if (bgPicker) {
      const resolvedBg =
        bgColor === "default"
          ? getCssVariable(`--default-bg-${currentTheme}`)
          : bgColor;
      bgPicker.value = normalizeHexColor(resolvedBg);
    }

    this.syncActiveAddButton();
  },

  syncActiveAddButton() {
    if (!this.activeActionTarget) return;

    const addButton = this.activeActionTarget.querySelector(
      '.color-action-btn[data-action="add"]',
    );
    if (!addButton) return;

    const picker = this.activeActionTarget.querySelector('input[type="color"]');
    if (picker) {
      updateAddButtonColor({
        button: addButton,
        color: picker.value,
        hexToRGB,
        getLuminance,
      });
    }
  },
};
