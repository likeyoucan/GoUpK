// Файл: www/js/theme.js

import { $, safeGetLS, safeSetLS, safeRemoveLS } from "./utils.js?v=VERSION";
import { t } from "./i18n.js?v=VERSION";
import { sm } from "./sound.js?v=VERSION";

export const themeManager = {
  // Свойства состояния
  currentMode: "system",
  currentBg: "default",
  showMs: true,
  isAdaptiveBg: true,
  hasVignette: false,
  isLiquidGlass: false,
  hideNavLabels: false,
  vignetteAlpha: 0.5,
  ringWidth: 4,
  swMinuteBeep: true, // [ИЗМЕНЕНИЕ 1] Новое свойство

  // [ИЗМЕНЕНИЕ 3] Свойства для управления цветами
  standardAccentColors: [
    "#22c55e", "#3b82f6", "#a855f7", "#ec4899",
    "#f97316", "#ef4444", "#6366f1", "#e11d48",
  ],
  standardBgColors: [
    "default", "#60a5fa", "#c084fc", "#f472b6",
    "#34d399", "#facc15", "#f87171", "#2dd4bf",
  ],
  customAccentColors: [],
  customBgColors: [],

  // Ссылки на DOM-элементы
  themeBtns: [],

  init() {
    this.themeBtns = document.querySelectorAll('[id^="theme-"]');

    // Нативная интеграция (Material You)
    if (window.Capacitor && window.Capacitor.isNativePlatform()) {
      const { MaterialYou } = window.Capacitor.Plugins;
      if (MaterialYou) {
        MaterialYou.isSupported()
          .then((result) => {
            if (result.isSupported) {
              MaterialYou.addListener("colorColorsChanged", (colors) => {
                this.applyMaterialYouColors(colors);
              });
              MaterialYou.getColors()
                .then((colors) => this.applyMaterialYouColors(colors))
                .catch(() => {});
            }
          })
          .catch(() => {});
      }
    }

    this.applySettings();

    // --- ОБРАБОТЧИКИ СОБЫТИЙ ---

    // [ИЗМЕНЕНИЕ 1] Обработчик для ежеминутного сигнала
    $("toggle-sw-minute-beep")?.addEventListener("change", (e) => {
      this.swMinuteBeep = e.target.checked;
      safeSetLS("app_sw_minute_beep", this.swMinuteBeep);
    });

    $("toggle-ms")?.addEventListener("change", (e) => {
      this.showMs = e.target.checked;
      safeSetLS("app_show_ms", this.showMs);
      document.dispatchEvent(
        new CustomEvent("msChanged", { detail: this.showMs }),
      );
    });

    $("toggle-adaptive-bg")?.addEventListener("change", (e) => {
      this.isAdaptiveBg = e.target.checked;
      safeSetLS("app_adaptive_bg", this.isAdaptiveBg);
      this.updateAdaptiveClass();
      this.applyBgTheme(
        this.currentBg,
        document.documentElement.classList.contains("dark"),
      );
    });

    $("toggle-glass")?.addEventListener("change", (e) => {
      this.isLiquidGlass = e.target.checked;
      safeSetLS("app_liquid_glass", this.isLiquidGlass);
      this.updateGlass();
    });

    $("toggle-vignette")?.addEventListener("change", (e) => {
      this.hasVignette = e.target.checked;
      safeSetLS("app_vignette", this.hasVignette);
      this.updateVignette();
    });

    $("toggle-nav-labels")?.addEventListener("change", (e) => {
      this.hideNavLabels = e.target.checked;
      safeSetLS("app_hide_nav_labels", this.hideNavLabels);
      this.applyNavLabelsVisibility();
    });

    // [ИЗМЕНЕНИЕ 2] Добавлена вибрация для слайдеров
    $("vignetteSlider")?.addEventListener("input", (e) => {
      sm.vibrate(10);
      this.vignetteAlpha = parseFloat(e.target.value);
      safeSetLS("app_vignette_alpha", this.vignetteAlpha);
      this.updateVignette();
    });

    $("fontSlider")?.addEventListener("input", (e) => {
      sm.vibrate(10);
      this.setFontSize(e.target.value);
    });

    $("ringWidthSlider")?.addEventListener("input", (e) => {
      sm.vibrate(10);
      this.setRingWidth(e.target.value);
    });

    this.themeBtns.forEach((btn) =>
      btn.addEventListener("click", (e) =>
        this.setMode(e.currentTarget.getAttribute("data-theme-mode")),
      ),
    );

    // [ИЗМЕНЕНИЕ 3] Обработчики для новых кастомных цветов
    $("customColorInput")?.addEventListener("input", (e) => {
      this.addCustomColor("accent", e.target.value);
    });
    $("customBgInput")?.addEventListener("input", (e) => {
      this.addCustomColor("bg", e.target.value);
    });

    window
      .matchMedia("(prefers-color-scheme: dark)")
      .addEventListener("change", () => {
        if (this.currentMode === "system") this.setMode("system");
      });
  },

  applySettings() {
    // [ИЗМЕНЕНИЕ 3] Загрузка и рендер кастомных цветов в первую очередь
    try {
      this.customAccentColors =
        JSON.parse(safeGetLS("custom_accent_colors")) || [];
      this.customBgColors = JSON.parse(safeGetLS("custom_bg_colors")) || [];
    } catch (e) {
      this.customAccentColors = [];
      this.customBgColors = [];
    }
    this.renderColorButtons("accent");
    this.renderColorButtons("bg");

    this.setMode(safeGetLS("theme_mode") || "system");
    this.setColor(safeGetLS("theme_color") || "#22c55e");
    this.isAdaptiveBg = safeGetLS("app_adaptive_bg") !== "false";
    this.hasVignette = safeGetLS("app_vignette") === "true";
    this.isLiquidGlass = safeGetLS("app_liquid_glass") === "true";
    this.hideNavLabels = safeGetLS("app_hide_nav_labels") === "true";
    this.vignetteAlpha = parseFloat(safeGetLS("app_vignette_alpha")) || 0.5;
    this.showMs = safeGetLS("app_show_ms") !== "false";
    this.swMinuteBeep = safeGetLS("app_sw_minute_beep") !== "false"; // [ИЗМЕНЕНИЕ 1]

    this.updateAdaptiveClass();
    this.setBgColor(safeGetLS("theme_bg_color") || "default");
    this.setFontSize(safeGetLS("font_size") || 16);
    this.setRingWidth(safeGetLS("app_ring_width") || 4);
    this.applyNavLabelsVisibility();

    this.updateGlass();
    this.updateVignette();

    // Обновление состояния переключателей
    if ($("toggle-adaptive-bg"))
      $("toggle-adaptive-bg").checked = this.isAdaptiveBg;
    if ($("toggle-glass")) $("toggle-glass").checked = this.isLiquidGlass;
    if ($("toggle-vignette")) $("toggle-vignette").checked = this.hasVignette;
    if ($("toggle-nav-labels"))
      $("toggle-nav-labels").checked = this.hideNavLabels;
    if ($("toggle-ms")) $("toggle-ms").checked = this.showMs;
    if ($("toggle-sw-minute-beep")) // [ИЗМЕНЕНИЕ 1]
      $("toggle-sw-minute-beep").checked = this.swMinuteBeep;
      
    // Обновление состояния слайдеров
    if ($("vignetteSlider")) $("vignetteSlider").value = this.vignetteAlpha;
    if ($("fontSlider")) $("fontSlider").value = safeGetLS("font_size") || 16;
    if ($("ringWidthSlider"))
      $("ringWidthSlider").value = safeGetLS("app_ring_width") || 4;
  },

  resetSettings() {
    const themeKeys = [
      "theme_mode", "theme_color", "theme_bg_color", "font_size",
      "app_adaptive_bg", "app_vignette", "app_vignette_alpha",
      "app_liquid_glass", "app_hide_nav_labels", "app_ring_width",
      "app_show_ms", "app_sw_minute_beep", // [ИЗМЕНЕНИЕ 1]
      // [ИЗМЕНЕНИЕ 3] Кастомные цвета НЕ удаляются при сбросе
    ];
    themeKeys.forEach(safeRemoveLS);
    this.applySettings();
  },

  updateAdaptiveClass() {
    document.documentElement.classList.toggle("no-adaptive", !this.isAdaptiveBg);
  },

  updateGlass() {
    document.documentElement.classList.toggle("glass-effect", this.isLiquidGlass);
  },

  updateVignette() {
    const bgElement = document.querySelector(".app-bg");
    const vignetteContainer = $("vignette-depth-container");
    if (!bgElement) return;

    if (vignetteContainer) {
      vignetteContainer.classList.toggle("hidden", !this.hasVignette);
      vignetteContainer.classList.toggle("flex", this.hasVignette);
    }

    bgElement.classList.toggle("has-vignette", this.hasVignette);
    if (this.hasVignette) {
      const visualAlpha = this.vignetteAlpha * 0.3;
      document.documentElement.style.setProperty("--vignette-alpha", visualAlpha);
    }
  },

  setMode(mode) {
    this.currentMode = mode;
    safeSetLS("theme_mode", mode);

    this.themeBtns.forEach((b) => {
      b.classList.remove("app-surface", "shadow-sm", "app-text");
      b.classList.add("app-text-sec");
    });
    const activeBtn = $(`theme-${mode}`);
    if (activeBtn) {
      activeBtn.classList.remove("app-text-sec");
      activeBtn.classList.add("app-surface", "shadow-sm", "app-text");
    }

    const isDark = mode === "dark" || (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", isDark);
    document.documentElement.style.colorScheme = isDark ? "dark" : "light";
    this.applyBgTheme(this.currentBg, isDark);
  },

  // --- [ИЗМЕНЕНИЕ 3] Новая система управления цветами ---

  setColor(hex) {
    safeSetLS("theme_color", hex);
    document.documentElement.style.setProperty("--primary-color", hex);
    const { h } = this.hexToHSL(hex);
    document.documentElement.style.setProperty("--accent-h", h);
    this.updateSelectedColor("accent", hex);
  },

  setBgColor(hex) {
    this.currentBg = hex;
    safeSetLS("theme_bg_color", hex);
    const isDark = document.documentElement.classList.contains("dark");
    this.applyBgTheme(hex, isDark);
    this.updateSelectedColor("bg", hex);
  },

  renderColorButtons(type) {
    const isAccent = type === "accent";
    const container = $(isAccent ? "accent-colors-container" : "bg-colors-container");
    const standardColors = isAccent ? this.standardAccentColors : this.standardBgColors;
    const customColors = isAccent ? this.customAccentColors : this.customBgColors;
    
    if (!container) return;
    container.innerHTML = ""; // Очищаем

    const allColors = [...standardColors, ...customColors];
    allColors.forEach(color => {
        const isCustom = customColors.includes(color);
        container.insertAdjacentHTML('beforeend', this._createColorButtonHTML(color, type, isCustom));
    });

    // Добавляем кнопку "+"
    const addBtnHTML = `
      <button type="button" aria-label="${t("add_color")}" 
              class="add-color-btn w-9 h-9 flex items-center justify-center rounded-full shrink-0 transition-transform active:scale-90 border-2 border-dashed app-border app-text-sec hover:bg-black/5 dark:hover:bg-white/5 focus:outline-none custom-focus"
              data-type="${type}">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"></path></svg>
      </button>`;
    container.insertAdjacentHTML("beforeend", addBtnHTML);

    // Назначаем обработчики
    container.querySelectorAll(".color-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const color = btn.dataset.color;
            isAccent ? this.setColor(color) : this.setBgColor(color);
        });
    });
    container.querySelectorAll(".delete-color-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const color = btn.dataset.color;
            this.deleteCustomColor(type, color);
        });
    });
    container.querySelector(".add-color-btn")?.addEventListener("click", () => {
        const inputId = isAccent ? "customColorInput" : "customBgInput";
        $(inputId)?.click();
    });

    // Обновляем выделение
    const activeColor = safeGetLS(isAccent ? "theme_color" : "theme_bg_color");
    if (activeColor) this.updateSelectedColor(type, activeColor);
  },

  _createColorButtonHTML(color, type, isCustom) {
    const isDark = document.documentElement.classList.contains('dark');
    const defaultBgColor = isDark ? '#1c1c1e' : '#f3f4f6';
    const bgStyle = color === 'default' ? `background-color: ${defaultBgColor};` : `background-color: ${color};`;
    
    const deleteBtn = isCustom ? `<button type="button" data-color="${color}" class="delete-color-btn absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs font-bold shadow-md opacity-0 group-hover:opacity-100 transition-opacity z-10">×</button>` : '';

    return `
      <div class="relative group">
        <button type="button" aria-label="Color ${color}" data-color="${color}"
                style="${bgStyle}"
                class="color-btn w-9 h-9 flex items-center justify-center rounded-full shrink-0 transition-transform active:scale-90 border border-black/20 dark:border-white/20 focus:outline-none custom-focus">
        </button>
        ${deleteBtn}
      </div>`;
  },
  
  updateSelectedColor(type, selectedColor) {
    const container = $(type === "accent" ? "accent-colors-container" : "bg-colors-container");
    container?.querySelectorAll(".color-btn").forEach(btn => {
        const isSelected = btn.dataset.color === selectedColor;
        btn.innerHTML = isSelected ? `<svg class="w-5 h-5 text-white mix-blend-difference" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path></svg>` : '';
    });
  },

  addCustomColor(type, color) {
    const isAccent = type === "accent";
    const customColors = isAccent ? this.customAccentColors : this.customBgColors;
    const standardColors = isAccent ? this.standardAccentColors : this.standardBgColors;

    if (!customColors.includes(color) && !standardColors.includes(color) && color !== "default") {
        customColors.push(color);
        const key = isAccent ? "custom_accent_colors" : "custom_bg_colors";
        safeSetLS(key, JSON.stringify(customColors));
        this.renderColorButtons(type);
        isAccent ? this.setColor(color) : this.setBgColor(color);
    }
  },

  deleteCustomColor(type, color) {
    const isAccent = type === "accent";
    let customColors = isAccent ? this.customAccentColors : this.customBgColors;
    const key = isAccent ? "custom_accent_colors" : "custom_bg_colors";

    customColors = customColors.filter(c => c !== color);
    if(isAccent) this.customAccentColors = customColors;
    else this.customBgColors = customColors;

    safeSetLS(key, JSON.stringify(customColors));

    // Если удалили активный цвет, сбрасываем на дефолтный
    if (safeGetLS(isAccent ? 'theme_color' : 'theme_bg_color') === color) {
      if (isAccent) this.setColor(this.standardAccentColors[0]);
      else this.setBgColor('default');
    }
    
    this.renderColorButtons(type);
  },

  // --- Вспомогательные функции ---

  applyBgTheme(hex, isDark) {
    const root = document.documentElement;
    document.body.classList.remove("force-light-text", "force-dark-text");

    if (hex === "default") {
      root.style.removeProperty("--bg-color");
      root.style.removeProperty("--surface-color");
      return;
    }

    const rgb = this.hexToRGB(hex);
    const { h, s, l } = this.hexToHSL(hex);

    if (!this.isAdaptiveBg) {
      root.style.setProperty("--bg-color", hex);
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

  hexToRGB(H) {
    if (!H || !H.startsWith("#")) return { r: 0, g: 0, b: 0 };
    let r = 0, g = 0, b = 0;
    if (H.length === 4) {
      r = parseInt(H[1] + H[1], 16);
      g = parseInt(H[2] + H[2], 16);
      b = parseInt(H[3] + H[3], 16);
    } else if (H.length === 7) {
      r = parseInt(H[1] + H[2], 16);
      g = parseInt(H[3] + H[4], 16);
      b = parseInt(H[5] + H[6], 16);
    }
    return { r, g, b };
  },

  getLuminance(r, g, b) {
    const a = [r, g, b].map(v => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
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

  setFontSize(size) {
    const numSize = Number(size);
    const scale = numSize / 16;
    document.documentElement.style.setProperty("--font-scale", scale);
    if ($("fontSizeDisplay")) $("fontSizeDisplay").textContent = numSize + " px";
    safeSetLS("font_size", numSize);
  },

  applyNavLabelsVisibility() {
    document.body.classList.toggle("hide-nav-labels", this.hideNavLabels);
  },

  setRingWidth(width) {
    const numWidth = Number(width);
    this.ringWidth = numWidth;
    document.documentElement.style.setProperty("--ring-stroke-width", numWidth);
    if ($("ringWidthDisplay")) $("ringWidthDisplay").textContent = `${numWidth.toFixed(1)} px`;
    safeSetLS("app_ring_width", numWidth);
  },

  applyMaterialYouColors(colors) {
    const storedColor = safeGetLS("theme_color");
    if (storedColor && storedColor !== "auto") return;
    const primaryColor = colors.system_accent1_500;
    if (primaryColor) {
      this.setColor(primaryColor);
    }
  },
};