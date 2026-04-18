// Файл: www/js/theme.js
// --- ПОЛНАЯ И ОКОНЧАТЕЛЬНАЯ ВЕРСИЯ ---

import {
  $,
  safeGetLS,
  safeSetLS,
  safeRemoveLS,
  showToast,
} from "./utils.js?v=VERSION";
import { t } from "./i18n.js?v=VERSION";
import { sm } from "./sound.js?v=VERSION";

const MAX_CUSTOM_COLORS = 50;

/**
 * Вспомогательная функция для безопасного создания SVG иконок.
 * @param {string} pathData - Значение атрибута 'd' для элемента <path>.
 * @param {string[]} [classes=[]] - Массив CSS-классов для SVG элемента.
 * @returns {SVGElement} - Готовый SVG элемент.
 */
function createSVGIcon(pathData, classes = []) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");

  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2.5");
  svg.setAttribute("focusable", "false");
  svg.setAttribute("aria-hidden", "true");
  if (classes.length) svg.classList.add(...classes);

  path.setAttribute("d", pathData);
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");

  svg.appendChild(path);
  return svg;
}

export const themeManager = {
  // --- Состояние ---
  currentMode: "system",
  currentAccent: "",
  currentBg: "default",
  customAccentColors: [],
  customBgColors: [],
  activeActionTarget: null,

  // --- Настройки ---
  showMs: true,
  isAdaptiveBg: true,
  hasVignette: false,
  isLiquidGlass: false,
  hideNavLabels: false,
  vignetteAlpha: 0.2,
  ringWidth: 4,
  swMinuteBeep: true,

  // --- Константы ---
  vignetteLevels: [0.1, 0.15, 0.2, 0.25, 0.3],
  vignetteLabels: [
    "vignette_min",
    "vignette_low",
    "vignette_medium",
    "vignette_high",
    "vignette_max",
  ],
  vibroLabels: [
    "vibro_min",
    "vibro_low",
    "vibro_medium",
    "vibro_high",
    "vibro_max",
  ],
  standardAccentColors: [
    "#22c55e",
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

  // ===================================================================
  // 1. ИНИЦИАЛИЗАЦИЯ И УПРАВЛЕНИЕ СОБЫТИЯМИ
  // ===================================================================

  init() {
    this.applySettings();
    this._bindEvents();
    this._populateColorSection("accent");
    this._populateColorSection("bg");
    this.updateColorSelectionUI("accent", this.currentAccent, false);
    this.updateColorSelectionUI("bg", this.currentBg, false);
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

    document.addEventListener("languageChanged", () => this.syncSliderUIs());
    document.addEventListener("vibroToggled", (e) =>
      this.updateVibroSliderUI(e.detail.enabled),
    );

    $("accent-colors-container")?.addEventListener("click", (e) =>
      this._handleColorClick(e, "accent"),
    );
    $("bg-colors-container")?.addEventListener("click", (e) =>
      this._handleColorClick(e, "bg"),
    );

    document.body.addEventListener("change", (e) => {
      if (e.target.id === "customColorInput")
        this.setColor(e.target.value, false);
      if (e.target.id === "customBgInput")
        this.setBgColor(e.target.value, false);
    });

    const toggleListeners = {
      "toggle-sw-minute-beep": (val) => {
        this.swMinuteBeep = val;
        safeSetLS("app_sw_minute_beep", val);
      },
      "toggle-ms": (val) => {
        this.showMs = val;
        safeSetLS("app_show_ms", val);
        document.dispatchEvent(new CustomEvent("msChanged"));
      },
      "toggle-nav-labels": (val) => {
        this.hideNavLabels = val;
        safeSetLS("app_hide_nav_labels", val);
        this.applyNavLabelsVisibility();
      },
      "toggle-glass": (val) => {
        this.isLiquidGlass = val;
        safeSetLS("app_liquid_glass", val);
        this.updateGlass();
      },
      "toggle-vignette": (val) => {
        this.hasVignette = val;
        safeSetLS("app_vignette", val);
        this.updateVignette();
      },
      "toggle-adaptive-bg": (val) => {
        document.body.classList.add("is-updating-theme");
        this.isAdaptiveBg = val;
        safeSetLS("app_adaptive_bg", val);
        this.updateAdaptiveClass();
        this.applyBgTheme(
          this.currentBg,
          document.documentElement.classList.contains("dark"),
        );
        requestAnimationFrame(() =>
          document.body.classList.remove("is-updating-theme"),
        );
      },
    };
    for (const [id, callback] of Object.entries(toggleListeners)) {
      $(id)?.addEventListener("change", (e) => callback(e.target.checked));
    }

    const sliderListeners = {
      fontSlider: (val) => this.setFontSize(val),
      ringWidthSlider: (val) => this.setRingWidth(val),
      vignetteSlider: (val) => {
        this.vignetteAlpha = this.vignetteLevels[val];
        this.updateVignette();
        this.updateSliderLabel(
          "vignetteSlider",
          "vignette-label",
          this.vignetteLabels,
        );
        safeSetLS("app_vignette_alpha", this.vignetteAlpha);
      },
      vibroSlider: (val) => {
        this.updateSliderLabel("vibroSlider", "vibro-label", this.vibroLabels);
        const levels = [0.5, 0.75, 1, 1.5, 2];
        sm.vibroLevel = levels[val] || 1;
        safeSetLS("app_vibro_level", sm.vibroLevel);
        sm.vibrate(50, "strong");
      },
    };
    for (const [id, callback] of Object.entries(sliderListeners)) {
      const slider = $(id);
      slider?.addEventListener("input", () => sm.vibrate(10, "tactile"));
      slider?.addEventListener("change", (e) => callback(e.target.value));
    }
    $("fontSlider")?.addEventListener("input", (e) =>
      this.setFontSize(e.target.value),
    );
    $("ringWidthSlider")?.addEventListener("input", (e) =>
      this.setRingWidth(e.target.value),
    );
    $("vignetteSlider")?.addEventListener("input", (e) => {
      this.vignetteAlpha = this.vignetteLevels[e.target.value];
      this.updateVignette();
      this.updateSliderLabel(
        "vignetteSlider",
        "vignette-label",
        this.vignetteLabels,
      );
    });

    document
      .querySelectorAll('[id^="theme-"]')
      .forEach((btn) =>
        btn.addEventListener("click", (e) =>
          this.setMode(e.currentTarget.getAttribute("data-theme-mode")),
        ),
      );
    window
      .matchMedia("(prefers-color-scheme: dark)")
      .addEventListener("change", () => {
        if (this.currentMode === "system") this.setMode("system");
      });
  },

  // ===================================================================
  // 2. УПРАВЛЕНИЕ ЦВЕТАМИ: ЛОГИКА И СОБЫТИЯ
  // ===================================================================

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

        if (type === "accent") this.setColor(color, false);
        else this.setBgColor(color, false);

        if (isCustom) {
          this._showActionButton(swatchWrapper, "delete");
        }
      } else {
        if (isCustom) {
          if (this.activeActionTarget === swatchWrapper) {
            this._hideActionButton();
          } else {
            this._showActionButton(swatchWrapper, "delete");
          }
        }
      }
    } else if (pickerWrapper) {
      const picker = pickerWrapper.querySelector('input[type="color"]');
      const color = picker.value.toLowerCase();
      const currentSelected = (
        type === "accent" ? this.currentAccent : this.currentBg
      ).toLowerCase();

      if (color !== currentSelected) {
        if (type === "accent") this.setColor(color, false);
        else this.setBgColor(color, false);
      }

      if (this.activeActionTarget === pickerWrapper) {
        this._hideActionButton();
      } else {
        this._showActionButton(pickerWrapper, "add");
      }
    }
  },

  _showActionButton(targetWrapper, action) {
    if (this.activeActionTarget && this.activeActionTarget !== targetWrapper) {
      this._hideActionButton();
    }

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
    const icon = createSVGIcon(pathData, ["w-5", "h-5"]);

    btn.append(icon);
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

    const standardColors = isAccent
      ? this.standardAccentColors
      : this.standardBgColors;
    const allColors = [...standardColors, ...customColors].map((c) =>
      c.toLowerCase(),
    );

    this._hideActionButton();

    if (allColors.includes(color)) {
      showToast(t("color_already_exists"));
      sm.vibrate(30, "medium");
      if (isAccent) this.setColor(color);
      else this.setBgColor(color);
    } else {
      sm.vibrate(40, "medium");
      customColors.push(color);
      safeSetLS(
        isAccent ? "custom_accent_colors" : "custom_bg_colors",
        JSON.stringify(customColors),
      );

      this._addColorToDOM(color, type);

      if (isAccent) this.setColor(color);
      else this.setBgColor(color);
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
            if (isAccent) this.setColor(this.standardAccentColors[0], false);
            else this.setBgColor("default", false);
          }
        },
        { once: true },
      );
    }
  },

  // ===================================================================
  // 3. УПРАВЛЕНИЕ DOM И РЕНДЕРИНГ
  // ===================================================================

  _populateColorSection(type) {
    const container = $(
      type === "accent" ? "accent-colors-container" : "bg-colors-container",
    );
    if (!container) return;

    while (container.firstChild) container.removeChild(container.firstChild);

    const isAccent = type === "accent";
    const standardColors = isAccent
      ? this.standardAccentColors
      : this.standardBgColors;
    const customColors = isAccent
      ? this.customAccentColors
      : this.customBgColors;

    [...standardColors, ...customColors].forEach((color) => {
      const isCustom = customColors.includes(color);
      container.append(this._createColorSwatch(color, isCustom));
    });

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
      button.style.backgroundColor = color;
      button.setAttribute("aria-label", color);
    }

    wrapper.append(button);
    return wrapper;
  },

  _createColorPicker(type) {
    const pickerId = type === "accent" ? "customColorInput" : "customBgInput";

    const wrapper = document.createElement("div");
    wrapper.className =
      "color-picker-wrapper relative w-9 h-9 shrink-0 group rounded-full border border-black/20 dark:border-white/20 transition-transform active:scale-90 focus-within:ring-2 focus-within:ring-[var(--primary-color)] focus-within:ring-offset-2 focus-within:ring-offset-surface";

    const gradientBg = document.createElement("div");
    gradientBg.className =
      "absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,red,orange,yellow,green,blue,indigo,violet,red)] opacity-90 group-hover:opacity-100 transition-opacity pointer-events-none z-0";

    const input = document.createElement("input");
    input.type = "color";
    input.id = pickerId;
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
      let iconColor = isPicker
        ? "#ffffff"
        : isDefault
          ? isDark
            ? "#ffffff"
            : "#1f2937"
          : this.getLuminance(...Object.values(this.hexToRGB(hex))) > 0.5
            ? "#1f2937"
            : "#ffffff";

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
    const isDark = document.documentElement.classList.contains("dark");

    const accentPicker = $("customColorInput");
    if (accentPicker) {
      accentPicker.value = this.currentAccent;
    }

    const bgPicker = $("customBgInput");
    if (bgPicker) {
      bgPicker.value =
        this.currentBg === "default"
          ? isDark
            ? "#1c1c1e"
            : "#f3f4f6"
          : this.currentBg;
    }
  },

  // ===================================================================
  // 4. СЕТТЕРЫ И ГЛОБАЛЬНЫЕ НАСТРОЙКИ
  // ===================================================================

  setColor(hex, doScroll = true) {
    this._hideActionButton();
    this.currentAccent = hex;
    safeSetLS("theme_color", hex);
    document.documentElement.style.setProperty("--primary-color", hex);
    const { h } = this.hexToHSL(hex);
    document.documentElement.style.setProperty("--accent-h", h);

    this._syncPickerValues();
    this.updateColorSelectionUI("accent", hex, doScroll);
  },

  setBgColor(hex, doScroll = true) {
    this._hideActionButton();
    this.currentBg = hex;
    safeSetLS("theme_bg_color", hex);
    const isDark = document.documentElement.classList.contains("dark");
    this.applyBgTheme(hex, isDark);

    this._syncPickerValues();
    this.updateColorSelectionUI("bg", hex, doScroll);
  },

  setMode(mode) {
    this._internalSetMode(mode, true);
  },

  _internalSetMode(mode, useTransition) {
    if (useTransition) document.body.classList.add("is-updating-theme");
    this.currentMode = mode;
    safeSetLS("theme_mode", mode);
    document.querySelectorAll('[id^="theme-"]').forEach((b) => {
      b.classList.remove("app-surface", "shadow-sm", "app-text");
      b.classList.add("app-text-sec");
    });
    const activeBtn = $(`theme-${mode}`);
    if (activeBtn) {
      activeBtn.classList.remove("app-text-sec");
      activeBtn.classList.add("app-surface", "shadow-sm", "app-text");
    }
    const isDark =
      mode === "dark" ||
      (mode === "system" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", isDark);
    document.documentElement.style.colorScheme = isDark ? "dark" : "light";

    this.applyBgTheme(this.currentBg, isDark);
    this._syncPickerValues();

    if (useTransition)
      requestAnimationFrame(() =>
        document.body.classList.remove("is-updating-theme"),
      );
  },

  setFontSize(s) {
    const n = Number(s);
    const c = n / 16;
    document.documentElement.style.setProperty("--font-scale", c);
    if ($("fontSizeDisplay")) $("fontSizeDisplay").textContent = n + " px";
    safeSetLS("font_size", n);
  },

  setRingWidth(w) {
    const n = Number(w);
    this.ringWidth = n;
    document.documentElement.style.setProperty("--ring-stroke-width", n);
    if ($("ringWidthDisplay"))
      $("ringWidthDisplay").textContent = `${n.toFixed(1)} px`;
    safeSetLS("app_ring_width", n);
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

    this._internalSetMode(safeGetLS("theme_mode") || "system", false);
    this.currentAccent =
      safeGetLS("theme_color") || this.standardAccentColors[0];
    this.currentBg = safeGetLS("theme_bg_color") || "default";

    const settingsMap = {
      app_adaptive_bg: {
        prop: "isAdaptiveBg",
        default: true,
        el: "toggle-adaptive-bg",
        type: "checked",
      },
      app_vignette: {
        prop: "hasVignette",
        default: false,
        el: "toggle-vignette",
        type: "checked",
      },
      app_liquid_glass: {
        prop: "isLiquidGlass",
        default: false,
        el: "toggle-glass",
        type: "checked",
      },
      app_hide_nav_labels: {
        prop: "hideNavLabels",
        default: false,
        el: "toggle-nav-labels",
        type: "checked",
      },
      app_show_ms: {
        prop: "showMs",
        default: true,
        el: "toggle-ms",
        type: "checked",
      },
      app_sw_minute_beep: {
        prop: "swMinuteBeep",
        default: true,
        el: "toggle-sw-minute-beep",
        type: "checked",
      },
      font_size: {
        prop: null,
        default: 16,
        el: "fontSlider",
        type: "value",
        setter: this.setFontSize.bind(this),
      },
      app_ring_width: {
        prop: null,
        default: 4,
        el: "ringWidthSlider",
        type: "value",
        setter: this.setRingWidth.bind(this),
      },
    };

    for (const [key, config] of Object.entries(settingsMap)) {
      const storedValue = safeGetLS(key);
      let value;
      if (config.type === "checked") {
        value = storedValue !== null ? storedValue === "true" : config.default;
        this[config.prop] = value;
      } else {
        value = storedValue !== null ? parseFloat(storedValue) : config.default;
      }
      if ($(config.el)) $(config.el)[config.type] = value;
      if (config.setter) config.setter(value);
    }

    const storedVignetteAlpha = safeGetLS("app_vignette_alpha");
    this.vignetteAlpha =
      storedVignetteAlpha !== null ? parseFloat(storedVignetteAlpha) : 0.2;
    if ($("vignetteSlider")) {
      const closestIndex = this.vignetteLevels.reduce(
        (prev, curr, i) =>
          Math.abs(curr - this.vignetteAlpha) <
          Math.abs(this.vignetteLevels[prev] - this.vignetteAlpha)
            ? i
            : prev,
        0,
      );
      $("vignetteSlider").value = closestIndex;
    }
    if ($("vibroSlider")) {
      const levels = [0.5, 0.75, 1, 1.5, 2];
      const vibroValue = parseFloat(safeGetLS("app_vibro_level")) || 1;
      const closestIndex = levels.reduce(
        (prev, curr, i) =>
          Math.abs(curr - vibroValue) < Math.abs(levels[prev] - vibroValue)
            ? i
            : prev,
        0,
      );
      $("vibroSlider").value = closestIndex;
    }

    this.updateAdaptiveClass();
    this.applyNavLabelsVisibility();
    this.updateGlass();
    this.updateVignette();
    this.syncSliderUIs();

    this._syncPickerValues();
  },

  resetSettings() {
    const themeKeys = [
      "theme_mode",
      "theme_color",
      "theme_bg_color",
      "font_size",
      "app_adaptive_bg",
      "app_vignette",
      "app_vignette_alpha",
      "app_liquid_glass",
      "app_hide_nav_labels",
      "app_ring_width",
      "app_show_ms",
      "app_sw_minute_beep",
    ];
    themeKeys.forEach(safeRemoveLS);

    this.applySettings();
    this._populateColorSection("accent");
    this._populateColorSection("bg");
    this.updateColorSelectionUI("accent", this.currentAccent, false);
    this.updateColorSelectionUI("bg", this.currentBg, false);
  },

  // ===================================================================
  // 5. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
  // ===================================================================

  syncSliderUIs() {
    this.updateSliderLabel(
      "vignetteSlider",
      "vignette-label",
      this.vignetteLabels,
    );
    this.updateSliderLabel("vibroSlider", "vibro-label", this.vibroLabels);
  },

  updateSliderLabel(sliderId, labelId, labelsArray) {
    const slider = $(sliderId),
      label = $(labelId);
    if (!slider || !label) return;
    const val = parseInt(slider.value, 10),
      min = parseFloat(slider.min),
      max = parseFloat(slider.max);
    label.textContent = t(labelsArray[val]);
    const percent = max - min > 0 ? (val - min) / (max - min) : 0;
    const thumbWidth = 24,
      trackWidth = slider.offsetWidth;
    if (trackWidth === 0) return;
    const offset = thumbWidth / 2 - percent * thumbWidth;
    label.style.left = `calc(${percent * 100}% + ${offset}px)`;
  },

  updateVignette() {
    const bg = document.querySelector(".app-bg");
    if (!bg) return;
    const c = $("vignette-depth-container");
    c?.classList.toggle("hidden", !this.hasVignette);
    c?.classList.toggle("flex", this.hasVignette);
    bg.classList.toggle("has-vignette", this.hasVignette);
    if (this.hasVignette) {
      document.documentElement.style.setProperty(
        "--vignette-alpha",
        this.vignetteAlpha * 0.4,
      );
      requestAnimationFrame(() =>
        this.updateSliderLabel(
          "vignetteSlider",
          "vignette-label",
          this.vignetteLabels,
        ),
      );
    }
  },

  updateVibroSliderUI(isEnabled) {
    const c = $("vibro-level-container");
    c?.classList.toggle("hidden", !isEnabled);
    c?.classList.toggle("flex", isEnabled);
    if (isEnabled)
      requestAnimationFrame(() =>
        this.updateSliderLabel("vibroSlider", "vibro-label", this.vibroLabels),
      );
  },

  updateGlass() {
    document.documentElement.classList.toggle(
      "glass-effect",
      this.isLiquidGlass,
    );
  },
  updateAdaptiveClass() {
    document.documentElement.classList.toggle(
      "no-adaptive",
      !this.isAdaptiveBg,
    );
  },
  applyNavLabelsVisibility() {
    document.body.classList.toggle("hide-nav-labels", this.hideNavLabels);
  },

  applyBgTheme(hex, isDark) {
    const root = document.documentElement;
    document.body.classList.remove("force-light-text", "force-dark-text");
    if (hex === "default") {
      root.style.setProperty(
        "--bg-color",
        isDark
          ? this.isAdaptiveBg
            ? ""
            : "#000000"
          : this.isAdaptiveBg
            ? ""
            : "#f3f4f6",
      );
      root.style.setProperty(
        "--surface-color",
        isDark
          ? this.isAdaptiveBg
            ? ""
            : "#1c1c1e"
          : this.isAdaptiveBg
            ? ""
            : "#ffffff",
      );
      return;
    }
    const { r, g, b } = this.hexToRGB(hex),
      { h, s, l } = this.hexToHSL(hex);
    if (!this.isAdaptiveBg) {
      root.style.setProperty("--bg-color", hex);
      root.style.setProperty(
        "--surface-color",
        `color-mix(in srgb, ${hex}, ${isDark ? "white 10%" : l > 90 ? "black 5%" : "white 25%"})`,
      );
      const luminance = this.getLuminance(r, g, b);
      document.body.classList.toggle("force-light-text", luminance < 0.48);
      document.body.classList.toggle("force-dark-text", luminance >= 0.48);
    } else {
      const sat = isDark ? Math.min(s, 40) : Math.max(s, 20);
      root.style.setProperty(
        "--bg-color",
        `hsl(${h} ${sat}% ${isDark ? 8 : 94}%)`,
      );
      root.style.setProperty(
        "--surface-color",
        `hsl(${h} ${sat}% ${isDark ? 14 : 98}%)`,
      );
    }
  },

  getLuminance(r, g, b) {
    const a = [r, g, b].map((v) =>
      (v /= 255) <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4),
    );
    return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
  },

  hexToRGB(H) {
    if (!H || !H.startsWith("#")) return { r: 0, g: 0, b: 0 };
    let r = 0,
      g = 0,
      b = 0;
    if (H.length == 4) {
      r = parseInt(H[1] + H[1], 16);
      g = parseInt(H[2] + H[2], 16);
      b = parseInt(H[3] + H[3], 16);
    } else if (H.length == 7) {
      r = parseInt(H[1] + H[2], 16);
      g = parseInt(H[3] + H[4], 16);
      b = parseInt(H[5] + H[6], 16);
    }
    return { r, g, b };
  },

  hexToHSL(H) {
    if (!H || !H.startsWith("#")) return { h: 142, s: 50, l: 50 };
    const { r: r255, g: g255, b: b255 } = this.hexToRGB(H);
    let r = r255 / 255,
      g = g255 / 255,
      b = b255 / 255;
    let cmin = Math.min(r, g, b),
      cmax = Math.max(r, g, b),
      delta = cmax - cmin;
    let h = 0,
      s = 0,
      l = (cmax + cmin) / 2;
    if (delta !== 0) {
      s = delta / (1 - Math.abs(2 * l - 1));
      if (cmax === r) h = ((g - b) / delta) % 6;
      else if (cmax === g) h = (b - r) / delta + 2;
      else h = (r - g) / delta + 4;
    }
    h = Math.round(h * 60);
    if (h < 0) h += 360;
    return { h, s: +(s * 100).toFixed(1), l: +(l * 100).toFixed(1) };
  },
};
