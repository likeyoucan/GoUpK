// Файл: www/js/theme.js

import {
  $,
  safeGetLS,
  safeSetLS,
  safeRemoveLS,
  hexToHSL,
  hexToRGB,
  getLuminance,
} from "./utils.js?v=VERSION";
import { uiSettingsManager } from "./ui-settings.js?v=VERSION";
import { colorManager } from "./color-manager.js?v=VERSION";
import { APP_EVENTS } from "./constants/events.js?v=VERSION";

import {
  applyModeToDocument,
  bindSystemThemeListener,
  syncModeButtons,
} from "./theme/theme-mode.js?v=VERSION";
import { createColorHistory } from "./theme/theme-color-history.js?v=VERSION";
import {
  applyAccentVars,
  applyBgTheme as applyBgThemeVars,
} from "./theme/theme-colors.js?v=VERSION";

export const themeManager = {
  currentMode: "system",
  currentAccent: "default",
  currentBg: "default",

  _unbindSystemThemeListener: null,
  _history: createColorHistory(20),

  init() {
    uiSettingsManager.init();
    colorManager.init();

    this.applySettings();
    this._bindEvents();
  },

  _bindEvents() {
    document.querySelectorAll('[id^="theme-"]').forEach((btn) => {
      btn.addEventListener("click", (e) =>
        this.setMode(e.currentTarget.dataset.themeMode),
      );
    });

    this._unbindSystemThemeListener = bindSystemThemeListener(() => {
      if (this.currentMode === "system") this.setMode("system");
    });

    document.addEventListener(APP_EVENTS.ADAPTIVE_BG_CHANGED, () => {
      document.body.classList.add("is-updating-theme");
      this.applyBgTheme(this.currentBg);
      requestAnimationFrame(() =>
        document.body.classList.remove("is-updating-theme"),
      );
    });

    document.addEventListener(APP_EVENTS.COLOR_SELECTED, (e) => {
      const { type, color, fromPicker } = e.detail;
      if (type === "accent") this.setColor(color, !fromPicker);
      else this.setBgColor(color, !fromPicker);
    });

    document.addEventListener(APP_EVENTS.COLOR_DELETED, (e) => {
      const { type, color } = e.detail;

      if (type === "accent") {
        const isDeletedActive =
          String(this.currentAccent).toLowerCase() ===
          String(color).toLowerCase();

        this._history.removeFromHistory("accent", color);

        if (isDeletedActive) {
          const fallback = this._getLastValidColor("accent");
          this.setColor(fallback || "default", true, { recordHistory: false });
        }
      } else if (type === "bg") {
        const isDeletedActive =
          String(this.currentBg).toLowerCase() === String(color).toLowerCase();

        this._history.removeFromHistory("bg", color);

        if (isDeletedActive) {
          const fallback = this._getLastValidColor("bg");
          this.setBgColor(fallback || "default", true, {
            recordHistory: false,
          });
        }
      }
    });
  },

  destroy() {
    if (this._unbindSystemThemeListener) {
      this._unbindSystemThemeListener();
      this._unbindSystemThemeListener = null;
    }
  },

  applySettings() {
    this._history.reset();

    this.currentAccent = safeGetLS("theme_color") || "default";
    this.currentBg = safeGetLS("theme_bg_color") || "default";
    this.currentMode = safeGetLS("theme_mode") || "system";

    colorManager.syncPickers(this.currentAccent, this.currentBg);

    this.setMode(this.currentMode, false);
    this.setColor(this.currentAccent, false, { recordHistory: false });
    this.setBgColor(this.currentBg, false, { recordHistory: false });
  },

  resetSettings() {
    safeRemoveLS("theme_mode");
    safeRemoveLS("theme_color");
    safeRemoveLS("theme_bg_color");

    this._history.reset();
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
    safeSetLS("theme_mode", mode);

    syncModeButtons($, mode);
    applyModeToDocument(mode);

    this.setColor(this.currentAccent, false, { recordHistory: false });
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

  _getAvailableColorSet(type) {
    const base =
      type === "accent"
        ? [
            ...colorManager.standardAccentColors,
            ...colorManager.customAccentColors,
          ]
        : [...colorManager.standardBgColors, ...colorManager.customBgColors];

    return new Set(base.map((c) => String(c).toLowerCase()));
  },

  _getLastValidColor(type) {
    return this._history.getLastValid(type, this._getAvailableColorSet(type));
  },

  setColor(hex, doScroll = true, options = {}) {
    const { recordHistory = true } = options;

    if (recordHistory) {
      this._history.remember("accent", this.currentAccent, hex);
    }

    this.currentAccent = hex;
    safeSetLS("theme_color", hex);

    applyAccentVars({
      hex,
      rootEl: document.documentElement,
      hexToHSL,
    });

    document.dispatchEvent(new CustomEvent(APP_EVENTS.ACCENT_COLOR_CHANGED));

    colorManager.updateSelectionUI("accent", hex, doScroll);
    colorManager.syncPickers(this.currentAccent, this.currentBg);
  },

  setBgColor(hex, doScroll = true, options = {}) {
    const { recordHistory = true } = options;

    if (recordHistory) {
      this._history.remember("bg", this.currentBg, hex);
    }

    this.currentBg = hex;
    safeSetLS("theme_bg_color", hex);

    this.applyBgTheme(hex);

    colorManager.updateSelectionUI("bg", hex, doScroll);
    colorManager.syncPickers(this.currentAccent, this.currentBg);
  },

  applyBgTheme(hex) {
    applyBgThemeVars({
      hex,
      uiSettingsManager,
      hexToRGB,
      hexToHSL,
      getLuminance,
    });
  },

  syncSliderUIs() {
    uiSettingsManager.syncSliderUIs();
  },
};
