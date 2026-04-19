// Файл: www/js/ui-colors.js (НОВЫЙ)

import { $, safeGetLS, safeSetLS, showToast } from "./utils.js?v=VERSION";
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

  // --- Основная логика управления цветом ---
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
      } else if (isCustom) {
        this.activeActionTarget === swatchWrapper
          ? this._hideActionButton()
          : this._showActionButton(swatchWrapper);
      }
    } else if (pickerWrapper) {
      const picker = pickerWrapper.querySelector('input[type="color"]');
      picker.oninput = (e) => {
        // Обновляем цвет в реальном времени при перетаскивании
        const newColor = e.target.value;
        if (!isValidHex(newColor)) return;
        type === "accent" ? this.setColor(newColor) : this.setBgColor(newColor);
      };
      picker.onchange = (e) => {
        // Сохраняем кастомный цвет по завершению выбора
        const newColor = e.target.value.toLowerCase();
        if (!isValidHex(newColor)) return;
        this.addCustomColor(type, newColor);
        picker.oninput = null; // Сбрасываем обработчик
        picker.onchange = null;
      };
      picker.click(); // Открываем системный color picker
    }
  },

  _showActionButton(targetWrapper) {
    if (this.activeActionTarget) this._hideActionButton();
    sm.vibrate(30, "medium");
    this.activeActionTarget = targetWrapper;

    const btn = createSVGIcon("M19.5 12h-15", ["w-5", "h-5"]);
    const actionButton = document.createElement("button");
    actionButton.type = "button";
    actionButton.dataset.action = "delete";
    actionButton.dataset.color = targetWrapper.dataset.color;
    actionButton.setAttribute("aria-label", t("delete"));
    actionButton.className =
      "color-action-btn w-6 h-6 flex items-center justify-center rounded-full text-white bg-red-500 shadow-lg focus:outline-none custom-focus active:scale-90 transition-all";
    actionButton.append(btn);
    targetWrapper.append(actionButton);
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

    const allColors = [
      ...(isAccent ? STANDARD_ACCENT_COLORS : STANDARD_BG_COLORS),
      ...customColors,
    ].map((c) => c.toLowerCase());

    if (allColors.includes(color)) {
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
      wrapper.classList.add("is-collapsing");
      wrapper.addEventListener(
        "animationend",
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

  // --- Рендеринг и DOM ---
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
    const plusIcon = createSVGIcon("M12 4.5v15m7.5-7.5h-15", [
      "w-5",
      "h-5",
      "text-white",
      "absolute",
      "inset-0",
      "m-auto",
      "z-10",
      "pointer-events-none",
    ]);
    const input = document.createElement("input");
    input.type = "color";
    input.id = type === "accent" ? "customColorInput" : "customBgInput";
    input.setAttribute("aria-label", t("add_color"));
    input.className =
      "absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20";
    wrapper.append(gradientBg, plusIcon, input);
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
    container.querySelectorAll(".color-swatch-wrapper").forEach((el) => {
      el.classList.remove(
        "ring-[var(--primary-color)]",
        "ring-2",
        "ring-offset-2",
        "ring-offset-surface",
      );
      el.querySelector(".color-btn")?.querySelector("svg")?.remove();
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
      const { r, g, b } = isDefault
        ? { r: 255, g: 255, b: 255 }
        : hexToRGB(hex);
      const iconColor = getLuminance(r, g, b) > 0.5 ? "#1f2937" : "#ffffff";
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
    if ($("customColorInput") && isValidHex(this.currentAccent))
      $("customColorInput").value = this.currentAccent;
    if ($("customBgInput")) {
      $("customBgInput").value = isValidHex(this.currentBg)
        ? this.currentBg
        : document.documentElement.classList.contains("dark")
          ? "#000000"
          : "#f3f4f6";
    }
  },
};
