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

export const themeManager = {
  currentMode: "system",
  currentAccent: "default",
  currentBg: "default",

  // История выбора цветов в рамках текущего запуска приложения.
  // Нужна для fallback после удаления активного кастомного цвета.
  accentSelectionHistory: [],
  bgSelectionHistory: [],
  HISTORY_LIMIT: 20,

  _darkModeListener: null,

  init() {
    uiSettingsManager.init();
    colorManager.init();

    this.applySettings();
    this._bindEvents();
  },

  _bindEvents() {
    document
      .querySelectorAll('[id^="theme-"]')
      .forEach((btn) =>
        btn.addEventListener("click", (e) =>
          this.setMode(e.currentTarget.dataset.themeMode),
        ),
      );

    this._darkModeListener = () => {
      if (this.currentMode === "system") this.setMode("system");
    };

    window
      .matchMedia("(prefers-color-scheme: dark)")
      .addEventListener("change", this._darkModeListener);

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

      if (type === "accent") {
        const isDeletedActive =
          String(this.currentAccent).toLowerCase() ===
          String(color).toLowerCase();

        this._removeColorFromHistory("accent", color);

        if (isDeletedActive) {
          const fallback = this._getLastValidColorFromHistory("accent");
          this.setColor(fallback || "default", true, { recordHistory: false });
        }
      } else if (type === "bg") {
        const isDeletedActive =
          String(this.currentBg).toLowerCase() === String(color).toLowerCase();

        this._removeColorFromHistory("bg", color);

        if (isDeletedActive) {
          const fallback = this._getLastValidColorFromHistory("bg");
          this.setBgColor(fallback || "default", true, {
            recordHistory: false,
          });
        }
      }
    });
  },

  destroy() {
    if (this._darkModeListener) {
      window
        .matchMedia("(prefers-color-scheme: dark)")
        .removeEventListener("change", this._darkModeListener);
      this._darkModeListener = null;
    }
  },

  applySettings() {
    // После перезапуска истории нет: это как раз нужный сценарий,
    // при удалении активного кастомного цвета fallback -> default.
    this.accentSelectionHistory = [];
    this.bgSelectionHistory = [];

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

    // Сброс настроек должен возвращать default.
    this.accentSelectionHistory = [];
    this.bgSelectionHistory = [];

    uiSettingsManager.resetSettings();
    this.applySettings();
  },

  getCurrentTheme() {
    return document.documentElement.classList.contains("dark")
      ? "dark"
      : "light";
  },

  _rememberPreviousSelection(type, previousColor, nextColor) {
    if (!previousColor) return;

    const prev = String(previousColor).toLowerCase();
    const next = String(nextColor).toLowerCase();
    if (prev === next) return;

    const history =
      type === "accent" ? this.accentSelectionHistory : this.bgSelectionHistory;

    const last = history[history.length - 1];
    if (String(last || "").toLowerCase() === prev) return;

    history.push(previousColor);
    if (history.length > this.HISTORY_LIMIT) {
      history.splice(0, history.length - this.HISTORY_LIMIT);
    }
  },

  _removeColorFromHistory(type, color) {
    const history =
      type === "accent" ? this.accentSelectionHistory : this.bgSelectionHistory;
    const normalized = String(color).toLowerCase();

    const filtered = history.filter(
      (item) => String(item).toLowerCase() !== normalized,
    );

    if (type === "accent") this.accentSelectionHistory = filtered;
    else this.bgSelectionHistory = filtered;
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

  _getLastValidColorFromHistory(type) {
    const history =
      type === "accent" ? this.accentSelectionHistory : this.bgSelectionHistory;
    const available = this._getAvailableColorSet(type);

    while (history.length > 0) {
      const candidate = history.pop();
      if (available.has(String(candidate).toLowerCase())) {
        return candidate;
      }
    }

    return null;
  },

  setMode(mode, useTransition = true) {
    if (useTransition) document.body.classList.add("is-updating-theme");

    this.currentMode = mode;
    safeSetLS("theme_mode", mode);

    document.querySelectorAll("[data-theme-mode]").forEach((b) => {
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

  setColor(hex, doScroll = true, options = {}) {
    const { recordHistory = true } = options;

    if (recordHistory) {
      this._rememberPreviousSelection("accent", this.currentAccent, hex);
    }

    this.currentAccent = hex;
    safeSetLS("theme_color", hex);

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

  setBgColor(hex, doScroll = true, options = {}) {
    const { recordHistory = true } = options;

    if (recordHistory) {
      this._rememberPreviousSelection("bg", this.currentBg, hex);
    }

    this.currentBg = hex;
    safeSetLS("theme_bg_color", hex);

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
