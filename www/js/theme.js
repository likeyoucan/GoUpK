// Файл: www/js/theme.js

import { $, safeGetLS, safeSetLS, safeRemoveLS } from "./utils.js?v=VERSION";
import { settingsManager } from "./ui-settings.js?v=VERSION";
import { colorsManager } from "./ui-colors.js?v=VERSION";
import {
  hexToRGB,
  hexToHSL,
  getLuminance,
  isValidHex,
} from "./color.js?v=VERSION";

export const themeManager = {
  currentMode: "system",

  init() {
    settingsManager.init();
    colorsManager.init(this);

    this.currentMode = safeGetLS("theme_mode") || "system";
    this._internalSetMode(this.currentMode, false);

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
    window
      .matchMedia("(prefers-color-scheme: dark)")
      .addEventListener("change", () => {
        if (this.currentMode === "system") this.setMode("system");
      });
    document.addEventListener("adaptiveBgChanged", (e) =>
      this.applyBgTheme(colorsManager.currentBg, e.detail.isAdaptive),
    );
  },

  resetSettings() {
    // ИСПРАВЛЕНО (Fix #3): Полный и корректный сброс
    // 1. Вызываем сброс в дочерних модулях. Они очистят LS и обновят свое внутреннее состояние.
    settingsManager.resetSettings();
    colorsManager.resetSettings();

    // 2. Сбрасываем и применяем режим темы в координаторе
    this.setMode("system");

    // 3. После того как дочерние модули сбросили свое состояние (включая this.currentAccent/Bg),
    // принудительно применяем эти новые дефолтные значения ко всему приложению.
    this.setColor(colorsManager.currentAccent);
    this.setBgColor(colorsManager.currentBg);
  },

  setColor(hex, doScroll = true) {
    if (!isValidHex(hex)) return;
    colorsManager.currentAccent = hex;
    safeSetLS("theme_color", hex);
    document.documentElement.style.setProperty("--primary-color", hex);
    const { h } = hexToHSL(hex);
    document.documentElement.style.setProperty("--accent-h", h);

    colorsManager.updateColorSelectionUI("accent", hex, doScroll);
    colorsManager._syncPickerValues();
  },

  setBgColor(hex, doScroll = true) {
    colorsManager.currentBg = hex;
    safeSetLS("theme_bg_color", hex);
    this.applyBgTheme(hex, settingsManager.isAdaptiveBg);

    colorsManager.updateColorSelectionUI("bg", hex, doScroll);
    colorsManager._syncPickerValues();
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
    if (activeBtn)
      activeBtn.classList.add("app-surface", "shadow-sm", "app-text");

    const isDark =
      mode === "dark" ||
      (mode === "system" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", isDark);
    document.documentElement.style.colorScheme = isDark ? "dark" : "light";

    this.applyBgTheme(colorsManager.currentBg, settingsManager.isAdaptiveBg);
    colorsManager.updateColorSelectionUI(
      "accent",
      colorsManager.currentAccent,
      false,
    );
    colorsManager.updateColorSelectionUI("bg", colorsManager.currentBg, false);
    colorsManager._syncPickerValues();

    if (useTransition) {
      requestAnimationFrame(() =>
        document.body.classList.remove("is-updating-theme"),
      );
    }
  },

  applyBgTheme(hex, isAdaptive) {
    const root = document.documentElement;
    const isDark = root.classList.contains("dark");
    document.body.classList.remove("force-light-text", "force-dark-text");
    root.classList.toggle("no-adaptive", !isAdaptive);

    if (hex === "default" || !isValidHex(hex)) {
      root.style.setProperty("--bg-color", "");
      root.style.setProperty("--surface-color", "");
      return;
    }

    const { r, g, b } = hexToRGB(hex);
    const { h, s, l } = hexToHSL(hex);

    if (!isAdaptive) {
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
  },

  syncSliderUIs() {
    settingsManager.syncSliderUIs();
  },
};
