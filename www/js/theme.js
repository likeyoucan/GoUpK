// Файл: www/js/theme.js (полная версия)

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

    window
      .matchMedia("(prefers-color-scheme: dark)")
      .addEventListener("change", () => {
        if (this.currentMode === "system") this.setMode("system");
      });

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

  applySettings() {
    // ++ ИЗМЕНЕНИЕ 1: Дефолт для акцента теперь "default" ++
    this.currentAccent = safeGetLS("theme_color") || "default";
    this.currentBg = safeGetLS("theme_bg_color") || "default";
    this.currentMode = safeGetLS("theme_mode") || "system";

    this.setMode(this.currentMode, false);
  },

  resetSettings() {
    safeRemoveLS("theme_mode");
    safeRemoveLS("theme_color");
    safeRemoveLS("theme_bg_color");

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

    // ++ ИЗМЕНЕНИЕ 2: Вызываем setColor и setBgColor для пересчета цветов и UI ++
    // Это ключевое исправление для синхронизации пикеров при смене темы.
    this.setColor(this.currentAccent, false);
    this.setBgColor(this.currentBg, false);

    if (useTransition) {
      requestAnimationFrame(() =>
        document.body.classList.remove("is-updating-theme"),
      );
    }
  },

  // ++ ИЗМЕНЕНИЕ 3: Функция теперь умеет разрешать 'default' в hex ++
  setColor(color, doScroll = true) {
    this.currentAccent = color;
    safeSetLS("theme_color", color);

    const resolvedColor =
      color === "default"
        ? THEME_DEFAULT_COLORS[this.getCurrentTheme()].accent
        : color;

    document.documentElement.style.setProperty(
      "--primary-color",
      resolvedColor,
    );
    const { h } = hexToHSL(resolvedColor);
    document.documentElement.style.setProperty("--accent-h", h);

    colorManager.updateSelectionUI("accent", color, doScroll);
    colorManager.syncPickers(this.currentAccent, this.currentBg);
  },

  setBgColor(color, doScroll = true) {
    this.currentBg = color;
    safeSetLS("theme_bg_color", color);

    this.applyBgTheme(color);

    colorManager.updateSelectionUI("bg", color, doScroll);
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
