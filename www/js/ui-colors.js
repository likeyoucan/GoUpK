// Файл: www/js/ui-colors.js

import {
  $,
  safeGetLS,
  safeSetLS,
  safeRemoveLS,
  showToast,
} from "./utils.js?v=VERSION";
import { t } from "./i18n.js?v=VERSION";
import { sm } from "./sound.js?v=VERSION";
import {
  isValidHex,
  getLuminance,
  hexToRGB,
  createSVGIcon,
} from "./color.js?v=VERSION";

const MAX_CUSTOM_COLORS = 50;
const STANDARD_ACCENT_COLORS = [
  "#22c55e",
  "#3b82f6",
  "#a855f7",
  "#ec4899",
  "#f97316",
  "#ef4444",
  "#6366f1",
  "#e11d48",
];
const STANDARD_BG_COLORS = [
  "default",
  "#60a5fa",
  "#c084fc",
  "#f472b6",
  "#34d399",
  "#facc15",
  "#f87171",
  "#2dd4bf",
];

export const colorsManager = {
  // --- Состояние ---
  currentAccent: "",
  currentBg: "default",
  customAccentColors: [],
  customBgColors: [],
  activeActionTarget: null,
  coordinator: null,

  init(coordinator) {
    this.coordinator = coordinator; // Ссылка на главный themeManager
    this.applySettings();
    this._bindEvents();
    this._populateColorSection("accent");
    this._populateColorSection("bg");
    this.updateColorSelectionUI("accent", this.currentAccent, false);
    this.updateColorSelectionUI("bg", this.currentBg, false);
    this._syncPickerValues();
  },

  _bindEvents() {
    const addWheelScroll = (id) =>
      $(id)?.addEventListener(
        "wheel",
        (e) => {
          if (e.deltaY !== 0) {
            e.preventDefault();
            $(id).scrollLeft += e.deltaY;
          }
        },
        { passive: false },
      );
    addWheelScroll("accent-colors-container");
    addWheelScroll("bg-colors-container");

    $("accent-colors-container")?.addEventListener("click", (e) =>
      this._handleColorClick(e, "accent"),
    );
    $("bg-colors-container")?.addEventListener("click", (e) =>
      this._handleColorClick(e, "bg"),
    );

    // Этот листенер нужен для обновления цвета в реальном времени,
    // но основная логика выбора/добавления перенесена в _handleColorClick
    $("customColorInput")?.addEventListener("change", (e) =>
      this.setColor(e.target.value),
    );
    $("customBgInput")?.addEventListener("change", (e) =>
      this.setBgColor(e.target.value),
    );
  },

  applySettings() {
    try {
      this.customAccentColors =
        JSON.parse(safeGetLS("custom_accent_colors")) || [];
      this.customBgColors = JSON.parse(safeGetLS("custom_bg_colors")) || [];
    } catch (e) {
      this.customAccentColors = [];
      this.customBgColors = [];
    }
    this.currentAccent = safeGetLS("theme_color") || STANDARD_ACCENT_COLORS[0];
    this.currentBg = safeGetLS("theme_bg_color") || "default";
  },

  resetSettings() {
    safeRemoveLS("theme_color");
    safeRemoveLS("theme_bg_color");
    this.applySettings();
    this._populateColorSection("accent");
    this._populateColorSection("bg");
    this.updateColorSelectionUI("accent", this.currentAccent, false);
    this.updateColorSelectionUI("bg", this.currentBg, false);
    this._syncPickerValues();
  },

  setColor(hex) {
    this.coordinator.setColor(hex);
  },
  setBgColor(hex) {
    this.coordinator.setBgColor(hex);
  },

  _handleColorClick(event, type) {
    const swatchWrapper = event.target.closest(".color-swatch-wrapper");
    const pickerWrapper = event.target.closest(".color-picker-wrapper");
    const actionBtn = event.target.closest(".color-action-btn");

    if (actionBtn) {
      if (actionBtn.dataset.action === "delete") {
        this._deleteColorWithAnimation(actionBtn.dataset.color, type);
      } else if (actionBtn.dataset.action === "add") {
        this.addCustomColor(type);
      }
      return;
    }

    if (swatchWrapper) {
      const color = swatchWrapper.dataset.color;
      const isCustom = swatchWrapper.dataset.custom === "true";
      const currentSelected =
        type === "accent" ? this.currentAccent : this.currentBg;

      if (color !== currentSelected) {
        sm.vibrate(20, "light");
        type === "accent" ? this.setColor(color) : this.setBgColor(color);
        if (isCustom) this._showActionButton(swatchWrapper, "delete");
      } else if (isCustom) {
        this.activeActionTarget === swatchWrapper
          ? this._hideActionButton()
          : this._showActionButton(swatchWrapper, "delete");
      }
    } else if (pickerWrapper) {
      const picker = pickerWrapper.querySelector('input[type="color"]');
      const color = picker.value.toLowerCase();
      const currentSelected = (
        type === "accent" ? this.currentAccent : this.currentBg
      ).toLowerCase();

      if (color !== currentSelected) {
        type === "accent" ? this.setColor(color) : this.setBgColor(color);
      }

      if (this.activeActionTarget === pickerWrapper) {
        this._hideActionButton();
      } else {
        this._showActionButton(pickerWrapper, "add");
      }
    }
  },

  _showActionButton(targetWrapper, action) {
    if (this.activeActionTarget && this.activeActionTarget !== targetWrapper)
      this._hideActionButton();
    sm.vibrate(30, "medium");
    this.activeActionTarget = targetWrapper;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.action = action;

    const isAdd = action === "add";
    const color = isAdd
      ? targetWrapper.querySelector('input[type="color"]').value
      : targetWrapper.dataset.color;
    btn.dataset.color = color;

    btn.setAttribute("aria-label", t(isAdd ? "add_color" : "delete"));
    btn.className = `color-action-btn w-8 h-8 flex items-center justify-center rounded-full text-white shadow-lg focus:outline-none custom-focus active:scale-90 transition-transform ${isAdd ? "bg-green-500" : "bg-red-500"}`;

    const pathData = isAdd ? "M12 4.5v15m7.5-7.5h-15" : "M19.5 12h-15";
    btn.append(createSVGIcon(pathData, ["w-5", "h-5"]));
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
      showToast(isAccent ? t("accent_limit_msg") : t("bg_limit_msg"));
      return;
    }

    const picker = $(isAccent ? "customColorInput" : "customBgInput");
    const color = picker.value.toLowerCase();

    const allColors = [
      ...(isAccent ? STANDARD_ACCENT_COLORS : STANDARD_BG_COLORS),
      ...customColors,
    ].map((c) => c.toLowerCase());

    this._hideActionButton();

    if (allColors.includes(color)) {
      showToast(t("color_already_exists"));
      sm.vibrate(30, "medium");
      isAccent ? this.setColor(color) : this.setBgColor(color);
    } else {
      sm.vibrate(40, "medium");
      customColors.push(color);
      safeSetLS(
        isAccent ? "custom_accent_colors" : "custom_bg_colors",
        JSON.stringify(customColors),
      );
      this._addColorToDOM(color, type);
      isAccent ? this.setColor(color) : this.setBgColor(color);
    }
  },

  _deleteColorWithAnimation(color, type) {
    sm.vibrate(40, "medium");
    this._hideActionButton();
    const isAccent = type === "accent";
    const container = $(
      isAccent ? "accent-colors-container" : "bg-colors-container",
    );
    const wrapper = container.querySelector(
      `.color-swatch-wrapper[data-color="${color}"]`,
    );

    if (wrapper) {
      wrapper.classList.remove(
        "ring-[var(--primary-color)]",
        "ring-2",
        "ring-offset-2",
        "ring-offset-surface",
      );
      wrapper.classList.add("is-collapsing");
      wrapper.addEventListener(
        "transitionend",
        () => {
          wrapper.remove();
          let customColors = isAccent
            ? this.customAccentColors
            : this.customBgColors;
          const index = customColors.indexOf(color);
          if (index > -1) {
            customColors.splice(index, 1);
            safeSetLS(
              isAccent ? "custom_accent_colors" : "custom_bg_colors",
              JSON.stringify(customColors),
            );
          }
          const currentSelected = isAccent
            ? this.currentAccent
            : this.currentBg;
          if (currentSelected === color) {
            isAccent
              ? this.setColor(STANDARD_ACCENT_COLORS[0])
              : this.setBgColor("default");
          }
        },
        { once: true },
      );
    }
  },

  _populateColorSection(type) {
    const container = $(
      type === "accent" ? "accent-colors-container" : "bg-colors-container",
    );
    if (!container) return;
    container.innerHTML = "";
    const isAccent = type === "accent";
    const standard = isAccent ? STANDARD_ACCENT_COLORS : STANDARD_BG_COLORS;
    const custom = isAccent ? this.customAccentColors : this.customBgColors;
    [...standard, ...custom].forEach((color) =>
      container.append(this._createColorSwatch(color, custom.includes(color))),
    );
    container.append(this._createColorPicker(type));
  },

  _createColorSwatch(color, isCustom) {
    const wrapper = document.createElement("div");
    wrapper.className = "color-swatch-wrapper rounded-full";
    wrapper.dataset.color = color;
    wrapper.dataset.custom = isCustom;
    const button = document.createElement("button");
    button.type = "button";
    button.className =
      "color-btn w-9 h-9 flex items-center justify-center rounded-full shrink-0 transition-transform active:scale-90 border border-black/20 dark:border-white/20 focus:outline-none custom-focus";
    if (color === "default") {
      button.classList.add("default-bg-btn");
      button.setAttribute("aria-label", t("default_color"));
    } else {
      if (isValidHex(color)) button.style.backgroundColor = color;
      button.setAttribute("aria-label", color);
    }
    wrapper.append(button);
    return wrapper;
  },

  _createColorPicker(type) {
    const wrapper = document.createElement("div");
    wrapper.className =
      "color-picker-wrapper relative w-9 h-9 shrink-0 group rounded-full border border-black/20 dark:border-white/20 transition-transform active:scale-90 focus-within:ring-2 focus-within:ring-[var(--primary-color)] focus-within:ring-offset-2 focus-within:ring-offset-surface";
    const gradientBg = document.createElement("div");
    gradientBg.className =
      "absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,red,orange,yellow,green,blue,indigo,violet,red)] opacity-90 group-hover:opacity-100 transition-opacity pointer-events-none z-0";
    const input = document.createElement("input");
    input.type = "color";
    input.id = type === "accent" ? "customColorInput" : "customBgInput";
    input.setAttribute("aria-label", t("add_color"));
    input.className =
      "absolute inset-0 w-[150%] h-[150%] -top-1 -left-1 opacity-0 cursor-pointer z-10";
    wrapper.append(gradientBg, input);
    return wrapper;
  },

  _addColorToDOM(color, type) {
    const swatch = this._createColorSwatch(color, true);
    const container = $(
      type === "accent" ? "accent-colors-container" : "bg-colors-container",
    );
    const picker = container.querySelector(".color-picker-wrapper");
    if (picker) container.insertBefore(swatch, picker);
    else container.append(swatch);
  },

  updateColorSelectionUI(type, hex, doScroll = true) {
    const container = $(
      type === "accent" ? "accent-colors-container" : "bg-colors-container",
    );
    if (!container) return;

    container
      .querySelectorAll(".color-swatch-wrapper, .color-picker-wrapper")
      .forEach((el) => {
        el.classList.remove(
          "ring-[var(--primary-color)]",
          "ring-2",
          "ring-offset-2",
          "ring-offset-surface",
        );
        el.querySelector(".color-btn")?.querySelector("svg")?.remove();
        el.querySelector(".injected-checkmark")?.remove();
      });

    let activeWrapper = container.querySelector(
      `.color-swatch-wrapper[data-color="${hex}"]`,
    );
    if (!activeWrapper) {
      const picker = $(
        type === "accent" ? "customColorInput" : "customBgInput",
      );
      if (picker && picker.value.toLowerCase() === hex.toLowerCase()) {
        activeWrapper = picker.closest(".color-picker-wrapper");
      }
    }

    if (activeWrapper) {
      activeWrapper.classList.add(
        "ring-[var(--primary-color)]",
        "ring-2",
        "ring-offset-2",
        "ring-offset-surface",
      );

      const isPicker = activeWrapper.matches(".color-picker-wrapper");
      const isDefault = hex === "default";
      const isDark = document.documentElement.classList.contains("dark");

      let iconColor;
      if (isPicker) {
        iconColor = "#ffffff";
      } else if (isDefault) {
        iconColor = isDark ? "#ffffff" : "#1f2937";
      } else {
        const { r, g, b } = hexToRGB(hex);
        iconColor = getLuminance(r, g, b) > 0.5 ? "#1f2937" : "#ffffff";
      }

      const svgIcon = createSVGIcon("M4.5 12.75l6 6 9-13.5", ["w-5", "h-5"]);
      svgIcon.style.color = iconColor;

      if (isPicker) {
        svgIcon.classList.add(
          "injected-checkmark",
          "absolute",
          "inset-0",
          "m-auto",
          "z-20",
          "pointer-events-none",
        );
        activeWrapper.append(svgIcon);
      } else {
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

  _syncPickerValues() {
    const accentPicker = $("customColorInput");
    if (accentPicker && isValidHex(this.currentAccent)) {
      accentPicker.value = this.currentAccent;
    }

    const bgPicker = $("customBgInput");
    if (bgPicker) {
      if (isValidHex(this.currentBg)) {
        bgPicker.value = this.currentBg;
      } else {
        const isDark = document.documentElement.classList.contains("dark");
        bgPicker.value = isDark ? "#000000" : "#f3f4f6";
      }
    }
  },
};
