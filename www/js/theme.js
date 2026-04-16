// Файл: js/theme.js

import { $, safeGetLS, safeSetLS, safeRemoveLS, showToast } from "./utils.js?v=VERSION";
import { t } from "./i18n.js?v=VERSION";
import { sm } from "./sound.js?v=VERSION";

// [ИЗМЕНЕНИЕ 4] Лимит на кастомные цвета
const MAX_CUSTOM_COLORS = 50;

export const themeManager = {
  // --- Свойства ---
  currentMode: "system",
  currentBg: "default",
  showMs: true,
  isAdaptiveBg: true,
  hasVignette: false,
  isLiquidGlass: false,
  hideNavLabels: false,
  vignetteAlpha: 0.5,
  // [ИЗМЕНЕНИЕ 2] Карта значений для слайдера виньетки (5 шагов)
  vignetteLevels: [0, 0.25, 0.5, 0.75, 1],
  ringWidth: 4,
  swMinuteBeep: true,

  standardAccentColors: ["#22c55e", "#3b82f6", "#a855f7", "#ec4899", "#f97316", "#ef4444", "#6366f1", "#e11d48"],
  standardBgColors: ["default", "#60a5fa", "#c084fc", "#f472b6", "#34d399", "#facc15", "#f87171", "#2dd4bf"],
  customAccentColors: [],
  customBgColors: [],

  // --- [ИЗМЕНЕНИЕ 1] Внутренние вспомогательные функции для управления UI ---

  _createColorButtonEl(color, isCustom) {
    const wrapper = document.createElement("div");
    // Оболочка нужна для правильной работы focus ring offset
    wrapper.className = "custom-color-wrapper shrink-0 rounded-full";
    wrapper.dataset.color = color;
    wrapper.dataset.custom = isCustom;

    const button = document.createElement("button");
    button.type = "button";
    button.className =
      "color-btn w-9 h-9 flex items-center justify-center rounded-full shrink-0 transition-transform active:scale-90 border border-black/20 dark:border-white/20 focus:outline-none custom-focus";
    
    if (color === "default") {
        button.classList.add("default-bg-btn");
        // Специальный стиль для кнопки "по умолчанию", чтобы она была видна на любом фоне
        button.style.background = 'conic-gradient(from 90deg at 1px 1px,#0000 90deg,var(--border-color) 0) 0 0/50% 50% repeat-x, conic-gradient(from 90deg at 1px 1px,#0000 90deg,var(--border-color) 0) 100% 100%/50% 50% repeat-x';
    } else {
        button.style.backgroundColor = color;
    }

    wrapper.appendChild(button);
    return wrapper;
  },

  updateActionSlot(type, hex) {
    const isAccent = type === "accent";
    const actionSlot = $(isAccent ? "accent-action-slot" : "bg-action-slot");
    if (!actionSlot) return;
    actionSlot.innerHTML = ""; // Очищаем слот

    const allStandard = isAccent ? this.standardAccentColors : this.standardBgColors;
    const allCustom = isAccent ? this.customAccentColors : this.customBgColors;
    const isCustom = allCustom.includes(hex);
    const isStandard = allStandard.includes(hex);
    const isKnown = isCustom || isStandard || hex === 'default';

    if (isCustom) {
      actionSlot.innerHTML = `<button type="button" data-action="delete" aria-label="${t('delete')}" class="w-9 h-9 flex items-center justify-center rounded-full shrink-0 transition-transform active:scale-90 bg-red-500/10 text-red-500 hover:bg-red-500/20 focus:outline-none custom-focus">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 12h-15"></path></svg>
      </button>`;
    } else if (!isKnown && hex.startsWith("#")) {
      actionSlot.innerHTML = `<button type="button" data-action="add" aria-label="${t('add_color')}" class="w-9 h-9 flex items-center justify-center rounded-full shrink-0 transition-transform active:scale-90 bg-green-500/10 text-green-500 hover:bg-green-500/20 focus:outline-none custom-focus">
         <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"></path></svg>
       </button>`;
    }
  },

  updateButtonsAndSlot(type, hex) {
    const isAccent = type === "accent";
    const container = $(isAccent ? "accent-colors-container" : "bg-colors-container");
    if (!container) return;

    // Сбрасываем стили у всех кнопок и color-picker
    container.querySelectorAll(".custom-color-wrapper, .relative").forEach((el) => {
      el.classList.remove("ring-[var(--primary-color)]", "ring-2", "ring-offset-2", "ring-offset-surface", "shadow-lg");
      // Очищаем галочки
      if (el.classList.contains('custom-color-wrapper')) {
        el.querySelector("button").innerHTML = "";
      }
    });

    const activeWrapper = container.querySelector(`.custom-color-wrapper[data-color="${hex}"]`);

    if (activeWrapper) {
      // Выделяем активную кнопку
      activeWrapper.classList.add("ring-[var(--primary-color)]", "ring-2", "ring-offset-2", "ring-offset-surface", "shadow-lg");
      const button = activeWrapper.querySelector("button");
      let lum = 0.5; // Значение по умолчанию для 'default'
      if (hex !== 'default') {
        lum = this.getLuminance(...Object.values(this.hexToRGB(hex)));
      }
      const iconColor = lum > 0.4 ? "black" : "white";
      button.innerHTML = `<svg focusable="false" aria-hidden="true" class="w-5 h-5" style="color: ${iconColor};" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4.5 12.75l6 6 9-13.5"></path></svg>`;
    } else {
      // Если активный цвет не найден среди кнопок (т.е. он из color picker), выделяем color picker
      const pickerWrapper = container.querySelector('input[type="color"]')?.closest(".relative");
      if (pickerWrapper) {
        pickerWrapper.classList.add("ring-[var(--primary-color)]", "ring-2", "ring-offset-2", "ring-offset-surface", "shadow-lg");
      }
    }

    // Обновляем кнопку действия (+/-)
    this.updateActionSlot(type, hex);
  },

  updateSliderLabel(sliderId, labelsContainerId, numSteps, customLabels = null) {
    const slider = $(sliderId);
    const container = $(labelsContainerId);
    if (!slider || !container) return;

    // Если метки ещё не созданы, создаём их
    if (container.children.length === 0 || customLabels) {
      const i18nKeys = Array.from(container.children).map(child => child.dataset.i18n);
      container.innerHTML = ""; // Очищаем на случай повторного вызова
      for (let i = 0; i < numSteps; i++) {
        const label = document.createElement("span");
        if (customLabels) {
            label.textContent = customLabels[i];
        } else {
            label.dataset.i18n = i18nKeys[i] || "";
            label.textContent = t(label.dataset.i18n);
        }
        label.style.left = `${(i / (numSteps - 1)) * 100}%`;
        container.appendChild(label);
      }
    }

    // Обновляем активную метку
    const allLabels = container.querySelectorAll("span");
    const currentIndex = parseInt(slider.value, 10);
    allLabels.forEach((label, index) => {
        const isActive = index === currentIndex;
        label.classList.toggle("is-active", isActive);
        // Делаем неактивные метки полностью невидимыми, чтобы не было "прыжков"
        label.classList.toggle("opacity-0", !isActive);
    });
  },


  // --- Основные и публичные методы ---

  init() {
    this.applySettings();
    this.bindEvents();
  },

  applySettings() {
    try {
      this.customAccentColors = JSON.parse(safeGetLS("custom_accent_colors")) || [];
      this.customBgColors = JSON.parse(safeGetLS("custom_bg_colors")) || [];
    } catch (e) {
      this.customAccentColors = [];
      this.customBgColors = [];
    }

    this.renderColorSection("accent");
    this.renderColorSection("bg");

    this._internalSetMode(safeGetLS("theme_mode") || "system", false);

    this.setColor(safeGetLS("theme_color") || "#22c55e");
    this.isAdaptiveBg = safeGetLS("app_adaptive_bg") !== "false";
    this.hasVignette = safeGetLS("app_vignette") === "true";
    this.isLiquidGlass = safeGetLS("app_liquid_glass") === "true";
    this.hideNavLabels = safeGetLS("app_hide_nav_labels") === "true";
    this.vignetteAlpha = parseFloat(safeGetLS("app_vignette_alpha")) || 0.5;
    this.showMs = safeGetLS("app_show_ms") !== "false";
    this.swMinuteBeep = safeGetLS("app_sw_minute_beep") !== "false";

    this.updateAdaptiveClass();
    this.setBgColor(safeGetLS("theme_bg_color") || "default");
    this.setFontSize(safeGetLS("font_size") || 16);
    this.setRingWidth(safeGetLS("app_ring_width") || 4);
    this.applyNavLabelsVisibility();
    this.updateGlass();
    this.updateVignette();

    if ($("toggle-adaptive-bg")) $("toggle-adaptive-bg").checked = this.isAdaptiveBg;
    if ($("toggle-glass")) $("toggle-glass").checked = this.isLiquidGlass;
    if ($("toggle-vignette")) $("toggle-vignette").checked = this.hasVignette;
    if ($("toggle-nav-labels")) $("toggle-nav-labels").checked = this.hideNavLabels;
    if ($("toggle-ms")) $("toggle-ms").checked = this.showMs;
    if ($("toggle-sw-minute-beep")) $("toggle-sw-minute-beep").checked = this.swMinuteBeep;

    // [ИЗМЕНЕНИЕ 2] Применение настроек для слайдера виньетки
    if ($("vignetteSlider")) {
      const closestIndex = this.vignetteLevels.reduce((prev, curr, index) => 
        (Math.abs(curr - this.vignetteAlpha) < Math.abs(this.vignetteLevels[prev] - this.vignetteAlpha) ? index : prev), 0);
      $("vignetteSlider").value = closestIndex;
      this.updateSliderLabel("vignetteSlider", "vignette-labels", 5);
    }
    
    if ($("vibroSlider")) {
      const levels = [0.5, 0.75, 1, 1.5, 2];
      const vibroValue = parseFloat(safeGetLS("app_vibro_level")) || 1;
      const closestIndex = levels.reduce((prev, curr, index) => 
          Math.abs(curr - vibroValue) < Math.abs(levels[prev] - vibroValue) ? index : prev, 0);
      $("vibroSlider").value = closestIndex;
      this.updateSliderLabel("vibroSlider", "vibro-labels", 5);
    }

    if ($("fontSlider")) $("fontSlider").value = safeGetLS("font_size") || 16;
    if ($("ringWidthSlider")) $("ringWidthSlider").value = safeGetLS("app_ring_width") || 4;
  },

  bindEvents() {
    $("toggle-sw-minute-beep")?.addEventListener("change", (e) => { this.swMinuteBeep = e.target.checked; safeSetLS("app_sw_minute_beep", this.swMinuteBeep); });
    $("toggle-ms")?.addEventListener("change", (e) => { this.showMs = e.target.checked; safeSetLS("app_show_ms", this.showMs); document.dispatchEvent(new CustomEvent("msChanged")); });
    $("toggle-adaptive-bg")?.addEventListener("change", (e) => { this.isAdaptiveBg = e.target.checked; safeSetLS("app_adaptive_bg", this.isAdaptiveBg); this.updateAdaptiveClass(); this.applyBgTheme(this.currentBg, document.documentElement.classList.contains("dark")); });
    $("toggle-glass")?.addEventListener("change", (e) => { this.isLiquidGlass = e.target.checked; safeSetLS("app_liquid_glass", this.isLiquidGlass); this.updateGlass(); });
    $("toggle-vignette")?.addEventListener("change", (e) => { this.hasVignette = e.target.checked; safeSetLS("app_vignette", this.hasVignette); this.updateVignette(); });
    $("toggle-nav-labels")?.addEventListener("change", (e) => { this.hideNavLabels = e.target.checked; safeSetLS("app_hide_nav_labels", this.hideNavLabels); this.applyNavLabelsVisibility(); });

    // [ИЗМЕНЕНИЕ 2] Обновление обработчика слайдера виньетки
    $("vignetteSlider")?.addEventListener("input", (e) => {
      sm.vibrate(10, "tactile");
      this.vignetteAlpha = this.vignetteLevels[e.target.value];
      this.updateVignette();
      this.updateSliderLabel("vignetteSlider", "vignette-labels", 5);
    });
    $("vignetteSlider")?.addEventListener("change", () => safeSetLS("app_vignette_alpha", this.vignetteAlpha));

    $("fontSlider")?.addEventListener("input", (e) => { sm.vibrate(10, "tactile"); this.setFontSize(e.target.value); });
    $("ringWidthSlider")?.addEventListener("input", (e) => { sm.vibrate(10, "tactile"); this.setRingWidth(e.target.value); });
    
    $("vibroSlider")?.addEventListener("input", () => this.updateSliderLabel("vibroSlider", "vibro-labels", 5));
    $("vibroSlider")?.addEventListener("change", (e) => {
      const levels = [0.5, 0.75, 1, 1.5, 2];
      sm.vibroLevel = levels[e.target.value] || 1;
      safeSetLS("app_vibro_level", sm.vibroLevel);
      sm.vibrate(50, "strong");
    });

    document.querySelectorAll('[id^="theme-"]').forEach((btn) => btn.addEventListener("click", (e) => this.setMode(e.currentTarget.getAttribute("data-theme-mode"))));

    document.body.addEventListener("click", (e) => {
      if (e.target.closest("#accent-colors-container")) this.handleColorClick(e, "accent");
      if (e.target.closest("#bg-colors-container")) this.handleColorClick(e, "bg");
    });

    document.body.addEventListener("input", (e) => {
      if (e.target.id === "customColorInput") this.setColor(e.target.value);
      if (e.target.id === "customBgInput") this.setBgColor(e.target.value);
    });

    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
      if (this.currentMode === "system") this.setMode("system");
    });
  },

  setMode(mode) {
    this._internalSetMode(mode, true);
  },

  _internalSetMode(mode, useTransitionDisable) {
    if (useTransitionDisable) document.body.classList.add("theme-transition-disable");
    this.currentMode = mode;
    safeSetLS("theme_mode", mode);
    document.querySelectorAll('[id^="theme-"]').forEach((b) => { b.classList.remove("app-surface", "shadow-sm", "app-text"); b.classList.add("app-text-sec"); });
    const activeBtn = $(`theme-${mode}`);
    if (activeBtn) { activeBtn.classList.remove("app-text-sec"); activeBtn.classList.add("app-surface", "shadow-sm", "app-text"); }
    const isDark = mode === "dark" || (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", isDark);
    document.documentElement.style.colorScheme = isDark ? "dark" : "light";
    this.applyBgTheme(this.currentBg, isDark);
    this.renderColorSection("bg");
    if (useTransitionDisable) requestAnimationFrame(() => document.body.classList.remove("theme-transition-disable"));
  },

  handleColorClick(event, type) {
    const target = event.target;
    const isAccent = type === "accent";

    const colorWrapper = target.closest(".custom-color-wrapper");
    if (colorWrapper) {
        sm.vibrate(20, 'light');
        isAccent ? this.setColor(colorWrapper.dataset.color) : this.setBgColor(colorWrapper.dataset.color);
        return;
    }

    const actionBtn = target.closest(`#${isAccent ? 'accent' : 'bg'}-action-slot button`);
    if (actionBtn) {
        sm.vibrate(40, 'medium');
        const action = actionBtn.dataset.action;
        const activeColor = safeGetLS(isAccent ? 'theme_color' : 'theme_bg_color');

        if (action === 'delete') {
            const newActiveColor = this.deleteCustomColor(type, activeColor);
            this.renderColorSection(type); // Перерисовываем, чтобы кнопка пропала
            if (newActiveColor) { // Если удалили активный, ставим новый
                isAccent ? this.setColor(newActiveColor) : this.setBgColor(newActiveColor);
            }
        } else if (action === 'add') {
            this.addCustomColor(type, activeColor);
        }
    }
  },

  deleteCustomColor(type, color) {
    const isAccent = type === 'accent';
    let customColors = isAccent ? this.customAccentColors : this.customBgColors;
    const key = isAccent ? 'custom_accent_colors' : 'custom_bg_colors';

    const index = customColors.indexOf(color);
    if (index > -1) {
        customColors.splice(index, 1);
        if (isAccent) this.customAccentColors = customColors;
        else this.customBgColors = customColors;
        safeSetLS(key, JSON.stringify(customColors));

        // Если удалили активный цвет, переключаемся на стандартный
        if (safeGetLS(isAccent ? 'theme_color' : 'theme_bg_color') === color) {
            return isAccent ? this.standardAccentColors[0] : 'default';
        }
    }
    return null;
  },

  renderColorSection(type) {
    const isAccent = type === "accent";
    const container = $(isAccent ? "accent-colors-container" : "bg-colors-container");
    if (!container) return;

    // Удаляем все, кроме слота для кнопки действия
    container.querySelectorAll(':scope > *:not([id$="-action-slot"])').forEach(el => el.remove());

    const standardColors = isAccent ? this.standardAccentColors : this.standardBgColors;
    const customColors = isAccent ? this.customAccentColors : this.customBgColors;
    const fragment = document.createDocumentFragment();

    [...standardColors, ...customColors].forEach(color => {
        const isCustom = customColors.includes(color);
        fragment.appendChild(this._createColorButtonEl(color, isCustom));
    });

    const pickerId = isAccent ? "customColorInput" : "customBgInput";
    const pickerHTML = `<div class="relative w-9 h-9 shrink-0 group rounded-full overflow-hidden border border-black/20 dark:border-white/20 transition-transform active:scale-90 focus-within:ring-2 focus-within:ring-[var(--primary-color)] focus-within:ring-offset-2 focus-within:ring-offset-surface">
        <div class="absolute inset-0 bg-[conic-gradient(from_0deg,red,orange,yellow,green,blue,indigo,violet,red)] opacity-90 group-hover:opacity-100 transition-opacity pointer-events-none z-0"></div>
        <input type="color" id="${pickerId}" aria-label="${t('add_color')}" class="absolute inset-0 w-[150%] h-[150%] -top-1 -left-1 opacity-0 cursor-pointer z-10" />
    </div>`;
    
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = pickerHTML;
    fragment.appendChild(tempDiv.firstChild);

    container.appendChild(fragment);
    
    const activeColor = safeGetLS(isAccent ? 'theme_color' : 'theme_bg_color') || (isAccent ? this.standardAccentColors[0] : 'default');
    this.updateButtonsAndSlot(type, activeColor);
  },

  addCustomColor(type, color) {
    const isAccent = type === 'accent';
    const customColors = isAccent ? this.customAccentColors : this.customBgColors;

    // [ИЗМЕНЕНИЕ 4] Проверка лимита
    if (customColors.length >= MAX_CUSTOM_COLORS) {
        showToast(isAccent ? t('accent_limit_msg') : t('bg_limit_msg'));
        return;
    }

    const allColors = [...(isAccent ? this.standardAccentColors : this.standardBgColors), ...customColors];

    if (!allColors.includes(color)) {
        customColors.push(color);
        const key = isAccent ? 'custom_accent_colors' : 'custom_bg_colors';
        safeSetLS(key, JSON.stringify(customColors));
        this.renderColorSection(type);
        isAccent ? this.setColor(color) : this.setBgColor(color);
    }
  },

  setColor(hex) {
    safeSetLS("theme_color", hex);
    document.documentElement.style.setProperty("--primary-color", hex);
    const { h } = this.hexToHSL(hex);
    document.documentElement.style.setProperty("--accent-h", h);
    this.updateButtonsAndSlot("accent", hex);
  },

  setBgColor(hex) {
    this.currentBg = hex;
    safeSetLS("theme_bg_color", hex);
    const isDark = document.documentElement.classList.contains("dark");
    this.applyBgTheme(hex, isDark);
    this.updateButtonsAndSlot("bg", hex);
  },

  resetSettings() {
    const themeKeys = ["theme_mode", "theme_color", "theme_bg_color", "font_size", "app_adaptive_bg", "app_vignette", "app_vignette_alpha", "app_liquid_glass", "app_hide_nav_labels", "app_ring_width", "app_show_ms", "app_sw_minute_beep", "custom_accent_colors", "custom_bg_colors"];
    themeKeys.forEach(safeRemoveLS);
    this.applySettings();
  },

  applyBgTheme(hex, isDark) {
    const root = document.documentElement;
    document.body.classList.remove("force-light-text", "force-dark-text");
    if (hex === "default") {
      if (!this.isAdaptiveBg) {
        root.style.setProperty("--bg-color", isDark ? "#000000" : "#f3f4f6");
        root.style.setProperty("--surface-color", isDark ? "#1c1c1e" : "#ffffff");
      } else {
        root.style.removeProperty("--bg-color");
        root.style.removeProperty("--surface-color");
      }
      return;
    }
    const rgb = this.hexToRGB(hex);
    const { h, s, l } = this.hexToHSL(hex);
    if (!this.isAdaptiveBg) {
      root.style.setProperty("--bg-color", hex);
      if (isDark) {
        root.style.setProperty("--surface-color", `color-mix(in srgb, ${hex}, white 10%)`);
      } else {
        const mixArg = l > 90 ? "black 5%" : "white 25%";
        root.style.setProperty("--surface-color", `color-mix(in srgb, ${hex}, ${mixArg})`);
      }
      const luminance = this.getLuminance(rgb.r, rgb.g, rgb.b);
      document.body.classList.toggle("force-light-text", luminance < 0.48);
      document.body.classList.toggle("force-dark-text", luminance >= 0.48);
    } else {
      const satDark = Math.min(s, 40);
      const satLight = Math.max(s, 20);
      if (isDark) {
        root.style.setProperty("--bg-color", `hsl(${h} ${satDark}% 8%)`);
        root.style.setProperty("--surface-color", `hsl(${h} ${satDark}% 14%)`);
      } else {
        root.style.setProperty("--bg-color", `hsl(${h} ${satLight}% 94%)`);
        root.style.setProperty("--surface-color", `hsl(${h} ${satLight}% 98%)`);
      }
    }
  },
  getLuminance(r, g, b) {
    const a = [r, g, b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
  },
  updateVignette() {
    const bg = document.querySelector(".app-bg");
    if (!bg) return;
    const c = $("vignette-depth-container");
    if (c) {
      c.classList.toggle("hidden", !this.hasVignette);
      c.classList.toggle("flex", this.hasVignette);
    }
    if (this.hasVignette) {
      bg.classList.add("has-vignette");
      document.documentElement.style.setProperty("--vignette-alpha", this.vignetteAlpha * 0.4);
    } else {
      bg.classList.remove("has-vignette");
    }
  },
  updateGlass() { document.documentElement.classList.toggle("glass-effect", this.isLiquidGlass); },
  updateAdaptiveClass() { document.documentElement.classList.toggle("no-adaptive", !this.isAdaptiveBg); },
  hexToRGB(H) {
    if (!H || !H.startsWith("#")) return { r: 0, g: 0, b: 0 };
    let r = 0, g = 0, b = 0;
    if (H.length == 4) { r = parseInt(H[1] + H[1], 16); g = parseInt(H[2] + H[2], 16); b = parseInt(H[3] + H[3], 16); } 
    else if (H.length == 7) { r = parseInt(H[1] + H[2], 16); g = parseInt(H[3] + H[4], 16); b = parseInt(H[5] + H[6], 16); }
    return { r, g, b };
  },
  hexToHSL(H) {
    if (!H || !H.startsWith("#")) return { h: 142, s: 50, l: 50 };
    const { r: r255, g: g255, b: b255 } = this.hexToRGB(H);
    let r = r255 / 255, g = g255 / 255, b = b255 / 255;
    let cmin = Math.min(r, g, b), cmax = Math.max(r, g, b), delta = cmax - cmin;
    let h = 0, s = 0, l = (cmax + cmin) / 2;
    if (delta !== 0) {
      s = delta / (1 - Math.abs(2 * l - 1));
      if (cmax === r) h = ((g - b) / delta) % 6;
      else if (cmax === g) h = (b - r) / delta + 2;
      else h = (r - g) / delta + 4;
    }
    h = Math.round(h * 60);
    if (h < 0) h += 360;
    return { h, s: +(s * 100).toFixed(1), l: +(l * 100).toFixed(1) };
  },
  setFontSize(s) {
    const n = Number(s);
    const c = n / 16;
    document.documentElement.style.setProperty("--font-scale", c);
    if ($("fontSizeDisplay")) $("fontSizeDisplay").textContent = n + " px";
    safeSetLS("font_size", n);
  },
  applyNavLabelsVisibility() { document.body.classList.toggle("hide-nav-labels", this.hideNavLabels); },
  setRingWidth(w) {
    const n = Number(w);
    this.ringWidth = n;
    document.documentElement.style.setProperty("--ring-stroke-width", n);
    if ($("ringWidthDisplay")) { $("ringWidthDisplay").textContent = `${n.toFixed(1)} px`; }
    safeSetLS("app_ring_width", n);
  },
};