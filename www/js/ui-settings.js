// Файл: www/js/ui-settings.js (НОВЫЙ)

import { $, safeGetLS, safeSetLS, safeRemoveLS } from "./utils.js?v=VERSION";
import { t } from "./i18n.js?v=VERSION";
import { sm } from "./sound.js?v=VERSION";

const VIGNETTE_LEVELS = [0.1, 0.15, 0.2, 0.25, 0.3];
const VIBRO_LEVELS = [0.5, 0.75, 1, 1.5, 2];
const VIGNETTE_LABELS = [
  "vignette_min",
  "vignette_low",
  "vignette_medium",
  "vignette_high",
  "vignette_max",
];
const VIBRO_LABELS = [
  "vibro_min",
  "vibro_low",
  "vibro_medium",
  "vibro_high",
  "vibro_max",
];

export const settingsManager = {
  // --- Состояние ---
  showMs: true,
  isAdaptiveBg: true,
  hasVignette: false,
  isLiquidGlass: false,
  hideNavLabels: false,
  vignetteAlpha: 0.2,
  ringWidth: 4,
  swMinuteBeep: true,

  init() {
    this.applySettings();
    this._bindEvents();
  },

  _bindEvents() {
    document.addEventListener("languageChanged", () => this.syncSliderUIs());
    document.addEventListener("vibroToggled", (e) =>
      this.updateVibroSliderUI(e.detail.enabled),
    );

    const toggleListeners = {
      "toggle-sw-minute-beep": (val) => (
        (this.swMinuteBeep = val),
        safeSetLS("app_sw_minute_beep", val)
      ),
      "toggle-ms": (val) => (
        (this.showMs = val),
        safeSetLS("app_show_ms", val),
        document.dispatchEvent(new CustomEvent("msChanged"))
      ),
      "toggle-nav-labels": (val) => (
        (this.hideNavLabels = val),
        safeSetLS("app_hide_nav_labels", val),
        this.applyNavLabelsVisibility()
      ),
      "toggle-glass": (val) => (
        (this.isLiquidGlass = val),
        safeSetLS("app_liquid_glass", val),
        this.updateGlass()
      ),
      "toggle-vignette": (val) => (
        (this.hasVignette = val),
        safeSetLS("app_vignette", val),
        this.updateVignette()
      ),
      "toggle-adaptive-bg": (val) => (
        (this.isAdaptiveBg = val),
        safeSetLS("app_adaptive_bg", val),
        document.dispatchEvent(
          new CustomEvent("adaptiveBgChanged", { detail: { isAdaptive: val } }),
        )
      ),
    };

    for (const [id, callback] of Object.entries(toggleListeners)) {
      $(id)?.addEventListener("change", (e) => callback(e.target.checked));
    }

    // Слушатели для слайдеров
    $("fontSlider")?.addEventListener("input", (e) =>
      this.setFontSize(e.target.value, false),
    );
    $("fontSlider")?.addEventListener("change", (e) =>
      this.setFontSize(e.target.value, true),
    );
    $("ringWidthSlider")?.addEventListener("input", (e) =>
      this.setRingWidth(e.target.value, false),
    );
    $("ringWidthSlider")?.addEventListener("change", (e) =>
      this.setRingWidth(e.target.value, true),
    );
    $("vignetteSlider")?.addEventListener("input", (e) => {
      this.vignetteAlpha = VIGNETTE_LEVELS[e.target.value];
      this.updateVignette();
      this.updateSliderLabel(
        "vignetteSlider",
        "vignette-label",
        VIGNETTE_LABELS,
      );
    });
    $("vignetteSlider")?.addEventListener(
      "change",
      (e) => (
        (this.vignetteAlpha = VIGNETTE_LEVELS[e.target.value]),
        safeSetLS("app_vignette_alpha", this.vignetteAlpha)
      ),
    );
    $("vibroSlider")?.addEventListener("input", () =>
      sm.vibrate(10, "tactile"),
    );
    $("vibroSlider")?.addEventListener("change", (e) => {
      sm.vibroLevel = VIBRO_LEVELS[e.target.value] || 1;
      safeSetLS("app_vibro_level", sm.vibroLevel);
      sm.vibrate(50, "strong");
      this.updateSliderLabel("vibroSlider", "vibro-label", VIBRO_LABELS);
    });
  },

  applySettings() {
    const settingsMap = {
      app_sw_minute_beep: {
        prop: "swMinuteBeep",
        default: true,
        el: "toggle-sw-minute-beep",
        type: "checked",
      },
      app_show_ms: {
        prop: "showMs",
        default: true,
        el: "toggle-ms",
        type: "checked",
      },
      app_hide_nav_labels: {
        prop: "hideNavLabels",
        default: false,
        el: "toggle-nav-labels",
        type: "checked",
      },
      app_liquid_glass: {
        prop: "isLiquidGlass",
        default: false,
        el: "toggle-glass",
        type: "checked",
      },
      app_vignette: {
        prop: "hasVignette",
        default: false,
        el: "toggle-vignette",
        type: "checked",
      },
      app_adaptive_bg: {
        prop: "isAdaptiveBg",
        default: true,
        el: "toggle-adaptive-bg",
        type: "checked",
      },
      font_size: {
        default: 16,
        el: "fontSlider",
        type: "value",
        setter: (v) => this.setFontSize(v, true),
      },
      app_ring_width: {
        default: 4,
        el: "ringWidthSlider",
        type: "value",
        setter: (v) => this.setRingWidth(v, true),
      },
    };

    for (const [key, config] of Object.entries(settingsMap)) {
      const stored = safeGetLS(key);
      const value =
        stored !== null
          ? config.type === "checked"
            ? stored === "true"
            : parseFloat(stored)
          : config.default;
      if (config.prop) this[config.prop] = value;
      if ($(config.el)) $(config.el)[config.type] = value;
      if (config.setter) config.setter(value);
    }

    this.vignetteAlpha = parseFloat(safeGetLS("app_vignette_alpha")) || 0.2;
    if ($("vignetteSlider")) {
      $("vignetteSlider").value = VIGNETTE_LEVELS.reduce(
        (p, c, i) =>
          Math.abs(c - this.vignetteAlpha) <
          Math.abs(VIGNETTE_LEVELS[p] - this.vignetteAlpha)
            ? i
            : p,
        0,
      );
    }

    if ($("vibroSlider")) {
      const vibroValue = parseFloat(safeGetLS("app_vibro_level")) || 1;
      $("vibroSlider").value = VIBRO_LEVELS.reduce(
        (p, c, i) =>
          Math.abs(c - vibroValue) < Math.abs(VIBRO_LEVELS[p] - vibroValue)
            ? i
            : p,
        0,
      );
    }

    this.applyNavLabelsVisibility();
    this.updateGlass();
    this.updateVignette();
    this.syncSliderUIs();
  },

  resetSettings() {
    const keys = [
      "font_size",
      "app_ring_width",
      "app_adaptive_bg",
      "app_vignette",
      "app_vignette_alpha",
      "app_liquid_glass",
      "app_hide_nav_labels",
      "app_show_ms",
      "app_sw_minute_beep",
    ];
    keys.forEach(safeRemoveLS);
    this.applySettings();
    document.dispatchEvent(
      new CustomEvent("adaptiveBgChanged", {
        detail: { isAdaptive: this.isAdaptiveBg },
      }),
    );
  },

  setFontSize(s, save = true) {
    const n = Number(s);
    document.documentElement.style.setProperty("--font-scale", n / 16);
    if ($("fontSizeDisplay")) $("fontSizeDisplay").textContent = `${n} px`;
    if (save) safeSetLS("font_size", n);
  },

  setRingWidth(w, save = true) {
    const n = Number(w);
    this.ringWidth = n;
    document.documentElement.style.setProperty("--ring-stroke-width", n);
    if ($("ringWidthDisplay"))
      $("ringWidthDisplay").textContent = `${n.toFixed(1)} px`;
    if (save) safeSetLS("app_ring_width", n);
  },

  syncSliderUIs() {
    this.updateSliderLabel("vignetteSlider", "vignette-label", VIGNETTE_LABELS);
    this.updateSliderLabel("vibroSlider", "vibro-label", VIBRO_LABELS);
  },

  updateSliderLabel(sliderId, labelId, labelsArray) {
    const slider = $(sliderId),
      label = $(labelId);
    if (!slider || !label) return;
    const val = parseInt(slider.value, 10),
      min = parseFloat(slider.min),
      max = parseFloat(slider.max);
    label.textContent = t(labelsArray[val]);
    const percent = (val - min) / (max - min);
    const thumbWidth = 24,
      trackWidth = slider.offsetWidth;
    if (trackWidth === 0) return;
    const offset = thumbWidth / 2 - percent * thumbWidth;
    label.style.left = `calc(${percent * 100}% + ${offset}px)`;
  },

  updateVignette() {
    const bg = document.querySelector(".app-bg"),
      c = $("vignette-depth-container");
    if (!bg || !c) return;
    c.classList.toggle("hidden", !this.hasVignette);
    c.classList.toggle("flex", this.hasVignette);
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
          VIGNETTE_LABELS,
        ),
      );
    }
  },

  updateVibroSliderUI(isEnabled) {
    const c = $("vibro-level-container");
    if (!c) return;
    c.classList.toggle("hidden", !isEnabled);
    c.classList.toggle("flex", isEnabled);
    if (isEnabled)
      requestAnimationFrame(() =>
        this.updateSliderLabel("vibroSlider", "vibro-label", VIBRO_LABELS),
      );
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
