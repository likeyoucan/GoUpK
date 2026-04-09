// ===== theme.js (ФИНАЛЬНАЯ ВЕРСИЯ) =====

import { $, safeGetLS, safeSetLS } from "./utils.js";

const DEFAULT_ACCENT_COLOR = "#22c55e";
const DEFAULT_BG_COLOR = "default";

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
              MaterialYou.addListener("colorColorsChanged", (colors) =>
                this.applyMaterialYouColors(colors),
              );
              MaterialYou.getColors()
                .then((colors) => this.applyMaterialYouColors(colors))
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
        this.setMode(e.target.getAttribute("data-theme-mode")),
      ),
    );
    this.colorBtns.forEach((btn) =>
      btn.addEventListener("click", (e) =>
        this.setColor(e.target.getAttribute("data-color")),
      ),
    );
    this.bgBtns.forEach((btn) =>
      btn.addEventListener("click", (e) =>
        this.setBgColor(e.target.getAttribute("data-bg")),
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
    this.setColor(safeGetLS("theme_color") || DEFAULT_ACCENT_COLOR);
    this.isAdaptiveBg = safeGetLS("app_adaptive_bg") !== "false";
    this.hasVignette = safeGetLS("app_vignette") === "true";
    this.isLiquidGlass = safeGetLS("app_liquid_glass") === "true";
    this.vignetteAlpha = parseFloat(safeGetLS("app_vignette_alpha")) || 0.5;
    this.showMs = safeGetLS("app_show_ms") !== "false";
    this.updateAdaptiveClass();
    this.setBgColor(safeGetLS("theme_bg_color") || DEFAULT_BG_COLOR);
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
    if ($("customColorInput"))
      $("customColorInput").value =
        safeGetLS("theme_color") || DEFAULT_ACCENT_COLOR;
    if ($("customBgInput"))
      $("customBgInput").value = safeGetLS("theme_bg_color") || "#ffffff";
  },

  updateAdaptiveClass() {
    document.documentElement.classList.toggle(
      "no-adaptive",
      !this.isAdaptiveBg,
    );
  },
  updateGlass() {
    document.documentElement.classList.toggle(
      "glass-effect",
      this.isLiquidGlass,
    );
  },

  setMode(mode) {
    this.currentMode = mode;
    safeSetLS("theme_mode", mode);
    this.themeBtns.forEach((b) => {
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
    let meta =
      document.head.querySelector('meta[name="color-scheme"]') ||
      document.createElement("meta");
    meta.name = "color-scheme";
    meta.content = isDark ? "dark" : "light";
    document.head.appendChild(meta);
    if (window.Capacitor && window.Capacitor.isNativePlatform()) {
      const { StatusBar } = window.Capacitor.Plugins;
      if (StatusBar)
        StatusBar.setStyle({ style: isDark ? "LIGHT" : "DARK" }).catch(
          () => {},
        );
    }
    this.applyBgTheme(this.currentBg, isDark);
  },

  setColor(hex) {
    safeSetLS("theme_color", hex);
    if (hex === "auto") {
      if (window.Capacitor && window.Capacitor.Plugins.MaterialYou) {
        window.Capacitor.Plugins.MaterialYou.getColors()
          .then((c) => this.applyMaterialYouColors(c))
          .catch(() => this.setColor(DEFAULT_ACCENT_COLOR));
      } else {
        this.setColor(DEFAULT_ACCENT_COLOR);
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
    this.applyBgTheme(hex, document.documentElement.classList.contains("dark"));
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
    pickerWrapper.classList.toggle("ring-2", !found && hex !== "default");
    pickerWrapper.classList.toggle(
      "ring-offset-2",
      !found && hex !== "default",
    );
    pickerWrapper.classList.toggle(
      "ring-offset-white",
      !found && hex !== "default",
    );
    pickerWrapper.classList.toggle(
      "dark:ring-offset-gray-900",
      !found && hex !== "default",
    );
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
      root.style.setProperty(
        "--bg-color",
        !this.isAdaptiveBg ? (isDark ? "#000000" : "#f3f4f6") : "",
      );
      root.style.setProperty(
        "--surface-color",
        !this.isAdaptiveBg ? (isDark ? "#1c1c1e" : "#ffffff") : "",
      );
      if (this.isAdaptiveBg) {
        root.style.removeProperty("--bg-color");
        root.style.removeProperty("--surface-color");
      }
      return;
    }
    const { r, g, b } = this.hexToRGB(hex);
    const { h, s, l } = this.hexToHSL(hex);
    if (!this.isAdaptiveBg) {
      root.style.setProperty("--bg-color", hex);
      if (isDark)
        root.style.setProperty(
          "--surface-color",
          `color-mix(in srgb, ${hex}, white 12%)`,
        );
      else
        root.style.setProperty(
          "--surface-color",
          l > 85
            ? `color-mix(in srgb, ${hex}, black 8%)`
            : `color-mix(in srgb, ${hex}, white 25%)`,
        );
      document.body.classList.add(
        this.getLuminance(r, g, b) < 0.5
          ? "force-light-text"
          : "force-dark-text",
      );
      return;
    }
    const satDark = Math.min(s, 40),
      satLight = Math.max(s, 20);
    root.style.setProperty(
      "--bg-color",
      `hsl(${h}, ${isDark ? satDark : satLight}%, ${isDark ? 8 : 94}%)`,
    );
    root.style.setProperty(
      "--surface-color",
      `hsl(${h}, ${isDark ? satDark : satLight}%, ${isDark ? 14 : 98}%)`,
    );
  },

  updateVignette() {
    const bgElement = document.querySelector(".app-bg");
    const vignetteContainer = $("vignette-depth-container");
    if (!bgElement) return;
    if (vignetteContainer)
      vignetteContainer.style.display = this.hasVignette ? "flex" : "none";
    bgElement.classList.toggle("has-vignette", this.hasVignette);
    if (this.hasVignette)
      document.documentElement.style.setProperty(
        "--vignette-alpha",
        this.vignetteAlpha * 0.3,
      );
  },

  hexToRGB(H) {
    let r = 0,
      g = 0,
      b = 0;
    if (H.length == 4) {
      r = "0x" + H[1] + H[1];
      g = "0x" + H[2] + H[2];
      b = "0x" + H[3] + H[3];
    } else if (H.length == 7) {
      r = "0x" + H[1] + H[2];
      g = "0x" + H[3] + H[4];
      b = "0x" + H[5] + H[6];
    }
    return { r: +r, g: +g, b: +b };
  },
  hexToHSL(H) {
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
    if (delta != 0) {
      if (cmax == r) h = ((g - b) / delta) % 6;
      else if (cmax == g) h = (b - r) / delta + 2;
      else h = (r - g) / delta + 4;
      s = delta / (1 - Math.abs(2 * l - 1));
    }
    h = Math.round(h * 60);
    if (h < 0) h += 360;
    return { h, s: +(s * 100).toFixed(1), l: +(l * 100).toFixed(1) };
  },
  setFontSize(size) {
    document.documentElement.style.setProperty("--font-scale", size / 16);
    if ($("fontSizeDisplay")) $("fontSizeDisplay").textContent = size + " px";
    safeSetLS("font_size", size);
  },

  applyMaterialYouColors(colors) {
    if (safeGetLS("theme_color") && safeGetLS("theme_color") !== "auto") return;
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
