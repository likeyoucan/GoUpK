// Файл: www/js/ui-settings.js

import { $, safeGetLS, safeSetLS, safeRemoveLS } from "./utils.js?v=VERSION";
import { t } from "./i18n.js?v=VERSION";
import { sm } from "./sound.js?v=VERSION";

export const uiSettingsManager = {
  // State
  showMs: true,
  showForegroundBanner: true,
  isAdaptiveBg: true,
  hasVignette: false,
  isLiquidGlass: false,
  hideNavLabels: false,
  vignetteAlpha: 0.2,
  fontSize: 16,
  ringWidth: 4,
  swMinuteBeep: true,
  lastSliderValues: {},

  // Constants
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
    this.applySettings();
    this._bindEvents();
  },

  _bindEvents() {
    document.addEventListener("languageChanged", () => this.syncSliderUIs());
    document.addEventListener("vibroToggled", (e) =>
      this.updateVibroSliderUI(e.detail.enabled),
    );

    const toggleListeners = {
      "toggle-ms": (val) => {
        this.showMs = val;
        safeSetLS("app_show_ms", val);
        document.dispatchEvent(new CustomEvent("msChanged"));
      },
      "toggle-foreground-banner": (val) => {
        this.showForegroundBanner = val;
        safeSetLS("app_show_foreground_banner", val);
        document.dispatchEvent(
          new CustomEvent("foregroundNotificationSettingChanged"),
        );
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
        document.dispatchEvent(new CustomEvent("adaptiveBgChanged"));
      },
      "toggle-sw-minute-beep": (val) => {
        this.swMinuteBeep = val;
        safeSetLS("app_sw_minute_beep", val);
      },
    };

    Object.entries(toggleListeners).forEach(([id, callback]) => {
      $(id)?.addEventListener("change", (e) => callback(e.target.checked));
    });

    $("fontSlider")?.addEventListener("change", (e) => {
      const val = Number(e.target.value);
      this.fontSize = val;
      this.setFontSize(val);
      safeSetLS("font_size", val);
    });
    $("fontSlider")?.addEventListener("input", (e) =>
      this.setFontSize(Number(e.target.value)),
    );

    $("ringWidthSlider")?.addEventListener("change", (e) => {
      const val = Number(e.target.value);
      this.ringWidth = val;
      this.setRingWidth(val);
      safeSetLS("app_ring_width", val);
    });
    $("ringWidthSlider")?.addEventListener("input", (e) =>
      this.setRingWidth(Number(e.target.value)),
    );

    $("vignetteSlider")?.addEventListener("change", (e) => {
      const idx = Number(e.target.value);
      const newAlpha = this.vignetteLevels[idx];
      this.vignetteAlpha = newAlpha;
      this.updateVignette();
      this.updateSliderLabel(
        "vignetteSlider",
        "vignette-label",
        this.vignetteLabels,
      );
      safeSetLS("app_vignette_alpha", newAlpha);
    });
    $("vignetteSlider")?.addEventListener("input", (e) => {
      const idx = Number(e.target.value);
      const newAlpha = this.vignetteLevels[idx];
      this.vignetteAlpha = newAlpha;
      this.updateVignette();
      this.updateSliderLabel(
        "vignetteSlider",
        "vignette-label",
        this.vignetteLabels,
      );
    });

    $("vibroSlider")?.addEventListener("change", (e) => {
      const levels = [0.5, 0.75, 1, 1.5, 2];
      const newLevel = levels[Number(e.target.value)] || 1;
      sm.vibroLevel = newLevel;
      this.updateSliderLabel("vibroSlider", "vibro-label", this.vibroLabels);
      safeSetLS("app_vibro_level", newLevel);
      sm.vibrate(50, "strong");
    });
    $("vibroSlider")?.addEventListener("input", (e) => {
      const levels = [0.5, 0.75, 1, 1.5, 2];
      sm.vibroLevel = levels[Number(e.target.value)] || 1;
      this.updateSliderLabel("vibroSlider", "vibro-label", this.vibroLabels);
    });
  },

  applySettings() {
    this.isAdaptiveBg = safeGetLS("app_adaptive_bg") !== "false";
    this.hasVignette = safeGetLS("app_vignette") === "true";
    this.isLiquidGlass = safeGetLS("app_liquid_glass") === "true";
    this.hideNavLabels = safeGetLS("app_hide_nav_labels") === "true";
    this.showMs = safeGetLS("app_show_ms") !== "false";
    this.showForegroundBanner =
      safeGetLS("app_show_foreground_banner") !== "false";
    this.swMinuteBeep = safeGetLS("app_sw_minute_beep") !== "false";
    this.fontSize = Number(safeGetLS("font_size")) || 16;
    this.ringWidth = Number(safeGetLS("app_ring_width")) || 4;
    this.vignetteAlpha = parseFloat(safeGetLS("app_vignette_alpha")) || 0.2;

    if ($("toggle-adaptive-bg"))
      $("toggle-adaptive-bg").checked = this.isAdaptiveBg;
    if ($("toggle-vignette")) $("toggle-vignette").checked = this.hasVignette;
    if ($("toggle-glass")) $("toggle-glass").checked = this.isLiquidGlass;
    if ($("toggle-nav-labels"))
      $("toggle-nav-labels").checked = this.hideNavLabels;
    if ($("toggle-ms")) $("toggle-ms").checked = this.showMs;
    if ($("toggle-foreground-banner"))
      $("toggle-foreground-banner").checked = this.showForegroundBanner;
    if ($("toggle-sw-minute-beep"))
      $("toggle-sw-minute-beep").checked = this.swMinuteBeep;

    if ($("fontSlider")) $("fontSlider").value = this.fontSize;
    if ($("ringWidthSlider")) $("ringWidthSlider").value = this.ringWidth;

    if ($("vignetteSlider")) {
      const closestVignetteIndex = this.vignetteLevels.reduce(
        (prevIdx, curr, idx) =>
          Math.abs(curr - this.vignetteAlpha) <
          Math.abs(this.vignetteLevels[prevIdx] - this.vignetteAlpha)
            ? idx
            : prevIdx,
        0,
      );
      $("vignetteSlider").value = closestVignetteIndex;
    }

    this.setFontSize(this.fontSize);
    this.setRingWidth(this.ringWidth);
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
      "app_show_foreground_banner",
      "app_sw_minute_beep",
    ];
    keys.forEach(safeRemoveLS);

    this.showMs = true;
    this.showForegroundBanner = true;
    this.isAdaptiveBg = true;
    this.hasVignette = false;
    this.isLiquidGlass = false;
    this.hideNavLabels = false;
    this.vignetteAlpha = 0.2;
    this.fontSize = 16;
    this.ringWidth = 4;
    this.swMinuteBeep = true;

    this.applySettings();
  },

  syncSliderUIs() {
    requestAnimationFrame(() => {
      this.updateSliderLabel(
        "vignetteSlider",
        "vignette-label",
        this.vignetteLabels,
      );
      this.updateSliderLabel("vibroSlider", "vibro-label", this.vibroLabels);
    });
  },

  updateSliderLabel(sliderId, labelId, labelsArray) {
    const slider = $(sliderId);
    const label = $(labelId);
    if (!slider || !label) return;

    const val = parseInt(slider.value, 10);
    const min = parseFloat(slider.min);
    const max = parseFloat(slider.max);

    label.textContent = t(labelsArray[val] || labelsArray[0]);

    const percent = max - min > 0 ? (val - min) / (max - min) : 0;
    const thumbWidth = 24;
    const trackWidth = slider.offsetWidth;
    if (trackWidth === 0) return;

    const offset = thumbWidth / 2 - percent * thumbWidth;
    label.style.left = `calc(${percent * 100}% + ${offset}px)`;
  },

  setFontSize(size) {
    document.documentElement.style.setProperty("--font-scale", size / 16);
    if ($("fontSizeDisplay")) $("fontSizeDisplay").textContent = `${size} px`;
  },

  setRingWidth(width) {
    document.documentElement.style.setProperty("--ring-stroke-width", width);
    if ($("ringWidthDisplay"))
      $("ringWidthDisplay").textContent = `${width.toFixed(1)} px`;
  },

  updateVignette() {
    const bg = document.querySelector(".app-bg");
    if (!bg) return;

    const container = $("vignette-depth-container");
    container?.classList.toggle("hidden", !this.hasVignette);
    container?.classList.toggle("flex", this.hasVignette);

    bg.classList.toggle("has-vignette", this.hasVignette);

    if (this.hasVignette) {
      document.documentElement.style.setProperty(
        "--vignette-alpha",
        this.vignetteAlpha * 0.4,
      );
      this.syncSliderUIs();
    }
  },

  updateVibroSliderUI(isEnabled) {
    const container = $("vibro-level-container");
    container?.classList.toggle("hidden", !isEnabled);
    container?.classList.toggle("flex", isEnabled);

    if (isEnabled) this.syncSliderUIs();
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
