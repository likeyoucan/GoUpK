// theme.js

import { $, safeGetLS, safeSetLS } from "./utils.js";

export const themeManager = {
  currentMode: "system",
  currentBg: "default",
  showMs: true,
  isAdaptiveBg: true,
  hasVignette: false,
  isLiquidGlass: false,
  vignetteAlpha: 0.5,
  themeBtns: [],
  colorBtns: [],
  bgBtns: [],

  init() {
    this.themeBtns = document.querySelectorAll('[id^="theme-"]');
    this.colorBtns = document.querySelectorAll(".color-btn");
    this.bgBtns = document.querySelectorAll(".bg-btn");

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
                .then((colors) => {
                  this.applyMaterialYouColors(colors);
                })
                .catch(() => {});
            }
          })
          .catch(() => {});
      }
    }

    this.applySettings();

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

    $("vignetteSlider")?.addEventListener("input", (e) => {
      this.vignetteAlpha = parseFloat(e.target.value);
      safeSetLS("app_vignette_alpha", this.vignetteAlpha);
      this.updateVignette();
    });

    $("fontSlider")?.addEventListener("input", (e) =>
      this.setFontSize(e.target.value),
    );

    this.themeBtns.forEach((btn) =>
      btn.addEventListener("click", (e) =>
        this.setMode(e.currentTarget.getAttribute("data-theme-mode")),
      ),
    );
    this.colorBtns.forEach((btn) =>
      btn.addEventListener("click", (e) =>
        this.setColor(e.currentTarget.getAttribute("data-color")),
      ),
    );
    this.bgBtns.forEach((btn) =>
      btn.addEventListener("click", (e) =>
        this.setBgColor(e.currentTarget.getAttribute("data-bg")),
      ),
    );

    $("customColorInput")?.addEventListener("input", (e) =>
      this.setColor(e.target.value),
    );
    $("customBgInput")?.addEventListener("input", (e) =>
      this.setBgColor(e.target.value),
    );

    window
      .matchMedia("(prefers-color-scheme: dark)")
      .addEventListener("change", () => {
        if (this.currentMode === "system") this.setMode("system");
      });
  },

  applySettings() {
    this.setMode(safeGetLS("theme_mode") || "system");
    this.setColor(safeGetLS("theme_color") || "#22c55e");
    this.isAdaptiveBg = safeGetLS("app_adaptive_bg") !== "false";
    this.hasVignette = safeGetLS("app_vignette") === "true";
    this.isLiquidGlass = safeGetLS("app_liquid_glass") === "true";
    this.vignetteAlpha = parseFloat(safeGetLS("app_vignette_alpha")) || 0.5;
    this.showMs = safeGetLS("app_show_ms") !== "false";

    this.updateAdaptiveClass();
    this.setBgColor(safeGetLS("theme_bg_color") || "default");
    this.setFontSize(safeGetLS("font_size") || 16);

    this.updateGlass();
    this.updateVignette();

    if ($("toggle-adaptive-bg"))
      $("toggle-adaptive-bg").checked = this.isAdaptiveBg;
    if ($("toggle-glass")) $("toggle-glass").checked = this.isLiquidGlass;
    if ($("toggle-vignette")) $("toggle-vignette").checked = this.hasVignette;
    if ($("vignetteSlider")) $("vignetteSlider").value = this.vignetteAlpha;
    if ($("toggle-ms")) $("toggle-ms").checked = this.showMs;
    if ($("fontSlider")) $("fontSlider").value = safeGetLS("font_size") || 16;

    // Этот блок остается для инициализации при загрузке страницы
    const storedColor = safeGetLS("theme_color");
    if ($("customColorInput")) {
      if (storedColor && storedColor.startsWith("#")) {
        $("customColorInput").value = storedColor;
      } else {
        $("customColorInput").value = "#22c55e";
      }
    }

    const storedBgColor = safeGetLS("theme_bg_color");
    if ($("customBgInput")) {
      if (storedBgColor && storedBgColor.startsWith("#")) {
        $("customBgInput").value = storedBgColor;
      } else {
        $("customBgInput").value = "#000000";
      }
    }
  },

  updateAdaptiveClass() {
    if (this.isAdaptiveBg) {
      document.documentElement.classList.remove("no-adaptive");
    } else {
      document.documentElement.classList.add("no-adaptive");
    }
  },

  updateGlass() {
    if (this.isLiquidGlass)
      document.documentElement.classList.add("glass-effect");
    else document.documentElement.classList.remove("glass-effect");
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

    const isDark =
      mode === "dark" ||
      (mode === "system" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);

    if (isDark) {
      document.documentElement.classList.add("dark");
      document.documentElement.style.colorScheme = "dark";
    } else {
      document.documentElement.classList.remove("dark");
      document.documentElement.style.colorScheme = "light";
    }

    document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
      const media = meta.getAttribute("media") || "";
      if (media.includes("dark")) {
        meta.content = isDark ? "#000000" : "#f3f4f6";
      } else if (media.includes("light")) {
        meta.content = isDark ? "#000000" : "#f3f4f6";
      }
    });

    this.applyBgTheme(this.currentBg, isDark);
  },

  setColor(hex) {
    safeSetLS("theme_color", hex);

    // ===============================================
    // === НОВОЕ ИЗМЕНЕНИЕ ===
    // Обновляем значение кастомного пикера в реальном времени
    // ===============================================
    const customColorPicker = $("customColorInput");
    if (customColorPicker && hex.startsWith("#")) {
      customColorPicker.value = hex;
    }

    if (hex === "auto") {
      if (
        window.Capacitor &&
        window.Capacitor.Plugins &&
        window.Capacitor.Plugins.MaterialYou
      ) {
        window.Capacitor.Plugins.MaterialYou.getColors()
          .then((colors) => this.applyMaterialYouColors(colors))
          .catch(() => this.setColor("#22c55e"));
      } else {
        this.setColor("#22c55e");
      }
      this.updateButtons(this.colorBtns, "auto", "customColorInput", false);
      return;
    }

    document.documentElement.style.setProperty("--primary-color", hex);
    const { h } = this.hexToHSL(hex);
    document.documentElement.style.setProperty("--accent-h", h);
    this.updateButtons(this.colorBtns, hex, "customColorInput", false);
  },

  setBgColor(hex) {
    this.currentBg = hex;
    safeSetLS("theme_bg_color", hex);

    // ===============================================
    // === НОВОЕ ИЗМЕНЕНИЕ ===
    // Обновляем значение кастомного пикера в реальном времени
    // ===============================================
    const customBgPicker = $("customBgInput");
    if (customBgPicker) {
      if (hex.startsWith("#")) {
        customBgPicker.value = hex;
      } else {
        // Если выбран "default", сбрасываем пикер на безопасное значение
        customBgPicker.value = "#000000";
      }
    }

    const isDark = document.documentElement.classList.contains("dark");
    this.applyBgTheme(hex, isDark);
    this.updateButtons(this.bgBtns, hex, "customBgInput", true);
  },

  updateButtons(btnCollection, hex, customId, isBg) {
    let found = false;
    btnCollection.forEach((b) => {
      b.classList.remove(
        "ring-2",
        "ring-offset-2",
        "ring-offset-white",
        "dark:ring-offset-gray-900",
      );
      const targetAttr = isBg
        ? b.getAttribute("data-bg")
        : b.getAttribute("data-color");
      if (targetAttr === hex) {
        b.classList.add(
          "ring-2",
          "ring-offset-2",
          "ring-offset-white",
          "dark:ring-offset-gray-900",
        );
        const iconColor =
          isBg && hex === "default" ? "var(--text-color)" : "white";
        b.innerHTML = `<svg focusable="false" aria-hidden="true" class="w-5 h-5" style="color: ${iconColor};" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path></svg>`;
        found = true;
      } else {
        b.innerHTML = "";
      }
    });

    const pickerWrapper = $(customId)?.closest(".relative");
    if (!pickerWrapper) return;
    const gradientEl = pickerWrapper.querySelector(
      '[class*="bg-[conic-gradient"]',
    );

    pickerWrapper.classList.remove(
      "ring-2",
      "ring-offset-2",
      "ring-offset-white",
      "dark:ring-offset-gray-900",
    );
    pickerWrapper.style.backgroundColor = "";
    if (gradientEl) gradientEl.style.opacity = "1";

    if (!found && hex !== "default" && hex.startsWith("#")) {
      pickerWrapper.classList.add(
        "ring-2",
        "ring-offset-2",
        "ring-offset-white",
        "dark:ring-offset-gray-900",
      );
      pickerWrapper.style.backgroundColor = hex;
      if (gradientEl) gradientEl.style.opacity = "0";
    }
  },

  getLuminance(r, g, b) {
    const a = [r, g, b].map((v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
  },

  applyBgTheme(hex, isDark) {
    const root = document.documentElement;

    document.body.classList.remove("force-light-text", "force-dark-text");

    if (hex === "default") {
      if (!this.isAdaptiveBg) {
        root.style.setProperty("--bg-color", isDark ? "#000000" : "#f3f4f6");
        root.style.setProperty(
          "--surface-color",
          isDark ? "#1c1c1e" : "#ffffff",
        );
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
        root.style.setProperty(
          "--surface-color",
          `color-mix(in srgb, ${hex}, white 10%)`,
        );
      } else {
        const mixArg = l > 90 ? "black 5%" : "white 25%";
        root.style.setProperty(
          "--surface-color",
          `color-mix(in srgb, ${hex}, ${mixArg})`,
        );
      }

      const luminance = this.getLuminance(rgb.r, rgb.g, rgb.b);

      if (luminance < 0.48) document.body.classList.add("force-light-text");
      else document.body.classList.add("force-dark-text");
      return;
    }

    const satDark = Math.min(s, 40);
    const satLight = Math.max(s, 20);
    if (isDark) {
      root.style.setProperty("--bg-color", `hsl(${h} ${satDark}% 8%)`);
      root.style.setProperty("--surface-color", `hsl(${h} ${satDark}% 14%)`);
    } else {
      root.style.setProperty("--bg-color", `hsl(${h} ${satLight}% 94%)`);
      root.style.setProperty("--surface-color", `hsl(${h} ${satLight}% 98%)`);
    }
  },

  updateVignette() {
    const bgElement = document.querySelector(".app-bg");
    const vignetteContainer = $("vignette-depth-container");
    if (!bgElement) return;

    if (vignetteContainer) {
      if (this.hasVignette) {
        vignetteContainer.classList.remove("hidden");
        vignetteContainer.classList.add("flex");
      } else {
        vignetteContainer.classList.add("hidden");
        vignetteContainer.classList.remove("flex");
      }
    }

    if (this.hasVignette) {
      bgElement.classList.add("has-vignette");
      const visualAlpha = this.vignetteAlpha * 0.3;
      document.documentElement.style.setProperty(
        "--vignette-alpha",
        visualAlpha,
      );
    } else {
      bgElement.classList.remove("has-vignette");
    }
  },

  hexToRGB(H) {
    if (!H || !H.startsWith("#")) return { r: 0, g: 0, b: 0 };
    let r = 0,
      g = 0,
      b = 0;
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

  hexToHSL(H) {
    if (!H || !H.startsWith("#")) return { h: 142, s: 50, l: 50 };
    const { r: r255, g: g255, b: b255 } = this.hexToRGB(H);
    let r = r255 / 255,
      g = g255 / 255,
      b = b255 / 255;
    let cmin = Math.min(r, g, b),
      cmax = Math.max(r, g, b),
      delta = cmax - cmin;
    let h = 0,
      s = 0,
      l = (cmax + cmin) / 2;
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
    if ($("fontSizeDisplay"))
      $("fontSizeDisplay").textContent = numSize + " px";
    safeSetLS("font_size", numSize);
  },

  applyMaterialYouColors(colors) {
    const storedColor = safeGetLS("theme_color");
    if (storedColor && storedColor !== "auto") return;

    const primaryColor = colors.system_accent1_500;
    if (primaryColor) {
      document.documentElement.style.setProperty(
        "--primary-color",
        primaryColor,
      );
      const { h } = this.hexToHSL(primaryColor);
      document.documentElement.style.setProperty("--accent-h", h);
    }
  },
};
