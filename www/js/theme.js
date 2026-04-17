// Файл: www/js/theme.js

import {
  $,
  safeGetLS,
  safeSetLS,
  safeRemoveLS,
  showToast,
} from "./utils.js?v=VERSION";
import { t } from "./i18n.js?v=VERSION";
import { sm } from "./sound.js?v=VERSION";

const MAX_CUSTOM_COLORS = 50;

export const themeManager = {
  currentMode: "system",
  currentAccent: "",
  currentBg: "default",
  showMs: true,
  isAdaptiveBg: true,
  hasVignette: false,
  isLiquidGlass: false,
  hideNavLabels: false,
  vignetteAlpha: 0.2,
  vignetteLevels: [0.1, 0.15, 0.2, 0.2, 0.3],
  vignetteLabels: [
    "vignette_min",
    "vignette_low",
    "vignette_medium",
    "vignette_high",
    "vignette_max",
  ],
  vibroLabels: [
    "vibro_min",
    "vibro_low",
    "vibro_medium",
    "vibro_high",
    "vibro_max",
  ],
  ringWidth: 4,
  swMinuteBeep: true,
  standardAccentColors: [
    "#22c55e",
    "#3b82f6",
    "#a855f7",
    "#ec4899",
    "#f97316",
    "#ef4444",
    "#6366f1",
    "#e11d48",
  ],
  standardBgColors: [
    "default",
    "#60a5fa",
    "#c084fc",
    "#f472b6",
    "#34d399",
    "#facc15",
    "#f87171",
    "#2dd4bf",
  ],
  customAccentColors: [],
  customBgColors: [],

  _createColorButtonEl(color, isCustom) {
    const wrapper = document.createElement("div");
    wrapper.className = "custom-color-wrapper shrink-0 rounded-full";
    wrapper.dataset.color = color;
    wrapper.dataset.custom = isCustom;
    const button = document.createElement("button");
    button.type = "button";
    button.className =
      "color-btn w-9 h-9 flex items-center justify-center rounded-full shrink-0 transition-transform active:scale-90 border border-black/20 dark:border-white/20 focus:outline-none custom-focus";
    if (color === "default") {
      button.classList.add("default-bg-btn");
      button.ariaLabel = t("default_color");
    } else {
      button.style.backgroundColor = color;
    }
    wrapper.appendChild(button);
    return wrapper;
  },

  _removeActionButton(container) {
    const actionBtn = container.querySelector(".color-action-btn.is-visible");
    if (actionBtn) {
      // Запускаем анимацию скрытия
      actionBtn.classList.remove("is-visible");
      // Удаляем элемент из DOM только ПОСЛЕ завершения анимации
      actionBtn.addEventListener('transitionend', () => {
        actionBtn.remove();
      }, { once: true });
    }

  _handleActionButtonLogic(type, hex) {
    const isAccent = type === "accent";
    const container = $(
      isAccent ? "accent-colors-container" : "bg-colors-container",
    );
    if (!container) return;
    container.querySelector(".color-action-btn")?.remove();
    let activeWrapper = container.querySelector(
      `.custom-color-wrapper[data-color="${hex}"]`,
    );
    if (!activeWrapper) {
      const picker = $(isAccent ? "customColorInput" : "customBgInput");
      if (picker && picker.value === hex)
        activeWrapper = picker.closest(".relative");
    }
    if (!activeWrapper) return;
    const allCustom = isAccent ? this.customAccentColors : this.customBgColors;
    const isCustom = allCustom.includes(hex);
    let actionBtnHTML = null;
    if (isCustom) {
      actionBtnHTML = `<button type="button" data-action="delete" aria-label="${t("delete")}" class="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-full bg-red-500/10 text-red-500 hover:bg-red-500/20 focus:outline-none custom-focus"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 12h-15"></path></svg></button>`;
    } else if (!isCustom && hex !== "default" && hex.startsWith("#")) {
      const standardColors = isAccent
        ? this.standardAccentColors
        : this.standardBgColors;
      if (!standardColors.includes(hex)) {
        actionBtnHTML = `<button type="button" data-action="add" aria-label="${t("add_color")}" class="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-full bg-green-500/10 text-green-500 hover:bg-green-500/20 focus:outline-none custom-focus"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"></path></svg></button>`;
      }
    }
    if (actionBtnHTML && activeWrapper) {
      const actionBtnWrapper = document.createElement("div");
      actionBtnWrapper.className = "color-action-btn";
      actionBtnWrapper.innerHTML = actionBtnHTML;
      activeWrapper.parentNode.insertBefore(actionBtnWrapper, activeWrapper);
      requestAnimationFrame(() => {
        void actionBtnWrapper.offsetWidth;
        actionBtnWrapper.classList.add("is-visible");
        setTimeout(() => {
          actionBtnWrapper.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
            inline: "center",
          });
        }, 50);
      });
    }
  },

  updateColorSelectionUI(type, hex, doScroll = true) {
    const isAccent = type === "accent";
    const container = $(
      isAccent ? "accent-colors-container" : "bg-colors-container",
    );
    if (!container) return;
    container
      .querySelectorAll(".custom-color-wrapper, .relative")
      .forEach((el) => {
        el.classList.remove(
          "ring-[var(--primary-color)]",
          "ring-2",
          "ring-offset-2",
          "ring-offset-surface",
          "shadow-lg",
        );
        if (el.classList.contains("custom-color-wrapper")) {
          const btn = el.querySelector("button");
          if (btn && btn.dataset.iconAdded) {
            btn.innerHTML = btn.dataset.originalContent || "";
            delete btn.dataset.iconAdded;
            delete btn.dataset.originalContent;
          }
        } else if (el.classList.contains("relative")) {
          el.querySelector(".injected-checkmark")?.remove();
        }
      });
    let activeWrapper = container.querySelector(
      `.custom-color-wrapper[data-color="${hex}"]`,
    );
    if (!activeWrapper) {
      const picker = $(isAccent ? "customColorInput" : "customBgInput");
      if (picker && picker.value === hex)
        activeWrapper = picker.closest(".relative");
    }
    if (activeWrapper) {
      activeWrapper.classList.add(
        "ring-[var(--primary-color)]",
        "ring-2",
        "ring-offset-2",
        "ring-offset-surface",
        "shadow-lg",
      );
      let iconColorVar;
      const isPicker = activeWrapper.classList.contains("relative");
      const isDefaultButton = hex === "default";
      if (isPicker) {
        iconColorVar = "#ffffff";
      } else if (isDefaultButton) {
        const isDarkTheme = document.documentElement.classList.contains("dark");
        iconColorVar = isDarkTheme ? "#ffffff" : "#1f2937";
      } else {
        const lum = this.getLuminance(...Object.values(this.hexToRGB(hex)));
        iconColorVar = lum > 0.5 ? "#1f2937" : "#ffffff";
      }
      const checkmarkSVG = `<svg focusable="false" aria-hidden="true" class="w-5 h-5" style="color: ${iconColorVar};" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4.5 12.75l6 6 9-13.5"></path></svg>`;
      if (activeWrapper.classList.contains("custom-color-wrapper")) {
        const button = activeWrapper.querySelector("button");
        button.dataset.originalContent = button.innerHTML;
        button.dataset.iconAdded = "true";
        button.innerHTML = checkmarkSVG;
      } else if (activeWrapper.classList.contains("relative")) {
        const checkmarkWrapper = document.createElement("div");
        checkmarkWrapper.className =
          "injected-checkmark absolute inset-0 flex items-center justify-center z-20 pointer-events-none";
        checkmarkWrapper.innerHTML = checkmarkSVG;
        activeWrapper.appendChild(checkmarkWrapper);
      }
      if (doScroll) {
        activeWrapper.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
          inline: "nearest",
        });
      }
    }
  },

  handleColorClick(event, type) {
    const target = event.target;
    const isAccent = type === "accent";
    const container = $(
      isAccent ? "accent-colors-container" : "bg-colors-container",
    );
    const actionBtn = target.closest(".color-action-btn button");

    if (actionBtn) {
      sm.vibrate(40, "medium");
      const action = actionBtn.dataset.action;
      const actionBtnWrapper = actionBtn.parentElement;
      const colorToDeleteWrapper = actionBtnWrapper.nextElementSibling;

      if (action === "add") {
        const activeColor = isAccent ? this.currentAccent : this.currentBg;
        this.addCustomColor(type, activeColor);
      } else if (action === "delete" && colorToDeleteWrapper) {
        const colorToDelete = colorToDeleteWrapper.dataset.color;

        actionBtnWrapper.classList.add("is-deleting");
        colorToDeleteWrapper.classList.add("is-deleting");

        colorToDeleteWrapper.addEventListener(
          "transitionend",
          () => {
            this.deleteCustomColor(type, colorToDelete);
            colorToDeleteWrapper.remove();
            actionBtnWrapper.remove();

            const currentSelected = isAccent
              ? this.currentAccent
              : this.currentBg;
            if (currentSelected === colorToDelete) {
              const newActiveColor = isAccent
                ? this.standardAccentColors[0]
                : "default";
              isAccent
                ? this.setColor(newActiveColor, false, false)
                : this.setBgColor(newActiveColor, false, false);
            }
          },
          { once: true },
        );
      }
      return;
    }

    const colorWrapper = target.closest(".custom-color-wrapper");
    if (colorWrapper) {
      const color = colorWrapper.dataset.color;
      const currentSelected = isAccent ? this.currentAccent : this.currentBg;

      // При любом клике на кружок цвета, мы сначала плавно убираем старую кнопку действия
      this._removeActionButton(container);

      if (color === currentSelected) {
        // Если кликнули по уже выделенному цвету, показываем кнопку (если цвет кастомный)
        const isCustom = colorWrapper.dataset.custom === "true";
        if (isCustom) {
            this._handleActionButtonLogic(type, color);
        }
      } else {
        // Если кликнули по другому цвету, просто меняем цвет
        sm.vibrate(20, "light");
        if (isAccent) {
          this.setColor(color, true);
        } else {
          this.setBgColor(color, true);
        }
      }
    }
  },

  bindEvents() {
    const addWheelScroll = (containerId) => {
      const container = $(containerId);
      if (container) {
        container.addEventListener(
          "wheel",
          (e) => {
            if (e.deltaY !== 0) {
              e.preventDefault();
              container.scrollLeft += e.deltaY;
            }
          },
          { passive: false },
        );
      }
    };
    addWheelScroll("accent-colors-container");
    addWheelScroll("bg-colors-container");
    document.addEventListener("languageChanged", () => this.syncSliderUIs());
    document.addEventListener("vibroToggled", (e) =>
      this.updateVibroSliderUI(e.detail.enabled),
    );
    $("accent-colors-container")?.addEventListener("click", (e) =>
      this.handleColorClick(e, "accent"),
    );
    $("bg-colors-container")?.addEventListener("click", (e) =>
      this.handleColorClick(e, "bg"),
    );
    document.body.addEventListener("change", (e) => {
      if (e.target.id === "customColorInput")
        this.setColor(e.target.value, true);
      if (e.target.id === "customBgInput")
        this.setBgColor(e.target.value, true);
    });
    $("toggle-sw-minute-beep")?.addEventListener("change", (e) => {
      this.swMinuteBeep = e.target.checked;
      safeSetLS("app_sw_minute_beep", this.swMinuteBeep);
    });
    $("toggle-ms")?.addEventListener("change", (e) => {
      this.showMs = e.target.checked;
      safeSetLS("app_show_ms", this.showMs);
      document.dispatchEvent(new CustomEvent("msChanged"));
    });
    $("toggle-adaptive-bg")?.addEventListener("change", (e) => {
      document.body.classList.add("is-updating-theme");
      this.isAdaptiveBg = e.target.checked;
      safeSetLS("app_adaptive_bg", this.isAdaptiveBg);
      this.updateAdaptiveClass();
      this.applyBgTheme(
        this.currentBg,
        document.documentElement.classList.contains("dark"),
      );
      requestAnimationFrame(() =>
        document.body.classList.remove("is-updating-theme"),
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
    $("vignetteSlider")?.addEventListener("input", (e) => {
      sm.vibrate(10, "tactile");
      this.vignetteAlpha = this.vignetteLevels[e.target.value];
      this.updateVignette();
      this.updateSliderLabel(
        "vignetteSlider",
        "vignette-label",
        this.vignetteLabels,
      );
    });
    $("vignetteSlider")?.addEventListener("change", () =>
      safeSetLS("app_vignette_alpha", this.vignetteAlpha),
    );
    $("fontSlider")?.addEventListener("input", (e) => {
      sm.vibrate(10, "tactile");
      this.setFontSize(e.target.value);
    });
    $("ringWidthSlider")?.addEventListener("input", (e) => {
      sm.vibrate(10, "tactile");
      this.setRingWidth(e.target.value);
    });
    $("vibroSlider")?.addEventListener("input", (e) => {
      sm.vibrate(10, "tactile");
      this.updateSliderLabel("vibroSlider", "vibro-label", this.vibroLabels);
    });
    $("vibroSlider")?.addEventListener("change", (e) => {
      const levels = [0.5, 0.75, 1, 1.5, 2];
      sm.vibroLevel = levels[e.target.value] || 1;
      safeSetLS("app_vibro_level", sm.vibroLevel);
      sm.vibrate(50, "strong");
    });
    document
      .querySelectorAll('[id^="theme-"]')
      .forEach((btn) =>
        btn.addEventListener("click", (e) =>
          this.setMode(e.currentTarget.getAttribute("data-theme-mode")),
        ),
      );
    window
      .matchMedia("(prefers-color-scheme: dark)")
      .addEventListener("change", () => {
        if (this.currentMode === "system") this.setMode("system");
      });
  },

  updateSliderLabel(sliderId, labelId, labelsArray) {
    const slider = $(sliderId);
    const label = $(labelId);
    if (!slider || !label) return;
    const val = parseInt(slider.value, 10);
    label.textContent = t(labelsArray[val]);
    const min = parseFloat(slider.min);
    const max = parseFloat(slider.max);
    const percent = max - min > 0 ? (val - min) / (max - min) : 0;
    const thumbWidth = 24;
    const trackWidth = slider.offsetWidth;
    if (trackWidth === 0) return;
    const offset = thumbWidth / 2 - percent * thumbWidth;
    label.style.left = `calc(${percent * 100}% + ${offset}px)`;
  },

  init() {
    this.applySettings();
    this.bindEvents();
    document.dispatchEvent(new Event("languageChanged"));
  },

  applySettings() {
    try {
      this.customAccentColors =
        JSON.parse(safeGetLS("custom_accent_colors")) || [];
      this.customBgColors = JSON.parse(safeGetLS("custom_bg_colors")) || [];
    } catch (e) {}
    this.renderColorSection("accent");
    this.renderColorSection("bg");
    this._internalSetMode(safeGetLS("theme_mode") || "system", false);
    this.currentAccent =
      safeGetLS("theme_color") || this.standardAccentColors[0];
    this.setColor(this.currentAccent, false);
    this.currentBg = safeGetLS("theme_bg_color") || "default";
    this.setBgColor(this.currentBg, false);
    this.isAdaptiveBg = safeGetLS("app_adaptive_bg") !== "false";
    this.hasVignette = safeGetLS("app_vignette") === "true";
    this.isLiquidGlass = safeGetLS("app_liquid_glass") === "true";
    this.hideNavLabels = safeGetLS("app_hide_nav_labels") === "true";
    const storedVignetteAlpha = safeGetLS("app_vignette_alpha");
    this.vignetteAlpha =
      storedVignetteAlpha !== null ? parseFloat(storedVignetteAlpha) : 0.2;
    this.showMs = safeGetLS("app_show_ms") !== "false";
    this.swMinuteBeep = safeGetLS("app_sw_minute_beep") !== "false";
    this.updateAdaptiveClass();
    this.setFontSize(safeGetLS("font_size") || 16);
    this.setRingWidth(safeGetLS("app_ring_width") || 4);
    this.applyNavLabelsVisibility();
    this.updateGlass();
    this.updateVignette();
    if ($("toggle-adaptive-bg"))
      $("toggle-adaptive-bg").checked = this.isAdaptiveBg;
    if ($("toggle-glass")) $("toggle-glass").checked = this.isLiquidGlass;
    if ($("toggle-vignette")) $("toggle-vignette").checked = this.hasVignette;
    if ($("toggle-nav-labels"))
      $("toggle-nav-labels").checked = this.hideNavLabels;
    if ($("toggle-ms")) $("toggle-ms").checked = this.showMs;
    if ($("toggle-sw-minute-beep"))
      $("toggle-sw-minute-beep").checked = this.swMinuteBeep;
    if ($("fontSlider")) $("fontSlider").value = safeGetLS("font_size") || 16;
    if ($("ringWidthSlider"))
      $("ringWidthSlider").value = safeGetLS("app_ring_width") || 4;
    if ($("vignetteSlider")) {
      const closestIndex = this.vignetteLevels.reduce(
        (prev, curr, index) =>
          Math.abs(curr - this.vignetteAlpha) <
          Math.abs(this.vignetteLevels[prev] - this.vignetteAlpha)
            ? index
            : prev,
        0,
      );
      $("vignetteSlider").value = closestIndex;
    }
    if ($("vibroSlider")) {
      const levels = [0.5, 0.75, 1, 1.5, 2];
      const vibroValue = parseFloat(safeGetLS("app_vibro_level")) || 1;
      const closestIndex = levels.reduce(
        (prev, curr, index) =>
          Math.abs(curr - vibroValue) < Math.abs(levels[prev] - vibroValue)
            ? index
            : prev,
        0,
      );
      $("vibroSlider").value = closestIndex;
    }
    this.syncSliderUIs();
  },

  syncSliderUIs() {
    this.updateSliderLabel(
      "vignetteSlider",
      "vignette-label",
      this.vignetteLabels,
    );
    this.updateSliderLabel("vibroSlider", "vibro-label", this.vibroLabels);
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
    if (this.currentBg === "default") {
      const bgPicker = $("customBgInput");
      if (bgPicker) bgPicker.value = isDark ? "#1c1c1e" : "#f3f4f6";
    }
    this.applyBgTheme(this.currentBg, isDark);
    this.updateColorSelectionUI("accent", this.currentAccent, false);
    this.updateColorSelectionUI("bg", this.currentBg, false);
    if (useTransition)
      requestAnimationFrame(() =>
        document.body.classList.remove("is-updating-theme"),
      );
  },

  renderColorSection(type) {
    const isAccent = type === "accent";
    const container = $(
      isAccent ? "accent-colors-container" : "bg-colors-container",
    );
    if (!container) return;

    const scrollLeft = container.scrollLeft;
    container.innerHTML = "";

    const standardColors = isAccent
      ? this.standardAccentColors
      : this.standardBgColors;
    const customColors = isAccent
      ? this.customAccentColors
      : this.customBgColors;

    const fragment = document.createDocumentFragment();
    [...standardColors, ...customColors].forEach((color) => {
      const isCustom = customColors.includes(color);
      fragment.appendChild(this._createColorButtonEl(color, isCustom));
    });

    const pickerId = isAccent ? "customColorInput" : "customBgInput";
    const pickerHTML = `<div class="relative w-9 h-9 shrink-0 group rounded-full overflow-hidden border border-black/20 dark:border-white/20 transition-transform active:scale-90 focus-within:ring-2 focus-within:ring-[var(--primary-color)] focus-within:ring-offset-2 focus-within:ring-offset-surface"><div class="absolute inset-0 bg-[conic-gradient(from_0deg,red,orange,yellow,green,blue,indigo,violet,red)] opacity-90 group-hover:opacity-100 transition-opacity pointer-events-none z-0"></div><input type="color" id="${pickerId}" aria-label="${t("add_color")}" class="absolute inset-0 w-[150%] h-[150%] -top-1 -left-1 opacity-0 cursor-pointer z-10" /></div>`;
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = pickerHTML;
    fragment.appendChild(tempDiv.firstChild);

    container.appendChild(fragment);
    const activeColor = isAccent ? this.currentAccent : this.currentBg;
    this.updateColorSelectionUI(type, activeColor, false);
    container.scrollLeft = scrollLeft;
  },

  deleteCustomColor(type, color) {
    const isAccent = type === "accent";
    let customColors = isAccent ? this.customAccentColors : this.customBgColors;
    const key = isAccent ? "custom_accent_colors" : "custom_bg_colors";
    const index = customColors.indexOf(color);
    if (index > -1) {
      customColors.splice(index, 1);
      isAccent
        ? (this.customAccentColors = customColors)
        : (this.customBgColors = customColors);
      safeSetLS(key, JSON.stringify(customColors));
    }
  },

  addCustomColor(type, color) {
    const isAccent = type === "accent";
    const customColors = isAccent
      ? this.customAccentColors
      : this.customBgColors;

    if (customColors.length >= MAX_CUSTOM_COLORS) {
      showToast(isAccent ? t("accent_limit_msg") : t("bg_limit_msg"));
      return;
    }

    const allColors = [
      ...(isAccent ? this.standardAccentColors : this.standardBgColors),
      ...customColors,
    ];

    if (!allColors.includes(color)) {
      customColors.push(color);
      const key = isAccent ? "custom_accent_colors" : "custom_bg_colors";
      safeSetLS(key, JSON.stringify(customColors));
      this.renderColorSection(type);
      isAccent ? this.setColor(color, true) : this.setBgColor(color, true);
    }
  },

  setColor(hex, showAction = true, doScroll = true) {
    this.currentAccent = hex;
    safeSetLS("theme_color", hex);
    document.documentElement.style.setProperty("--primary-color", hex);
    const { h } = this.hexToHSL(hex);
    document.documentElement.style.setProperty("--accent-h", h);
    const picker = $("customColorInput");
    if (picker) picker.value = hex;
    this.updateColorSelectionUI("accent", hex, doScroll);
    if (showAction) this._handleActionButtonLogic("accent", hex);
  },

  setBgColor(hex, showAction = true, doScroll = true) {
    this.currentBg = hex;
    safeSetLS("theme_bg_color", hex);
    const isDark = document.documentElement.classList.contains("dark");
    this.applyBgTheme(hex, isDark);
    const picker = $("customBgInput");
    if (picker)
      picker.value = hex === "default" ? (isDark ? "#1c1c1e" : "#f3f4f6") : hex;
    this.updateColorSelectionUI("bg", hex, doScroll);
    if (showAction) this._handleActionButtonLogic("bg", hex);
  },

  resetSettings() {
    const themeKeys = [
      "theme_mode",
      "theme_color",
      "theme_bg_color",
      "font_size",
      "app_adaptive_bg",
      "app_vignette",
      "app_vignette_alpha",
      "app_liquid_glass",
      "app_hide_nav_labels",
      "app_ring_width",
      "app_show_ms",
      "app_sw_minute_beep",
    ];
    themeKeys.forEach(safeRemoveLS);
    this.applySettings();
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
    const a = [r, g, b].map((v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
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
      document.documentElement.style.setProperty(
        "--vignette-alpha",
        this.vignetteAlpha * 0.4,
      );
      requestAnimationFrame(() => {
        this.updateSliderLabel(
          "vignetteSlider",
          "vignette-label",
          this.vignetteLabels,
        );
      });
    } else {
      bg.classList.remove("has-vignette");
    }
  },

  updateVibroSliderUI(isEnabled) {
    const container = $("vibro-level-container");
    if (container) {
      container.classList.toggle("hidden", !isEnabled);
      container.classList.toggle("flex", isEnabled);
      if (isEnabled) {
        requestAnimationFrame(() => {
          this.updateSliderLabel(
            "vibroSlider",
            "vibro-label",
            this.vibroLabels,
          );
        });
      }
    }
  },

  updateGlass() {
    document.documentElement.classList.toggle(
      "glass-effect",
      this.isLiquidGlass,
    );
  },

  updateAdaptiveClass() {
    document.documentElement.classList.toggle(
      "no-adaptive",
      !this.isAdaptiveBg,
    );
  },

  hexToRGB(H) {
    if (!H || !H.startsWith("#")) return { r: 0, g: 0, b: 0 };
    let r = 0,
      g = 0,
      b = 0;
    if (H.length == 4) {
      r = parseInt(H[1] + H[1], 16);
      g = parseInt(H[2] + H[2], 16);
      b = parseInt(H[3] + H[3], 16);
    } else if (H.length == 7) {
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

  setFontSize(s) {
    const n = Number(s);
    const c = n / 16;
    document.documentElement.style.setProperty("--font-scale", c);
    if ($("fontSizeDisplay")) $("fontSizeDisplay").textContent = n + " px";
    safeSetLS("font_size", n);
  },

  applyNavLabelsVisibility() {
    document.body.classList.toggle("hide-nav-labels", this.hideNavLabels);
  },

  setRingWidth(w) {
    const n = Number(w);
    this.ringWidth = n;
    document.documentElement.style.setProperty("--ring-stroke-width", n);
    if ($("ringWidthDisplay")) {
      $("ringWidthDisplay").textContent = `${n.toFixed(1)} px`;
    }
    safeSetLS("app_ring_width", n);
  },
};
