/*! theme.js | Optimized & Bugfix Background */

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

    if (window.Capacitor?.isNativePlatform()) {
      const { MaterialYou } = window.Capacitor.Plugins;
      MaterialYou?.isSupported()
        .then((res) => {
          if (res.isSupported) {
            MaterialYou.addListener("colorColorsChanged", (c) =>
              this.applyMaterialYouColors(c),
            );
            MaterialYou.getColors()
              .then((c) => this.applyMaterialYouColors(c))
              .catch(() => {});
          }
        })
        .catch(() => {});
    }

    this.applySettings();

    const bindChange = (id, prop, lsKey, callback) => {
      $(id)?.addEventListener("change", (e) => {
        this[prop] =
          e.target.type === "checkbox" ? e.target.checked : e.target.value;
        safeSetLS(lsKey, this[prop]);
        if (callback) callback(e.target.value);
      });
    };

    bindChange("toggle-ms", "showMs", "app_show_ms", (val) => {
      document.dispatchEvent(
        new CustomEvent("msChanged", { detail: this.showMs }),
      );
    });

    bindChange("toggle-adaptive-bg", "isAdaptiveBg", "app_adaptive_bg", () => {
      this.updateAdaptiveClass();
      this.applyBgTheme(
        this.currentBg,
        document.documentElement.classList.contains("dark"),
      );
    });

    bindChange("toggle-glass", "isLiquidGlass", "app_liquid_glass", () =>
      this.updateGlass(),
    );
    bindChange("toggle-vignette", "hasVignette", "app_vignette", () =>
      this.updateVignette(),
    );

    $("vignetteSlider")?.addEventListener("input", (e) => {
      this.vignetteAlpha = parseFloat(e.target.value);
      safeSetLS("app_vignette_alpha", this.vignetteAlpha);
      this.updateVignette();
    });

    $("fontSlider")?.addEventListener("input", (e) =>
      this.setFontSize(e.target.value),
    );

    this.themeBtns.forEach((b) =>
      b.addEventListener("click", (e) =>
        this.setMode(e.currentTarget.getAttribute("data-theme-mode")),
      ),
    );
    this.colorBtns.forEach((b) =>
      b.addEventListener("click", (e) =>
        this.setColor(e.currentTarget.getAttribute("data-color")),
      ),
    );
    this.bgBtns.forEach((b) =>
      b.addEventListener("click", (e) =>
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
    const fs = safeGetLS("font_size") || 16;

    this.updateAdaptiveClass();
    this.setBgColor(safeGetLS("theme_bg_color") || "default");
    this.setFontSize(fs);
    this.updateGlass();
    this.updateVignette();

    if ($("toggle-adaptive-bg"))
      $("toggle-adaptive-bg").checked = this.isAdaptiveBg;
    if ($("toggle-glass")) $("toggle-glass").checked = this.isLiquidGlass;
    if ($("toggle-vignette")) $("toggle-vignette").checked = this.hasVignette;
    if ($("vignetteSlider")) $("vignetteSlider").value = this.vignetteAlpha;
    if ($("toggle-ms")) $("toggle-ms").checked = this.showMs;
    if ($("fontSlider")) $("fontSlider").value = fs;

    const storedColor = safeGetLS("theme_color");
    if ($("customColorInput"))
      $("customColorInput").value = storedColor?.startsWith("#")
        ? storedColor
        : "#22c55e";

    const storedBgColor = safeGetLS("theme_bg_color");
    if ($("customBgInput"))
      $("customBgInput").value = storedBgColor?.startsWith("#")
        ? storedBgColor
        : "#000000";
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
    this.themeBtns.forEach((b) =>
      b.classList.remove("app-surface", "shadow-sm", "app-text"),
    );
    $(`theme-${mode}`)?.classList.add("app-surface", "shadow-sm", "app-text");

    const isDark =
      mode === "dark" ||
      (mode === "system" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", isDark);
    document.documentElement.style.colorScheme = isDark ? "dark" : "light";

    const metaColor = isDark ? "#000000" : "#f3f4f6";
    document
      .querySelectorAll('meta[name="theme-color"]')
      .forEach((m) => (m.content = metaColor));
    this.applyBgTheme(this.currentBg, isDark);
  },

  setColor(hex) {
    if (hex === "auto") {
      const M = window.Capacitor?.Plugins?.MaterialYou;
      if (M)
        M.getColors()
          .then((c) => this.applyMaterialYouColors(c))
          .catch(() => this.setColor("#22c55e"));
      else this.setColor("#22c55e");
      return;
    }
    safeSetLS("theme_color", hex);
    if ($("customColorInput") && hex.startsWith("#"))
      $("customColorInput").value = hex;
    document.documentElement.style.setProperty("--primary-color", hex);
    document.documentElement.style.setProperty(
      "--accent-h",
      this.hexToHSL(hex).h,
    );
    this.updateButtons(this.colorBtns, hex, "customColorInput", false);
  },

  setBgColor(hex) {
    this.currentBg = hex;
    safeSetLS("theme_bg_color", hex);
    if ($("customBgInput") && hex.startsWith("#"))
      $("customBgInput").value = hex;
    this.applyBgTheme(hex, document.documentElement.classList.contains("dark"));
    this.updateButtons(this.bgBtns, hex, "customBgInput", true);
  },

  updateButtons(btns, hex, customId, isBg) {
    let found = false;
    btns.forEach((b) => {
      b.classList.remove(
        "ring-2",
        "ring-offset-2",
        "ring-offset-white",
        "dark:ring-offset-gray-900",
      );
      if (
        (isBg ? b.getAttribute("data-bg") : b.getAttribute("data-color")) ===
        hex
      ) {
        b.classList.add(
          "ring-2",
          "ring-offset-2",
          "ring-offset-white",
          "dark:ring-offset-gray-900",
        );
        b.innerHTML = `<svg class="w-5 h-5" style="color:${isBg && hex === "default" ? "var(--text-color)" : "white"}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path></svg>`;
        found = true;
      } else b.innerHTML = "";
    });

    const wrapper = $(customId)?.closest(".relative");
    if (!wrapper) return;
    wrapper.classList.toggle(
      "ring-2",
      !found && hex !== "default" && hex.startsWith("#"),
    );
    wrapper.style.backgroundColor = !found && hex.startsWith("#") ? hex : "";
    const grad = wrapper.querySelector('[class*="bg-[conic-gradient"]');
    if (grad) grad.style.opacity = !found && hex.startsWith("#") ? "0" : "1";
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
      const mix = isDark ? "white 10%" : l > 90 ? "black 5%" : "white 25%";
      root.style.setProperty(
        "--surface-color",
        `color-mix(in srgb, ${hex}, ${mix})`,
      );
      const lum = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
      document.body.classList.add(
        lum < 0.5 ? "force-light-text" : "force-dark-text",
      );
    } else {
      const bgL = isDark ? "10%" : "94%";
      const surfL = isDark ? "16%" : "98%";
      root.style.setProperty(
        "--bg-color",
        `hsl(${h} ${Math.min(s, 40)}% ${bgL})`,
      );
      root.style.setProperty(
        "--surface-color",
        `hsl(${h} ${Math.min(s, 40)}% ${surfL})`,
      );
    }
  },

  updateVignette() {
    const bg = document.querySelector(".app-bg");
    const container = $("vignette-depth-container");
    if (!bg) return;
    if (container) container.classList.toggle("hidden", !this.hasVignette);
    bg.classList.toggle("has-vignette", this.hasVignette);
    if (this.hasVignette)
      document.documentElement.style.setProperty(
        "--vignette-alpha",
        this.vignetteAlpha * 0.3,
      );
  },

  hexToRGB(h) {
    let r = 0,
      g = 0,
      b = 0;
    if (h.length === 4) {
      r = parseInt(h[1] + h[1], 16);
      g = parseInt(h[2] + h[2], 16);
      b = parseInt(h[3] + h[3], 16);
    } else {
      r = parseInt(h[1] + h[2], 16);
      g = parseInt(h[3] + h[4], 16);
      b = parseInt(h[5] + h[6], 16);
    }
    return { r, g, b };
  },

  hexToHSL(H) {
    const { r, g, b } = this.hexToRGB(H);
    let r1 = r / 255,
      g1 = g / 255,
      b1 = b / 255;
    const max = Math.max(r1, g1, b1),
      min = Math.min(r1, g1, b1),
      d = max - min;
    let h = 0,
      s = 0,
      l = (max + min) / 2;
    if (d !== 0) {
      s = d / (1 - Math.abs(2 * l - 1));
      if (max === r1) h = ((g1 - b1) / d) % 6;
      else if (max === g1) h = (b1 - r1) / d + 2;
      else h = (r1 - g1) / d + 4;
    }
    h = Math.round(h * 60);
    return {
      h: h < 0 ? h + 360 : h,
      s: +(s * 100).toFixed(1),
      l: +(l * 100).toFixed(1),
    };
  },

  setFontSize(size) {
    document.documentElement.style.setProperty("--font-scale", size / 16);
    if ($("fontSizeDisplay")) $("fontSizeDisplay").textContent = size + " px";
    safeSetLS("font_size", size);
  },

  applyMaterialYouColors(colors) {
    if (safeGetLS("theme_color") !== "auto") return;
    const p = colors.system_accent1_500;
    if (p) {
      document.documentElement.style.setProperty("--primary-color", p);
      document.documentElement.style.setProperty(
        "--accent-h",
        this.hexToHSL(p).h,
      );
    }
  },
};
