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

const MAX_CUSTOM_COLORS = 50;
const LONG_PRESS_DURATION = 500;
const MOVE_CANCEL_THRESHOLD = 8;

const normalizeColor = (c) => (c ? normalizeHexColor(c).toLowerCase() : "");

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
    try {
      this.customAccentColors =
        JSON.parse(safeGetLS("custom_accent_colors")) || [];
      this.customBgColors = JSON.parse(safeGetLS("custom_bg_colors")) || [];
    } catch (e) {
      this.customAccentColors = [];
      this.customBgColors = [];
    }
  },

  _bindEvents() {
    this._bindContainerEvents("accent-colors-container", "accent");
    this._bindContainerEvents("bg-colors-container", "bg");

    const setupPickerEvents = (type) => {
      const picker = $(
        type === "accent" ? "customColorInput" : "customBgInput",
      );
      if (!picker) return;

      picker.addEventListener("change", (e) => {
        document.dispatchEvent(
          new CustomEvent("colorSelected", {
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
          if (actionBtn) this._updateAddButtonColor(actionBtn, e.target.value);
        }
      });
    };
    setupPickerEvents("accent");
    setupPickerEvents("bg");
  },

  _bindContainerEvents(containerId, type) {
    const container = $(containerId);
    if (!container) return;

    container.addEventListener("click", (e) => this._handleClick(e, type));

    container.addEventListener("contextmenu", (e) => {
      const swatch = e.target.closest(
        '.color-swatch-wrapper[data-custom="true"]',
      );
      if (swatch) {
        e.preventDefault();
        this._showActionButton(swatch, "delete");
      }
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

        if (this.longPressTimer) {
          clearTimeout(this.longPressTimer);
          this.longPressTimer = null;
        }

        this.longPressTimer = setTimeout(() => {
          if (!touchMoved) {
            this._showActionButton(swatch, "delete");
          }
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
      else if (actionBtn.dataset.action === "delete")
        this._deleteColor(actionBtn.dataset.color, type);
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

    if (swatchWrapper) {
      if (this.activeActionTarget === swatchWrapper) {
        this._hideActionButton();
        return;
      }

      const color = swatchWrapper.dataset.color;
      document.dispatchEvent(
        new CustomEvent("colorSelected", {
          detail: { type, color, fromPicker: false },
        }),
      );
      if (swatchWrapper.dataset.custom === "true") {
        this._showActionButton(swatchWrapper, "delete");
      }
    }
  },

  _updateAddButtonColor(button, newColor) {
    button.style.backgroundColor = newColor;
    button.dataset.color = newColor;
    const { r, g, b } = hexToRGB(newColor);
    const luminance = getLuminance(r, g, b);
    button.style.color = luminance > 0.5 ? "#1f2937" : "#ffffff";
  },

  _showActionButton(targetWrapper, action) {
    if (this.activeActionTarget && this.activeActionTarget !== targetWrapper)
      this._hideActionButton();

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
      : "color-action-btn w-5 h-5 flex items-center justify-center rounded-full shadow-lg focus:outline-none custom-focus active:scale-90 transition-all";

    if (isAdd) {
      btn.setAttribute("aria-label", t("add_color"));
      this._updateAddButtonColor(btn, color);
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
    const newColor = normalizeColor(picker.value);

    const baseBlocklist = (
      isAccent
        ? [...this.standardAccentColors, ...this.customAccentColors]
        : [...this.standardBgColors, ...this.customBgColors]
    ).map(normalizeColor);

    if (baseBlocklist.includes(newColor)) {
      this._hideActionButton();
      showToast(t("color_already_exists"));
      return;
    }

    const currentTheme = themeManager.getCurrentTheme();
    const cssVarName = isAccent
      ? `--default-accent-${currentTheme}`
      : `--default-bg-${currentTheme}`;
    const activeDefaultColor = normalizeColor(getCssVariable(cssVarName));

    if (newColor === activeDefaultColor) {
      this._hideActionButton();
      showToast(t("color_already_exists"));
      return;
    }

    this._hideActionButton();
    sm.vibrate(40, "medium");
    customColors.push(newColor);
    safeSetLS(
      isAccent ? "custom_accent_colors" : "custom_bg_colors",
      JSON.stringify(customColors),
    );
    this._addColorToDOM(newColor, type);
    document.dispatchEvent(
      new CustomEvent("colorSelected", {
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
    const wrapper = container.querySelector(
      `.color-swatch-wrapper[data-color="${color}"]`,
    );
    if (!wrapper) return;

    document.dispatchEvent(
      new CustomEvent("colorDeleted", { detail: { type, color } }),
    );

    let removed = false;
    const doRemove = () => {
      if (removed) return;
      removed = true;
      wrapper.remove();
      let customColors = isAccent
        ? this.customAccentColors
        : this.customBgColors;
      const index = customColors
        .map(normalizeColor)
        .indexOf(normalizeColor(color));
      if (index > -1) {
        customColors.splice(index, 1);
        safeSetLS(
          isAccent ? "custom_accent_colors" : "custom_bg_colors",
          JSON.stringify(customColors),
        );
      }
    };

    wrapper.classList.add("is-collapsing");
    wrapper.addEventListener("transitionend", doRemove, { once: true });
    setTimeout(doRemove, 600);
  },

  populateColorSection(type) {
    const container = $(
      type === "accent" ? "accent-colors-container" : "bg-colors-container",
    );
    if (!container) return;
    container
      .querySelectorAll(".color-swatch-wrapper")
      .forEach((el) => el.remove());
    const isAccent = type === "accent";
    const colors = [
      ...(isAccent ? this.standardAccentColors : this.standardBgColors),
      ...(isAccent ? this.customAccentColors : this.customBgColors),
    ];
    const picker = container.querySelector(".color-picker-wrapper");
    colors.forEach((color) => {
      const isCustom = (
        isAccent ? this.customAccentColors : this.customBgColors
      ).includes(color);
      container.insertBefore(
        this._createColorSwatch(color, isCustom, type),
        picker,
      );
    });
  },

  _createColorSwatch(color, isCustom, type) {
    const wrapper = document.createElement("div");
    wrapper.className = "color-swatch-wrapper relative rounded-full";
    wrapper.dataset.color = color;
    wrapper.dataset.custom = String(isCustom);
    const button = document.createElement("button");
    button.type = "button";
    button.className =
      "color-btn w-9 h-9 flex items-center justify-center rounded-full shrink-0 transition-transform active:scale-90 border border-black/20 dark:border-white/20 focus:outline-none custom-focus";
    button.setAttribute(
      "aria-label",
      color === "default" ? t("default_color") : color,
    );

    if (color === "default") {
      if (type === "accent") {
        button.classList.add("default-accent-btn");
      } else {
        button.classList.add("default-bg-btn");
      }
    } else {
      button.style.backgroundColor = color;
    }

    wrapper.append(button);
    return wrapper;
  },

  _addColorToDOM(color, type) {
    const swatch = this._createColorSwatch(color, true, type);
    const container = $(
      type === "accent" ? "accent-colors-container" : "bg-colors-container",
    );
    const picker = container.querySelector(".color-picker-wrapper");
    container.insertBefore(swatch, picker);
  },

  updateSelectionUI(type, color, doScroll = true) {
    const container = $(
      type === "accent" ? "accent-colors-container" : "bg-colors-container",
    );
    if (!container) return;

    container
      .querySelectorAll(".color-swatch-wrapper, .color-picker-wrapper")
      .forEach((el) => {
        el.classList.remove(
          "ring-2",
          "ring-[var(--primary-color)]",
          "ring-offset-2",
          "ring-offset-surface",
        );
        el.querySelector(".injected-checkmark")?.remove();
      });

    const normalizedColor = normalizeColor(color);
    let activeWrapper = container.querySelector(
      `.color-swatch-wrapper[data-color="${normalizedColor}"]`,
    );

    if (!activeWrapper) {
      const picker = $(
        type === "accent" ? "customColorInput" : "customBgInput",
      );
      if (picker && normalizeColor(picker.value) === normalizedColor) {
        activeWrapper = picker.closest(".color-picker-wrapper");
      }
    }

    if (activeWrapper) {
      activeWrapper.classList.add(
        "ring-2",
        "ring-[var(--primary-color)]",
        "ring-offset-2",
        "ring-offset-surface",
      );
      if (!activeWrapper.matches(".color-picker-wrapper")) {
        const isDefault = normalizedColor === "default";
        let luminance;

        if (isDefault) {
          const cssVar = type === "accent" ? "--primary-color" : "--bg-color";
          const currentTheme = themeManager.getCurrentTheme();
          const defaultVarForTheme =
            type === "accent"
              ? getCssVariable(`--default-accent-${currentTheme}`)
              : getCssVariable(`--default-bg-${currentTheme}`);
          const currentColor = getCssVariable(cssVar) || defaultVarForTheme;
          luminance = getLuminance(...Object.values(hexToRGB(currentColor)));
        } else {
          luminance = getLuminance(...Object.values(hexToRGB(normalizedColor)));
        }
        const iconColor = luminance > 0.5 ? "#1f2937" : "#ffffff";
        const svgIcon = createSVGIcon("M4.5 12.75l6 6 9-13.5", [
          "w-5",
          "h-5",
          "injected-checkmark",
        ]);
        svgIcon.style.color = iconColor;
        activeWrapper.querySelector(".color-btn")?.append(svgIcon);
      }
      if (doScroll)
        activeWrapper.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
          inline: "center",
        });
    }
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
      this._updateAddButtonColor(addButton, picker.value);
    }
  },
};
