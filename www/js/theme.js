// Файл: www/js/theme.js

import {
  $,
  safeGetLS,
  safeSetLS,
  safeRemoveLS,
  hexToHSL,
  hexToRGB,
  getLuminance,
  LS_KEYS, // ИСПРАВЛЕНИЕ (Пункт #10): Импортируем константы
} from "./utils.js?v=VERSION";
import { uiSettingsManager } from "./ui-settings.js?v=VERSION";
import { colorManager } from "./color-manager.js?v=VERSION";

export const themeManager = {
  currentMode: "system",
  currentAccent: "default",
  currentBg: "default",
  themeButtons: [], // ИСПРАВЛЕНИЕ (Пункт #7): Кэш для кнопок темы
  mediaQuery: null, // ИСПРАВЛЕНИЕ (Пункт #8): Храним ссылку на mediaQuery
  _boundHandleSystemThemeChange: null, // ИСПРАВЛЕНИЕ (Пункт #8): Для удаления listener

  init() {
    uiSettingsManager.init();
    colorManager.init();

    this.applySettings();
    this._bindEvents();
  },

  _bindEvents() {
    // ИСПРАВЛЕНИЕ (Пункт #7): Кэшируем кнопки один раз
    this.themeButtons = document.querySelectorAll('[id^="theme-"]');
    this.themeButtons.forEach((btn) =>
      btn.addEventListener("click", (e) =>
        this.setMode(e.currentTarget.dataset.themeMode),
      ),
    );

    // ИСПРАВЛЕНИЕ (Пункт #8): Сохраняем mediaQuery и используем именованный обработчик
    this._boundHandleSystemThemeChange =
      this._handleSystemThemeChange.bind(this);
    this.mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    this.mediaQuery.addEventListener(
      "change",
      this._boundHandleSystemThemeChange,
    );

    document.addEventListener("adaptiveBgChanged", () => {
      document.body.classList.add("is-updating-theme");
      this.applyBgTheme(this.currentBg);
      requestAnimationFrame(() =>
        document.body.classList.remove("is-updating-theme"),
      );
    });

    document.addEventListener("colorSelected", (e) => {
      const { type, color, fromPicker } = e.detail;
      if (type === "accent") this.setColor(color, !fromPicker);
      else this.setBgColor(color, !fromPicker);
    });

    document.addEventListener("colorDeleted", (e) => {
      const { type, color } = e.detail;
      if (
        type === "accent" &&
        this.currentAccent.toLowerCase() === color.toLowerCase()
      ) {
        this.setColor("default");
      } else if (
        type === "bg" &&
        this.currentBg.toLowerCase() === color.toLowerCase()
      ) {
        this.setBgColor("default");
      }
    });
  },

  // ИСПРАВЛЕНИЕ (Пункт #8): Именованный обработчик для listener'а
  _handleSystemThemeChange() {
    if (this.currentMode === "system") {
      this.setMode("system");
    }
  },

  // ИСПРАВЛЕНИЕ (Пункт #8): Метод для очистки ресурсов
  destroy() {
    if (this.mediaQuery && this._boundHandleSystemThemeChange) {
      this.mediaQuery.removeEventListener(
        "change",
        this._boundHandleSystemThemeChange,
      );
    }
  },

  applySettings() {
    // ИСПРАВЛЕНИЕ (Пункт #10): Используем константы LS_KEYS
    this.currentAccent = safeGetLS(LS_KEYS.THEME_COLOR) || "default";
    this.currentBg = safeGetLS(LS_KEYS.THEME_BG_COLOR) || "default";
    this.currentMode = safeGetLS(LS_KEYS.THEME_MODE) || "system";

    colorManager.syncPickers(this.currentAccent, this.currentBg);

    this.setMode(this.currentMode, false);
    this.setColor(this.currentAccent, false);
    this.setBgColor(this.currentBg, false);
  },

  resetSettings() {
    // ИСПРАВЛЕНИЕ (Пункт #10): Используем константы LS_KEYS
    safeRemoveLS(LS_KEYS.THEME_MODE);
    safeRemoveLS(LS_KEYS.THEME_COLOR);
    safeRemoveLS(LS_KEYS.THEME_BG_COLOR);

    uiSettingsManager.resetSettings();

    this.applySettings();
  },

  getCurrentTheme() {
    return document.documentElement.classList.contains("dark")
      ? "dark"
      : "light";
  },

  setMode(mode, useTransition = true) {
    if (useTransition) document.body.classList.add("is-updating-theme");

    this.currentMode = mode;
    safeSetLS(LS_KEYS.THEME_MODE, mode);

    // ИСПРАВЛЕНИЕ (Пункт #7): Используем кэшированные кнопки
    this.themeButtons.forEach((b) => {
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

    this.setColor(this.currentAccent, false);
    this.applyBgTheme(this.currentBg);
    colorManager.syncPickers(this.currentAccent, this.currentBg);
    colorManager.updateSelectionUI("accent", this.currentAccent, false);
    colorManager.updateSelectionUI("bg", this.currentBg, false);

    if (useTransition) {
      requestAnimationFrame(() =>
        document.body.classList.remove("is-updating-theme"),
      );
    }
  },

  getPairedRestColor(hue) {
    if (hue >= 75 && hue < 185) return "#3b82f6";
    if (hue >= 185 && hue < 250) return "#22c55e";
    if (hue >= 335 || hue < 20) return "#2dd4bf";
    if (hue >= 20 && hue < 75) return "#6366f1";
    if (hue >= 250 && hue < 335) return "#facc15";
    return "#3b82f6";
  },

  getPairedAlertColor(hue, luminance) {
    if (luminance < 10) return "hsl(0, 90%, 60%)";
    if (hue >= 335 || hue < 20) return "hsl(35, 100%, 58%)";
    return "hsl(0, 90%, 60%)";
  },

  setColor(hex, doScroll = true) {
    this.currentAccent = hex;
    safeSetLS(LS_KEYS.THEME_COLOR, hex);

    const rootEl = document.documentElement;

    if (hex === "default") {
      rootEl.style.removeProperty("--primary-color");
      rootEl.style.removeProperty("--accent-h");
      rootEl.style.setProperty("--secondary-accent-color", "#3b82f6");
      rootEl.style.setProperty("--alert-color", "hsl(0, 90%, 60%)");
    } else {
      rootEl.style.setProperty("--primary-color", hex);
      const { h, l } = hexToHSL(hex);
      rootEl.style.setProperty("--accent-h", h);
      const restColor = this.getPairedRestColor(h);
      rootEl.style.setProperty("--secondary-accent-color", restColor);
      const alertColor = this.getPairedAlertColor(h, l);
      rootEl.style.setProperty("--alert-color", alertColor);
    }

    document.dispatchEvent(new CustomEvent("accentColorChanged"));
    colorManager.updateSelectionUI("accent", hex, doScroll);
    colorManager.syncPickers(this.currentAccent, this.currentBg);
  },

  setBgColor(hex, doScroll = true) {
    this.currentBg = hex;
    safeSetLS(LS_KEYS.THEME_BG_COLOR, hex);
    this.applyBgTheme(hex);
    colorManager.updateSelectionUI("bg", hex, doScroll);
    colorManager.syncPickers(this.currentAccent, this.currentBg);
  },

  applyBgTheme(hex) {
    const root = document.documentElement;
    const isDark = root.classList.contains("dark");
    document.body.classList.remove("force-light-text", "force-dark-text");

    document.documentElement.classList.toggle(
      "no-adaptive",
      !uiSettingsManager.isAdaptiveBg,
    );

    if (hex === "default") {
      root.style.removeProperty("--bg-color");
      root.style.removeProperty("--surface-color");
    } else {
      const { r, g, b } = hexToRGB(hex);
      const { h, s, l } = hexToHSL(hex);

      if (!uiSettingsManager.isAdaptiveBg) {
        root.style.setProperty("--bg-color", hex);
        root.style.setProperty(
          "--surface-color",
          `color-mix(in srgb, ${hex}, ${isDark ? "white 10%" : l > 90 ? "black 5%" : "white 25%"})`,
        );
        const luminance = getLuminance(r, g, b);
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
    }
  },

  syncSliderUIs() {
    uiSettingsManager.syncSliderUIs();
  },
};
