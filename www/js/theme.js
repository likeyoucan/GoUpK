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
  currentAccent: "default", // Изначальное состояние - default
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
      // ++ ИСПРАВЛЕНО: Теперь просто сбрасываем на 'default' ++
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
    // ++ ИСПРАВЛЕНО: Теперь по умолчанию всегда 'default' ++
    this.currentAccent = safeGetLS("theme_color") || "default";
    this.currentBg = safeGetLS("theme_bg_color") || "default";
    this.currentMode = safeGetLS("theme_mode") || "system";

    colorManager.syncPickers(this.currentAccent, this.currentBg);

    this.setMode(this.currentMode, false);
    this.setColor(this.currentAccent, false);
    this.setBgColor(this.currentBg, false);
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

    // При смене темы нужно заново применить цвета, чтобы CSS подхватил правильные дефолты
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

  setColor(hex, doScroll = true) {
    this.currentAccent = hex;
    safeSetLS("theme_color", hex);

    if (hex === "default") {
      // Для основного цвета: сбрасываем, чтобы сработал CSS из :root.
      document.documentElement.style.removeProperty("--primary-color");
      document.documentElement.style.removeProperty("--accent-h");

      // Для цвета отдыха: принудительно ставим синий для стандартной темы.
      document.documentElement.style.setProperty(
        "--secondary-accent-color",
        "#3b82f6",
      );
    } else {
      // Для основного цвета: устанавливаем кастомный цвет.
      document.documentElement.style.setProperty("--primary-color", hex);
      const { h } = hexToHSL(hex);
      document.documentElement.style.setProperty("--accent-h", h);

      // Для цвета отдыха: убираем принудительную установку, позволяя CSS-адаптации работать.
      document.documentElement.style.removeProperty("--secondary-accent-color");
    }

    // ++ НАЧАЛО НОВОЙ ЛОГИКИ ДЛЯ "ОПАСНОГО" ЦВЕТА ++
    if (hex === "default") {
      // Если тема стандартная (зеленая), то стандартный красный подходит.
      // Убираем инлайновый стиль, чтобы сработало правило color-mix из CSS.
      document.documentElement.style.removeProperty("--destructive-color");
    } else {
      const { h: accentHue } = hexToHSL(hex);

      // Определяем "красную зону" оттенков (от розового до оранжево-красного)
      const isReddish = accentHue >= 335 || accentHue <= 20;

      if (isReddish) {
        // Если основной цвет красный, ПРИНУДИТЕЛЬНО ставим "опасный" цвет
        // на контрастный яркий оранжевый.
        document.documentElement.style.setProperty(
          "--destructive-color",
          "hsl(35, 100%, 58%)",
        ); // Пример: #ff992a
      } else {
        // Если основной цвет НЕ красный, убираем принудительную установку,
        // позволяя правилу color-mix из CSS создать приятный "тонированный" красный.
        document.documentElement.style.removeProperty("--destructive-color");
      }
    }

    // ++ ИСПРАВЛЕНО: Главная логика для 'default' ++
    if (hex === "default") {
      // Сбрасываем инлайновый стиль, чтобы сработал CSS из :root или :root.dark
      document.documentElement.style.removeProperty("--primary-color");
      document.documentElement.style.removeProperty("--accent-h");
    } else {
      // Устанавливаем кастомный цвет
      document.documentElement.style.setProperty("--primary-color", hex);
      const { h } = hexToHSL(hex);
      document.documentElement.style.setProperty("--accent-h", h);
    }

    colorManager.updateSelectionUI("accent", hex, doScroll);
    colorManager.syncPickers(this.currentAccent, this.currentBg);
  },

  setBgColor(hex, doScroll = true) {
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
