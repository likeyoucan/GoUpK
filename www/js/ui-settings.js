// Файл: www/js/ui-settings.js

import { $, safeGetLS, safeSetLS, safeRemoveLS, LS_KEYS } from "./utils.js?v=VERSION";
import { t } from "./i18n.js?v=VERSION";
import { sm } from "./sound.js?v=VERSION";

export const uiSettingsManager = {
  // Состояние
  _initialized: false,
  showMs: true,
  isAdaptiveBg: true,
  hasVignette: false,
  isLiquidGlass: false,
  hideNavLabels: false,
  vignetteAlpha: 0.2,
  fontSize: 16,
  ringWidth: 4,
  swMinuteBeep: true,
  
  // Кэш для размеров, чтобы избежать layout thrashing
  _sliderTrackWidth: 0, 

  // Константы
  vignetteLevels: [0.1, 0.15, 0.2, 0.25, 0.3],
  vignetteLabels: ["vignette_min", "vignette_low", "vignette_medium", "vignette_high", "vignette_max"],
  vibroLabels: ["vibro_min", "vibro_low", "vibro_medium", "vibro_high", "vibro_max"],

  init() {
    if (this._initialized) return;
    this._initialized = true;

    this.applySettings();
    this._bindEvents();
    this._cacheSliderWidths();
  },
  
  _cacheSliderWidths() {
    // Кэшируем ширину одного из слайдеров, предполагая, что они одинаковы
    const slider = $("vignetteSlider");
    if (slider) {
      this._sliderTrackWidth = slider.offsetWidth;
    }
  },

  _bindEvents() {
    window.addEventListener('resize', () => this._cacheSliderWidths());
    document.addEventListener("languageChanged", () => this.syncSliderUIs());
    document.addEventListener("vibroToggled", (e) => this.updateVibroSliderUI(e.detail.enabled));

    // Декларативная конфигурация для всех переключателей
    const toggleConfig = [
      { id: "toggle-ms",          key: LS_KEYS.APP_SHOW_MS,          state: "showMs",         event: "msChanged" },
      { id: "toggle-nav-labels",  key: LS_KEYS.APP_HIDE_NAV_LABELS,  state: "hideNavLabels",  callback: this.applyNavLabelsVisibility },
      { id: "toggle-glass",       key: LS_KEYS.APP_LIQUID_GLASS,     state: "isLiquidGlass",  callback: this.updateGlass },
      { id: "toggle-vignette",    key: LS_KEYS.APP_VIGNETTE,         state: "hasVignette",    callback: this.updateVignette },
      { id: "toggle-adaptive-bg", key: LS_KEYS.APP_ADAPTIVE_BG,      state: "isAdaptiveBg",   event: "adaptiveBgChanged" },
      { id: "toggle-sw-minute-beep", key: LS_KEYS.APP_SW_MINUTE_BEEP,state: "swMinuteBeep" },
    ];

    toggleConfig.forEach(config => {
      const element = $(config.id);
      element?.addEventListener("change", (e) => {
        const value = e.target.checked;
        this[config.state] = value;
        safeSetLS(config.key, String(value)); // Сохраняем как строку "true"/"false"
        if (config.event) document.dispatchEvent(new CustomEvent(config.event));
        if (config.callback) config.callback.call(this);
      });
    });

    // Обработчики для слайдеров
    const fontSlider = $("fontSlider");
    if (fontSlider) {
      fontSlider.addEventListener("input", (e) => this.setFontSize(Number(e.target.value)));
      fontSlider.addEventListener("change", (e) => safeSetLS(LS_KEYS.FONT_SIZE, e.target.value));
    }

    const ringWidthSlider = $("ringWidthSlider");
    if (ringWidthSlider) {
      ringWidthSlider.addEventListener("input", (e) => this.setRingWidth(Number(e.target.value)));
      ringWidthSlider.addEventListener("change", (e) => safeSetLS(LS_KEYS.APP_RING_WIDTH, e.target.value));
    }

    const vignetteSlider = $("vignetteSlider");
    if (vignetteSlider) {
      const handler = () => {
        this.vignetteAlpha = this.vignetteLevels[vignetteSlider.value];
        this.updateVignette();
        this.updateSliderLabel("vignetteSlider", "vignette-label", this.vignetteLabels);
      };
      vignetteSlider.addEventListener("input", handler);
      vignetteSlider.addEventListener("change", () => safeSetLS(LS_KEYS.APP_VIGNETTE_ALPHA, this.vignetteAlpha));
    }

    const vibroSlider = $("vibroSlider");
    if (vibroSlider) {
        const handler = () => {
            const levels = [0.5, 0.75, 1, 1.5, 2];
            sm.vibroLevel = levels[vibroSlider.value] || 1;
            this.updateSliderLabel("vibroSlider", "vibro-label", this.vibroLabels);
        };
        vibroSlider.addEventListener("input", handler);
        vibroSlider.addEventListener("change", (e) => {
            safeSetLS(LS_KEYS.APP_VIBRO_LEVEL, sm.vibroLevel);
            sm.vibrate(50, "strong");
        });
    }
  },

  applySettings() {
    // Чтение настроек из localStorage
    this.isAdaptiveBg = safeGetLS(LS_KEYS.APP_ADAPTIVE_BG) !== "false";
    this.hasVignette = safeGetLS(LS_KEYS.APP_VIGNETTE) === "true";
    this.isLiquidGlass = safeGetLS(LS_KEYS.APP_LIQUID_GLASS) === "true";
    this.hideNavLabels = safeGetLS(LS_KEYS.APP_HIDE_NAV_LABELS) === "true";
    this.showMs = safeGetLS(LS_KEYS.APP_SHOW_MS) !== "false";
    this.swMinuteBeep = safeGetLS(LS_KEYS.APP_SW_MINUTE_BEEP) !== "false";
    this.fontSize = Number(safeGetLS(LS_KEYS.FONT_SIZE)) || 16;
    this.ringWidth = Number(safeGetLS(LS_KEYS.APP_RING_WIDTH)) || 4;
    this.vignetteAlpha = parseFloat(safeGetLS(LS_KEYS.APP_VIGNETTE_ALPHA)) || 0.2;

    // Применение настроек к UI элементам
    if ($("toggle-adaptive-bg")) $("toggle-adaptive-bg").checked = this.isAdaptiveBg;
    if ($("toggle-vignette")) $("toggle-vignette").checked = this.hasVignette;
    if ($("toggle-glass")) $("toggle-glass").checked = this.isLiquidGlass;
    if ($("toggle-nav-labels")) $("toggle-nav-labels").checked = this.hideNavLabels;
    if ($("toggle-ms")) $("toggle-ms").checked = this.showMs;
    if ($("toggle-sw-minute-beep")) $("toggle-sw-minute-beep").checked = this.swMinuteBeep;

    if ($("fontSlider")) $("fontSlider").value = this.fontSize;
    if ($("ringWidthSlider")) $("ringWidthSlider").value = this.ringWidth;
    if ($("vignetteSlider")) {
      const closestVignetteIndex = this.vignetteLevels.reduce((p, c, i) => Math.abs(c - this.vignetteAlpha) < Math.abs(this.vignetteLevels[p] - this.vignetteAlpha) ? i : p, 0);
      $("vignetteSlider").value = closestVignetteIndex;
    }

    // Применение визуальных эффектов
    this.setFontSize(this.fontSize);
    this.setRingWidth(this.ringWidth);
    this.applyNavLabelsVisibility();
    this.updateGlass();
    this.updateVignette();
    this.syncSliderUIs();
  },

  resetSettings() {
    const keys = [LS_KEYS.FONT_SIZE, LS_KEYS.APP_ADAPTIVE_BG, LS_KEYS.APP_VIGNETTE, LS_KEYS.APP_VIGNETTE_ALPHA, LS_KEYS.APP_LIQUID_GLASS, LS_KEYS.APP_HIDE_NAV_LABELS, LS_KEYS.APP_RING_WIDTH, LS_KEYS.APP_SHOW_MS, LS_KEYS.APP_SW_MINUTE_BEEP];
    keys.forEach(safeRemoveLS);
    
    // После очистки localStorage, вызываем applySettings, который применит дефолты
    this.applySettings();
  },

  syncSliderUIs() {
    requestAnimationFrame(() => {
      this.updateSliderLabel("vignetteSlider", "vignette-label", this.vignetteLabels);
      this.updateSliderLabel("vibroSlider", "vibro-label", this.vibroLabels);
    });
  },

  updateSliderLabel(sliderId, labelId, labelsArray) {
    const slider = $(sliderId), label = $(labelId);
    if (!slider || !label) return;
    const val = parseInt(slider.value, 10), min = parseFloat(slider.min), max = parseFloat(slider.max);
    label.textContent = t(labelsArray[val] || labelsArray[0]);
    const percent = max - min > 0 ? (val - min) / (max - min) : 0;
    const thumbWidth = 24;
    const trackWidth = this._sliderTrackWidth;
    if (trackWidth === 0 && slider.offsetWidth > 0) {
      // Если кэш пуст, но элемент уже виден
      this._sliderTrackWidth = slider.offsetWidth;
    }
    const offset = thumbWidth / 2 - percent * thumbWidth;
    label.style.left = `calc(${percent * 100}% + ${offset}px)`;
  },

  setFontSize(s) {
    document.documentElement.style.setProperty("--font-scale", s / 16);
    if ($("fontSizeDisplay")) $("fontSizeDisplay").textContent = `${s} px`;
  },

  setRingWidth(w) {
    this.ringWidth = w;
    document.documentElement.style.setProperty("--ring-stroke-width", w);
    if ($("ringWidthDisplay")) $("ringWidthDisplay").textContent = `${w.toFixed(1)} px`;
  },

  updateVignette() {
    const bg = document.querySelector(".app-bg");
    if (!bg) return;
    const c = $("vignette-depth-container");
    c?.classList.toggle("hidden", !this.hasVignette);
    c?.classList.toggle("flex", this.hasVignette);
    bg.classList.toggle("has-vignette", this.hasVignette);
    if (this.hasVignette) {
      document.documentElement.style.setProperty("--vignette-alpha", this.vignetteAlpha * 0.4);
      this.syncSliderUIs();
    }
  },

  updateVibroSliderUI(isEnabled) {
    const c = $("vibro-level-container");
    c?.classList.toggle("hidden", !isEnabled);
    c?.classList.toggle("flex", isEnabled);
    if (isEnabled) {
      this.syncSliderUIs();
    }
  },

  updateGlass() {
    document.documentElement.classList.toggle("glass-effect", this.isLiquidGlass);
  },

  applyNavLabelsVisibility() {
    document.body.classList.toggle("hide-nav-labels", this.hideNavLabels);
  },
};