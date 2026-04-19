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
// Системные цвета для проверки дубликатов
const SYSTEM_DEFAULT_COLORS = ["#f3f4f6", "#000000", "#1c1c1e", "#ffffff"];

export const colorsManager = {
  currentAccent: "",
  currentBg: "default",
  customAccentColors: [],
  customBgColors: [],
  activeActionTarget: null,
  coordinator: null,

  init(coordinator) {
    this.coordinator = coordinator;
    this.applySettings();
    this._bindEvents();
    this._populateColorSection("accent");
    this._populateColorSection("bg");
    this.updateColorSelectionUI("accent", this.currentAccent, false);
    this.updateColorSelectionUI("bg", this.currentBg, false);
    this._syncPickerValues();
  },

  _bindEvents() {
    // --- Колесико мыши для скролла ---
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

    // --- Клики по палитрам ---
    $("accent-colors-container")?.addEventListener("click", (e) =>
      this._handleColorClick(e, "accent"),
    );
    $("bg-colors-container")?.addEventListener("click", (e) =>
      this._handleColorClick(e, "bg"),
    );

    // --- События для пикеров ---
    // Fix #1 & #3: Live-preview при перетаскивании в пикере
    const handlePickerInput = (e, type) => {
      if (isValidHex(e.target.value)) {
        type === "accent"
          ? this.setColor(e.target.value)
          : this.setBgColor(e.target.value);
      }
    };
    $("customColorInput")?.addEventListener("input", (e) =>
      handlePickerInput(e, "accent"),
    );
    $("customBgInput")?.addEventListener("input", (e) =>
      handlePickerInput(e, "bg"),
    );

    // Fix #1 & #3: Автоматическое добавление цвета после закрытия пикера
    const handlePickerChange = (e, type) => {
      if (isValidHex(e.target.value)) {
        this.addCustomColor(type, e.target.value);
      }
    };
    $("customColorInput")?.addEventListener("change", (e) =>
      handlePickerChange(e, "accent"),
    );
    $("customBgInput")?.addEventListener("change", (e) =>
      handlePickerChange(e, "bg"),
    );
  },

  applySettings() {
    this.customAccentColors =
      JSON.parse(safeGetLS("custom_accent_colors")) || [];
    this.customBgColors = JSON.parse(safeGetLS("custom_bg_colors")) || [];
    this.currentAccent = safeGetLS("theme_color") || STANDARD_ACCENT_COLORS[0];
    this.currentBg = safeGetLS("theme_bg_color") || "default";
  },

  resetSettings() {
    // Fix #2: НЕ удаляем кастомные цвета, только ВЫБРАННЫЕ.
    safeRemoveLS("theme_color");
    safeRemoveLS("theme_bg_color");
    this.applySettings();
    this._populateColorSection("accent");
    this._populateColorSection("bg");
  },

  setColor(hex) {
    this.coordinator.setColor(hex);
  },
  setBgColor(hex) {
    this.coordinator.setBgColor(hex);
  },

  _handleColorClick(event, type) {
    // Этот метод теперь обрабатывает только клики по кружкам и кнопкам, пикеры работают через свои события
    const swatchWrapper = event.target.closest(".color-swatch-wrapper");
    const actionBtn = event.target.closest(".color-action-btn");

    if (actionBtn) {
      if (actionBtn.dataset.action === "delete")
        this._deleteColorWithAnimation(actionBtn.dataset.color, type);
      return;
    }

    if (this.activeActionTarget && this.activeActionTarget !== swatchWrapper) {
      this._hideActionButton();
    }

    if (swatchWrapper) {
      const color = swatchWrapper.dataset.color;
      const isCustom = swatchWrapper.dataset.custom === "true";
      const currentSelected =
        type === "accent" ? this.currentAccent : this.currentBg;

      if (color !== currentSelected) {
        sm.vibrate(20, "light");
        type === "accent" ? this.setColor(color) : this.setBgColor(color);
        if (isCustom) this._showActionButton(swatchWrapper);
      } else if (isCustom) {
        this.activeActionTarget === swatchWrapper
          ? this._hideActionButton()
          : this._showActionButton(swatchWrapper);
      }
    }
  },

  _showActionButton(targetWrapper) {
    if (this.activeActionTarget) this._hideActionButton();
    sm.vibrate(30, "medium");
    this.activeActionTarget = targetWrapper;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.action = "delete";
    btn.dataset.color = targetWrapper.dataset.color;
    btn.setAttribute("aria-label", t("delete"));
    btn.className =
      "color-action-btn w-8 h-8 flex items-center justify-center rounded-full text-white shadow-lg focus:outline-none custom-focus active:scale-90 transition-transform bg-red-500";
    btn.append(createSVGIcon("M19.5 12h-15", ["w-5", "h-5"]));
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

  addCustomColor(type, color) {
    const isAccent = type === "accent";
    const customColors = isAccent
      ? this.customAccentColors
      : this.customBgColors;

    if (customColors.length >= MAX_CUSTOM_COLORS) {
      showToast(isAccent ? t("accent_limit_msg") : t("bg_limit_msg"));
      return;
    }

    // Fix #1: Улучшенная проверка на дубликаты
    const standardColors = isAccent
      ? STANDARD_ACCENT_COLORS
      : STANDARD_BG_COLORS;
    const allColors = [
      ...standardColors,
      ...customColors,
      ...SYSTEM_DEFAULT_COLORS,
    ].map((c) => c.toLowerCase());

    if (allColors.includes(color.toLowerCase())) {
      showToast(t("color_already_exists"));
    } else {
      sm.vibrate(40, "medium");
      customColors.push(color);
      safeSetLS(
        isAccent ? "custom_accent_colors" : "custom_bg_colors",
        JSON.stringify(customColors),
      );
      this._addColorToDOM(color, type);
    }
    // В любом случае, применяем выбранный цвет
    isAccent ? this.setColor(color) : this.setBgColor(color);
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
        "animationend",
        () => {
          wrapper.remove();
          let customColors = isAccent
            ? this.customAccentColors
            : this.customBgColors;
          const index = customColors
            .map((c) => c.toLowerCase())
            .indexOf(color.toLowerCase());
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
          if (currentSelected.toLowerCase() === color.toLowerCase()) {
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
      "color-picker-wrapper relative w-9 h-9 shrink-0 group rounded-full border border-black/20 dark:border-white/20 transition-transform active:scale-90";
    const gradientBg = document.createElement("div");
    gradientBg.className =
      "absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,red,orange,yellow,green,blue,indigo,violet,red)] opacity-90 group-hover:opacity-100 transition-opacity pointer-events-none z-0";
    const input = document.createElement("input");
    input.type = "color";
    input.id = type === "accent" ? "customColorInput" : "customBgInput";
    input.setAttribute("aria-label", t("add_color"));
    input.className =
      "absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10";
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

    const activeWrapper = container.querySelector(
      `.color-swatch-wrapper[data-color="${hex}"]`,
    );

    if (activeWrapper) {
      activeWrapper.classList.add(
        "ring-[var(--primary-color)]",
        "ring-2",
        "ring-offset-2",
        "ring-offset-surface",
      );

      const isDefault = hex === "default";
      const isDark = document.documentElement.classList.contains("dark");
      const iconColor = isDefault
        ? isDark
          ? "#ffffff"
          : "#1f2937"
        : getLuminance(...Object.values(hexToRGB(hex))) > 0.5
          ? "#1f2937"
          : "#ffffff";

      const svgIcon = createSVGIcon("M4.5 12.75l6 6 9-13.5", ["w-5", "h-5"]);
      svgIcon.style.color = iconColor;
      activeWrapper.querySelector(".color-btn")?.append(svgIcon);

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
    if (accentPicker && isValidHex(this.currentAccent))
      accentPicker.value = this.currentAccent;

    const bgPicker = $("customBgInput");
    if (bgPicker) {
      bgPicker.value = isValidHex(this.currentBg)
        ? this.currentBg
        : document.documentElement.classList.contains("dark")
          ? "#000000"
          : "#f3f4f6";
    }
  },
};
