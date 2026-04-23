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
  vibroLevels: [0.5, 0.75, 1, 1.5, 2],
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
    };
    for (const [id, callback] of Object.entries(toggleListeners)) {
      $(id)?.addEventListener("change", (e) => callback(e.target.checked));
    }

    const sliderCallbacks = {
      fontSlider: (val, isFinal) => this._setFontSize(val, isFinal),
      ringWidthSlider: (val, isFinal) => this._setRingWidth(val, isFinal),
      volumeSlider: (val, isFinal) => sm.setVolume(val, isFinal),
      vignetteSlider: (val, isFinal) => this._setVignetteLevel(val, isFinal),
      vibroSlider: (val, isFinal) => this._setVibroLevel(val, isFinal),
    };
    for (const [id, callback] of Object.entries(sliderCallbacks)) {
      const slider = $(id);
      if (!slider) continue;
      slider.addEventListener("input", (e) => callback(e.target.value, false));
      slider.addEventListener("change", (e) => callback(e.target.value, true));
    }
  },

  applySettings() {
    // --- ПЕРЕКЛЮЧАТЕЛИ ---
    this.isAdaptiveBg = safeGetLS("app_adaptive_bg") !== "false";
    if ($("toggle-adaptive-bg"))
      $("toggle-adaptive-bg").checked = this.isAdaptiveBg;
    this.hasVignette = safeGetLS("app_vignette") === "true";
    if ($("toggle-vignette")) $("toggle-vignette").checked = this.hasVignette;
    this.isLiquidGlass = safeGetLS("app_liquid_glass") === "true";
    if ($("toggle-glass")) $("toggle-glass").checked = this.isLiquidGlass;
    this.hideNavLabels = safeGetLS("app_hide_nav_labels") === "true";
    if ($("toggle-nav-labels"))
      $("toggle-nav-labels").checked = this.hideNavLabels;
    this.showMs = safeGetLS("app_show_ms") !== "false";
    if ($("toggle-ms")) $("toggle-ms").checked = this.showMs;
    this.swMinuteBeep = safeGetLS("app_sw_minute_beep") !== "false";
    if ($("toggle-sw-minute-beep"))
      $("toggle-sw-minute-beep").checked = this.swMinuteBeep;

    // --- СЛАЙДЕРЫ: ЧТЕНИЕ И УСТАНОВКА ЗНАЧЕНИЙ В DOM ---
    // Это ключевой фикс: мы явно устанавливаем .value для каждого слайдера.
    const fontSize = safeGetLS("font_size") || 16;
    if ($("fontSlider")) $("fontSlider").value = fontSize;
    this._setFontSize(fontSize, false); // Обновляем UI без сохранения

    const ringWidth = safeGetLS("app_ring_width") || 4;
    if ($("ringWidthSlider")) $("ringWidthSlider").value = ringWidth;
    this._setRingWidth(ringWidth, false);

    const volume =
      safeGetLS("app_volume") !== null
        ? parseFloat(safeGetLS("app_volume"))
        : 1;
    if ($("volumeSlider")) $("volumeSlider").value = volume;
    sm.setVolume(volume, false);

    const vignetteAlpha = parseFloat(safeGetLS("app_vignette_alpha")) || 0.2;
    const vignetteIndex = this.vignetteLevels.reduce(
      (p, c, i) =>
        Math.abs(c - vignetteAlpha) <
        Math.abs(this.vignetteLevels[p] - vignetteAlpha)
          ? i
          : p,
      0,
    );
    if ($("vignetteSlider")) $("vignetteSlider").value = vignetteIndex;
    this._setVignetteLevel(vignetteIndex, false);

    const vibroLevel = parseFloat(safeGetLS("app_vibro_level")) || 1;
    const vibroIndex = this.vibroLevels.reduce(
      (p, c, i) =>
        Math.abs(c - vibroLevel) < Math.abs(this.vibroLevels[p] - vibroLevel)
          ? i
          : p,
      0,
    );
    if ($("vibroSlider")) $("vibroSlider").value = vibroIndex;
    this._setVibroLevel(vibroIndex, false);

    // --- Применение эффектов и синхронизация UI ---
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
    sm.resetSettings(); // Сброс настроек звука
    this.applySettings(); // Применит дефолты и обновит UI
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
    const slider = $(sliderId),
      label = $(labelId);
    if (!slider || !label) return;
    const val = parseInt(slider.value, 10),
      min = parseFloat(slider.min),
      max = parseFloat(slider.max);
    label.textContent = t(labelsArray[val] || labelsArray[0]);
    const percent = max > min ? (val - min) / (max - min) : 0;
    const thumbWidth = 24,
      trackWidth = slider.offsetWidth;
    if (trackWidth === 0) return;
    const offset = thumbWidth / 2 - percent * thumbWidth;
    label.style.left = `calc(${percent * 100}% + ${offset}px)`;
  },

  // --- Внутренние методы-сеттеры ---
  _setFontSize(s, isFinal) {
    const n = Number(s);
    document.documentElement.style.setProperty("--font-scale", n / 16);
    if ($("fontSizeDisplay")) $("fontSizeDisplay").textContent = `${n} px`;
    if (isFinal) safeSetLS("font_size", n);
    else sm.vibrate(10, "tactile");
  },
  _setRingWidth(w, isFinal) {
    const n = Number(w);
    this.ringWidth = n;
    document.documentElement.style.setProperty("--ring-stroke-width", n);
    if ($("ringWidthDisplay"))
      $("ringWidthDisplay").textContent = `${n.toFixed(1)} px`;
    if (isFinal) safeSetLS("app_ring_width", n);
    else sm.vibrate(10, "tactile");
  },
  _setVignetteLevel(val, isFinal) {
    this.vignetteAlpha = this.vignetteLevels[val];
    this.updateVignette();
    this.updateSliderLabel(
      "vignetteSlider",
      "vignette-label",
      this.vignetteLabels,
    );
    if (isFinal) safeSetLS("app_vignette_alpha", this.vignetteAlpha);
    else sm.vibrate(10, "tactile");
  },
  _setVibroLevel(val, isFinal) {
    const newLevel = this.vibroLevels[val] || 1;
    sm.vibroLevel = newLevel;
    this.updateSliderLabel("vibroSlider", "vibro-label", this.vibroLabels);
    if (isFinal) {
      safeSetLS("app_vibro_level", newLevel);
      sm.vibrate(50, "strong");
    } else {
      sm.vibrate(10, "tactile");
    }
  },

  // --- Методы для применения эффектов ---
  updateVignette() {
    const bg = document.querySelector(".app-bg"),
      c = $("vignette-depth-container");
    if (!bg) return;
    c?.classList.toggle("hidden", !this.hasVignette);
    c?.classList.toggle("flex", this.hasVignette);
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
    const c = $("vibro-level-container");
    c?.classList.toggle("hidden", !isEnabled);
    c?.classList.toggle("flex", isEnabled);
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
