// Файл: www/js/theme.js

import {
  $,
  safeGetLS,
  safeSetLS,
  safeRemoveLS,
  hexToHSL,
  hexToRGB,
  getLuminance,
  showToast,
} from "./utils.js?v=VERSION";
import { uiSettingsManager } from "./ui-settings.js?v=VERSION";
import { colorManager } from "./color-manager.js?v=VERSION";
import { appProManager } from "./app-pro.js?v=VERSION";
import { APP_EVENTS } from "./constants/events.js?v=VERSION";
import { STORAGE_KEYS } from "./constants/storage-keys.js?v=VERSION";
import { CustomSelect } from "./custom-select.js?v=VERSION";
import { t } from "./i18n.js?v=VERSION";

import {
  applyModeToDocument,
  bindSystemThemeListener,
} from "./theme/theme-mode.js?v=VERSION";
import { createColorHistory } from "./theme/theme-color-history.js?v=VERSION";
import {
  applyAccentVars,
  applyBgTheme as applyBgThemeVars,
} from "./theme/theme-colors.js?v=VERSION";

function notifyProBlocked(feature = "accent_bg") {
  showToast("Feature available in Pro");
  document.dispatchEvent(
    new CustomEvent(APP_EVENTS.PRO_PAYWALL_REQUESTED, {
      detail: { feature },
    }),
  );
}

export const themeManager = {
  currentMode: "system",
  currentAccent: "default",
  currentBg: "default",

  _unbindSystemThemeListener: null,
  _history: createColorHistory(20),
  themeModeSelect: null,

  _getThemeModeOptions() {
    return [
      {
        value: "system",
        text: t("theme_auto"),
        iconPaths: [
          "M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5z",
          "M8 21h8",
          "M12 17v4",
        ],
      },
      {
        value: "light",
        text: t("theme_light"),
        iconPaths: [
          "M12 3v2",
          "M12 19v2",
          "M3 12h2",
          "M19 12h2",
          "M5.64 5.64l1.41 1.41",
          "M16.95 16.95l1.41 1.41",
          "M5.64 18.36l1.41-1.41",
          "M16.95 7.05l1.41-1.41",
          "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8",
        ],
      },
      {
        value: "dark",
        text: t("theme_dark"),
        iconPaths: ["M21 12.79A9 9 0 1 1 11.21 3A7 7 0 0 0 21 12.79z"],
      },
    ];
  },

  _initThemeModeSelect() {
    if (this.themeModeSelect) {
      this.themeModeSelect.destroy();
      this.themeModeSelect = null;
    }

    this.themeModeSelect = new CustomSelect(
      "themeModeSelectContainer",
      this._getThemeModeOptions(),
      (value) => this.setMode(value),
      this.currentMode || "system",
    );
  },

  _syncThemeModeSelectValue() {
    if (!this.themeModeSelect) return;
    this.themeModeSelect.setValue(this.currentMode, false);
  },

  _refreshThemeModeSelectTexts() {
    if (!this.themeModeSelect) return;

    this.themeModeSelect.options = this._getThemeModeOptions();
    this.themeModeSelect.populateOptions();
    this.themeModeSelect.setValue(this.currentMode, false);
  },

  init() {
    uiSettingsManager.init();
    colorManager.init();

    this.applySettings();
    this._initThemeModeSelect();
    this._syncThemeModeSelectValue();
    this._bindEvents();
  },

  _bindEvents() {
    this._unbindSystemThemeListener = bindSystemThemeListener(() => {
      if (this.currentMode === "system") this.setMode("system");
    });

    document.addEventListener(APP_EVENTS.LANGUAGE_CHANGED, () => {
      this._refreshThemeModeSelectTexts();
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
          this.setColor(fallback || "default", true, {
            recordHistory: false,
            skipProCheck: true,
          });
        }
      } else if (type === "bg") {
        const isDeletedActive =
          String(this.currentBg).toLowerCase() === String(color).toLowerCase();

        this._history.removeFromHistory("bg", color);

        if (isDeletedActive) {
          const fallback = this._getLastValidColor("bg");
          this.setBgColor(fallback || "default", true, {
            recordHistory: false,
            skipProCheck: true,
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

    if (this.themeModeSelect) {
      this.themeModeSelect.destroy();
      this.themeModeSelect = null;
    }
  },

  applySettings() {
    this._history.reset();

    this.currentAccent = safeGetLS(STORAGE_KEYS.THEME_COLOR) || "default";
    this.currentBg = safeGetLS(STORAGE_KEYS.THEME_BG_COLOR) || "default";
    this.currentMode = safeGetLS(STORAGE_KEYS.THEME_MODE) || "system";

    if (appProManager.initialized && !appProManager.canUse("accent_bg")) {
      if (this.currentAccent !== "default" || this.currentBg !== "default") {
        this.currentAccent = "default";
        this.currentBg = "default";
        safeSetLS(STORAGE_KEYS.THEME_COLOR, "default");
        safeSetLS(STORAGE_KEYS.THEME_BG_COLOR, "default");
      }
    }

    colorManager.syncPickers(this.currentAccent, this.currentBg);

    this.setMode(this.currentMode, false);
    this.setColor(this.currentAccent, false, {
      recordHistory: false,
      skipProCheck: true,
    });
    this.setBgColor(this.currentBg, false, {
      recordHistory: false,
      skipProCheck: true,
    });
  },

  resetSettings() {
    safeRemoveLS(STORAGE_KEYS.THEME_MODE);
    safeRemoveLS(STORAGE_KEYS.THEME_COLOR);
    safeRemoveLS(STORAGE_KEYS.THEME_BG_COLOR);

    this._history.reset();
    uiSettingsManager.resetSettings();

    this.applySettings();
    this._syncThemeModeSelectValue();
  },

  getCurrentTheme() {
    return document.documentElement.classList.contains("dark")
      ? "dark"
      : "light";
  },

  setMode(mode, useTransition = true) {
    if (useTransition) document.body.classList.add("is-updating-theme");

    this.currentMode = mode;
    safeSetLS(STORAGE_KEYS.THEME_MODE, mode);

    applyModeToDocument(mode);
    this._syncThemeModeSelectValue();

    this.setColor(this.currentAccent, false, {
      recordHistory: false,
      skipProCheck: true,
    });
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
    const { recordHistory = true, skipProCheck = false } = options;

    if (
      !skipProCheck &&
      hex !== "default" &&
      !appProManager.canUse("accent_bg")
    ) {
      notifyProBlocked("accent_bg");
      colorManager.updateSelectionUI("accent", this.currentAccent, false);
      colorManager.syncPickers(this.currentAccent, this.currentBg);
      return;
    }

    if (recordHistory) {
      this._history.remember("accent", this.currentAccent, hex);
    }

    this.currentAccent = hex;
    safeSetLS(STORAGE_KEYS.THEME_COLOR, hex);

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
    const { recordHistory = true, skipProCheck = false } = options;

    if (
      !skipProCheck &&
      hex !== "default" &&
      !appProManager.canUse("accent_bg")
    ) {
      notifyProBlocked("accent_bg");
      colorManager.updateSelectionUI("bg", this.currentBg, false);
      colorManager.syncPickers(this.currentAccent, this.currentBg);
      return;
    }

    if (recordHistory) {
      this._history.remember("bg", this.currentBg, hex);
    }

    this.currentBg = hex;
    safeSetLS(STORAGE_KEYS.THEME_BG_COLOR, hex);

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
