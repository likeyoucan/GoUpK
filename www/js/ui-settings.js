// Файл: www/js/ui-settings.js

import { $, safeGetLS, safeSetLS, safeRemoveLS } from "./utils.js?v=VERSION";
import { t } from "./i18n.js?v=VERSION";
import { sm } from "./sound.js?v=VERSION";

export const uiSettingsManager = {
  // Состояние
  showMs: true,
  isAdaptiveBg: true,
  hasVignette: false,
  isLiquidGlass: false,
  hideNavLabels: false,
  vignetteAlpha: 0.2,
  ringWidth: 4,
  swMinuteBeep: true,

  // Константы
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

  init() {
    this._bindEvents();
    this.applySettings();
  },

  _bindEvents() {
    document.addEventListener("languageChanged", () => this.syncSliderUIs());
    document.addEventListener("vibroToggled", (e) =>
      this.updateVibroSliderUI(e.detail.enabled),
    );

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
        this.isAdaptiveBg = val;
        safeSetLS("app_adaptive_bg", val);
        document.dispatchEvent(
          new CustomEvent("adaptiveBgChanged", { detail: { value: val } }),
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
      slider?.addEventListener("input", (e) => {
        sm.vibrate(10, "tactile");
        // Обновляем UI в реальном времени для слайдеров, где это нужно
        if (
          id === "fontSlider" ||
          id === "ringWidthSlider" ||
          id === "vignetteSlider"
        ) {
          callback(e.target.value);
        }
      });
      slider?.addEventListener("change", (e) => {
        // Сохраняем значение по окончании изменения
        callback(e.target.value);
      });
    }
  },

  applySettings() {
    const settingsMap = {
      app_adaptive_bg: { prop: "isAdaptiveBg", default: true, type: "checked" },
      app_vignette: { prop: "hasVignette", default: false, type: "checked" },
      app_liquid_glass: {
        prop: "isLiquidGlass",
        default: false,
        type: "checked",
      },
      app_hide_nav_labels: {
        prop: "hideNavLabels",
        default: false,
        type: "checked",
      },
      app_show_ms: { prop: "showMs", default: true, type: "checked" },
      app_sw_minute_beep: {
        prop: "swMinuteBeep",
        default: true,
        type: "checked",
      },
      font_size: {
        el: "fontSlider",
        default: 16,
        setter: this.setFontSize.bind(this),
      },
      app_ring_width: {
        el: "ringWidthSlider",
        default: 4,
        setter: this.setRingWidth.bind(this),
      },
    };

    // Считываем значения из LS
    for (const [key, config] of Object.entries(settingsMap)) {
      const stored = safeGetLS(key);
      let value =
        stored !== null
          ? config.type === "checked"
            ? stored === "true"
            : parseFloat(stored)
          : config.default;
      if (config.prop) this[config.prop] = value;
      if ($(config.el)) $(config.el)[config.type || "value"] = value;
      if (config.setter) config.setter(value);
    }

    this.vignetteAlpha = parseFloat(safeGetLS("app_vignette_alpha")) || 0.2;

    // Применяем эффекты
    this.applyNavLabelsVisibility();
    this.updateGlass();
    this.updateVignette();
    this.syncSliderUIs();
  },

  resetSettings() {
    const keys = [
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
    keys.forEach(safeRemoveLS);
    this.applySettings(); // Применит дефолты и обновит UI
  },

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

  setFontSize(s) {
    const n = Number(s);
    document.documentElement.style.setProperty("--font-scale", n / 16);
    if ($("fontSizeDisplay")) $("fontSizeDisplay").textContent = `${n} px`;
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
      const closestIdx = this.vignetteLevels.reduce(
        (p, c, i) =>
          Math.abs(c - this.vignetteAlpha) <
          Math.abs(this.vignetteLevels[p] - this.vignetteAlpha)
            ? i
            : p,
        0,
      );
      if ($("vignetteSlider")) $("vignetteSlider").value = closestIdx;
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
    if (isEnabled) {
      requestAnimationFrame(() =>
        this.updateSliderLabel("vibroSlider", "vibro-label", this.vibroLabels),
      );
    }
  },

  updateGlass() {
    document.documentElement.classList.toggle(
      "glass-effect",
      this.isLiquidGlass,
    );
  },

  applyNavLabelsVisibility() {
    document.body.classList.toggle("hide-nav-labels", this.hideNavLabels);
  },
};
