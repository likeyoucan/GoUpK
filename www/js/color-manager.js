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
import { appProManager } from "./app-pro.js?v=VERSION";
import { APP_EVENTS } from "./constants/events.js?v=VERSION";

import {
  MAX_CUSTOM_COLORS,
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

import {
  captureRects,
  clearPickerFocusVisual,
  animateLayoutShift,
  animateNewSwatch,
  animateDeleteSwatch,
} from "./color/color-animations.js?v=VERSION";

import { showProMessage } from "./color/color-guards.js?v=VERSION";

const normalize = (c) => normalizeColor(normalizeHexColor, c);

export const colorManager = {
  customAccentColors: [],
  customBgColors: [],
  activeActionTarget: null,

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

    this._bindDesktopHorizontalScroll($("accent-colors-container"));
    this._bindDesktopHorizontalScroll($("bg-colors-container"));

    this._bindEvents();
  },

  _bindDesktopHorizontalScroll(container) {
    if (!container) return;
    if (container.dataset.wheelXBound === "1") return;
    container.dataset.wheelXBound = "1";

    container.addEventListener(
      "wheel",
      (e) => {
        const canScrollX = container.scrollWidth > container.clientWidth;
        if (!canScrollX) return;

        const mostlyVerticalWheel = Math.abs(e.deltaY) >= Math.abs(e.deltaX);
        const delta = mostlyVerticalWheel ? e.deltaY : e.deltaX;
        if (!delta) return;

        const prevLeft = container.scrollLeft;
        container.scrollLeft += delta;

        if (container.scrollLeft !== prevLeft) {
          e.preventDefault();
        }
      },
      { passive: false },
    );

    let isDown = false;
    let moved = false;
    let startX = 0;
    let startLeft = 0;

    const onMove = (e) => {
      if (!isDown) return;

      const dx = e.clientX - startX;
      if (Math.abs(dx) > 2) moved = true;

      container.scrollLeft = startLeft - dx;
    };

    const onUp = () => {
      if (!isDown) return;

      isDown = false;
      container.classList.remove("is-dragging-x");
      document.body.classList.remove("is-color-dragging");

      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("mouseleave", onUp);
      window.removeEventListener("blur", onUp);
    };

    container.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;

      const canScrollX = container.scrollWidth > container.clientWidth;
      if (!canScrollX) return;

      const interactiveTarget = e.target.closest(
        ".color-picker-wrapper input[type='color'], .color-action-btn, .color-btn",
      );
      if (interactiveTarget) return;

      isDown = true;
      moved = false;
      startX = e.clientX;
      startLeft = container.scrollLeft;

      container.classList.add("is-dragging-x");
      document.body.classList.add("is-color-dragging");

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
      window.addEventListener("mouseleave", onUp);
      window.addEventListener("blur", onUp);

      e.preventDefault();
    });

    container.addEventListener(
      "click",
      (e) => {
        if (!moved) return;
        e.preventDefault();
        e.stopPropagation();
        moved = false;
      },
      true,
    );
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

      const blockIfNoPro = (e) => {
        if (appProManager.canUse("custom_colors")) return;

        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation?.();

        showProMessage("custom_colors");
        return false;
      };

      picker.addEventListener("pointerdown", blockIfNoPro, { capture: true });
      picker.addEventListener("mousedown", blockIfNoPro, { capture: true });
      picker.addEventListener("touchstart", blockIfNoPro, {
        capture: true,
        passive: false,
      });
      picker.addEventListener("click", blockIfNoPro, { capture: true });

      picker.addEventListener("change", (e) => {
        if (!appProManager.canUse("custom_colors")) return;

        document.dispatchEvent(
          new CustomEvent(APP_EVENTS.COLOR_SELECTED, {
            detail: { type, color: e.target.value, fromPicker: true },
          }),
        );
      });

      picker.addEventListener("input", (e) => {
        if (!appProManager.canUse("custom_colors")) return;

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
  },

  _handleClick(event, type) {
    const swatchWrapper = event.target.closest(".color-swatch-wrapper");
    const pickerWrapper = event.target.closest(".color-picker-wrapper");
    const actionBtn = event.target.closest(".color-action-btn");

    if (actionBtn) {
      event.stopPropagation();

      if (actionBtn.dataset.action === "add") {
        if (!appProManager.canUse("custom_colors")) {
          showProMessage("custom_colors");
          this._hideActionButton();
          return;
        }
        this.addCustomColor(type);
      } else if (actionBtn.dataset.action === "delete") {
        if (!appProManager.canUse("custom_colors")) {
          showProMessage("custom_colors");
          this._hideActionButton();
          return;
        }
        this._deleteColor(actionBtn.dataset.color, type);
      }
      return;
    }

    if (pickerWrapper) {
      if (!appProManager.canUse("custom_colors")) {
        showProMessage("custom_colors");
        return;
      }

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

    const isCustom = swatchWrapper.dataset.custom === "true";
    if (isCustom && !appProManager.canUse("custom_colors")) {
      showProMessage("custom_colors");
      return;
    }

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

    if (isCustom) {
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

    if (isAdd) {
      btn.className =
        "color-action-btn w-full h-full inset-0 m-auto flex items-center justify-center rounded-full shadow-lg focus:outline-none custom-focus active:scale-90 transition-all";
      btn.setAttribute("aria-label", t("add_color"));
      updateAddButtonColor({ button: btn, color, hexToRGB, getLuminance });
      btn.append(createSVGIcon("M12 4.5v15m7.5-7.5h-15", ["w-5", "h-5"]));
    } else {
      btn.className =
        "color-action-btn flex items-center justify-center rounded-full shadow-lg focus:outline-none custom-focus active:scale-90 transition-transform";
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
    const allowed = appProManager.requirePro("custom_colors", () =>
      showProMessage("custom_colors"),
    );
    if (!allowed) return;

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

    const container = $(
      isAccent ? "accent-colors-container" : "bg-colors-container",
    );
    const pickerWrapper = picker?.closest(".color-picker-wrapper");

    clearPickerFocusVisual(pickerWrapper, picker);
    pickerWrapper?.classList.add("picker-commit-lock");

    const before = captureRects(container);

    this._hideActionButton();
    clearPickerFocusVisual(pickerWrapper, picker);
    sm.vibrate(40, "medium");

    customColors.push(newColor);
    persistCustomColors({ safeSetLS }, type, customColors);

    addColorToDOM({
      container,
      color: newColor,
      type,
      t,
    });

    const inserted = container?.querySelector(
      `.color-swatch-wrapper[data-color="${newColor}"]`,
    );

    requestAnimationFrame(() => {
      animateLayoutShift(container, before, { duration: 340 });
      animateNewSwatch(inserted);

      setTimeout(() => {
        pickerWrapper?.classList.remove("picker-commit-lock");
      }, 420);
    });

    document.dispatchEvent(
      new CustomEvent(APP_EVENTS.COLOR_SELECTED, {
        detail: { type, color: newColor, fromPicker: false },
      }),
    );
  },

  _deleteColor(color, type) {
    const allowed = appProManager.requirePro("custom_colors", () =>
      showProMessage("custom_colors"),
    );
    if (!allowed) return;

    sm.vibrate(35, "medium");
    this._hideActionButton();

    const isAccent = type === "accent";
    const container = $(
      isAccent ? "accent-colors-container" : "bg-colors-container",
    );
    const wrapper = container?.querySelector(
      `.color-swatch-wrapper[data-color="${color}"]`,
    );
    if (!wrapper) return;

    const swatchesBefore = [
      ...container.querySelectorAll(".color-swatch-wrapper"),
    ];
    const removedIdx = swatchesBefore.indexOf(wrapper);
    const follower =
      removedIdx >= 0
        ? swatchesBefore[removedIdx + 1] ||
          swatchesBefore[removedIdx - 1] ||
          null
        : null;

    document.dispatchEvent(
      new CustomEvent(APP_EVENTS.COLOR_DELETED, { detail: { type, color } }),
    );

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

    animateDeleteSwatch(wrapper)
      .catch(() => {})
      .finally(() => {
        const before = captureRects(container);

        wrapper.remove();

        requestAnimationFrame(() => {
          animateLayoutShift(container, before, {
            duration: 380,
            springTarget: follower,
          });
        });
      });
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
