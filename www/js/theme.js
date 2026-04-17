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

  _createSVG(paths, strokeWidth = "2.5") {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "w-5 h-5");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("stroke-width", strokeWidth);

    paths.forEach((d) => {
      const path = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path",
      );
      path.setAttribute("stroke-linecap", "round");
      path.setAttribute("stroke-linejoin", "round");
      path.setAttribute("d", d);
      svg.appendChild(path);
    });
    return svg;
  },

  _createColorButtonEl(color, isCustom) {
    const wrapper = document.createElement("div");
    wrapper.className = "custom-color-wrapper shrink-0 rounded-full";
    wrapper.dataset.color = color;
    wrapper.dataset.custom = String(isCustom);

    const button = document.createElement("button");
    button.type = "button";
    button.className =
      "color-btn w-9 h-9 flex items-center justify-center rounded-full shrink-0 transition-all duration-200 active:scale-90 border border-black/20 dark:border-white/20 focus:outline-none custom-focus";
    button.setAttribute("aria-label", color);

    if (color === "default") {
      button.classList.add("default-bg-btn");
      button.setAttribute("aria-label", t("default_color"));
    } else {
      button.style.backgroundColor = color;
    }
    wrapper.appendChild(button);
    return wrapper;
  },

  _removeActionButton(container) {
    const actionBtn = container.querySelector(".color-action-btn.is-visible");
    if (actionBtn) {
      actionBtn.classList.remove("is-visible");
      actionBtn.addEventListener("transitionend", () => actionBtn.remove(), {
        once: true,
      });
    }
  },

  _handleActionButtonLogic(type, hex) {
    const isAccent = type === "accent";
    const container = $(
      isAccent ? "accent-colors-container" : "bg-colors-container",
    );
    if (!container) return;

    const activeWrapper = container.querySelector(
      `.custom-color-wrapper.is-active`,
    );
    if (!activeWrapper) return;

    if (
      activeWrapper.previousElementSibling?.classList.contains(
        "color-action-btn",
      )
    ) {
      return;
    }

    this._removeActionButton(container);

    const customColors = isAccent
      ? this.customAccentColors
      : this.customBgColors;
    const isAlreadyCustom = customColors.includes(hex);
    const isCustomPicker = activeWrapper.matches(
      ".custom-color-picker-wrapper",
    );

    let action = null;
    let svgIcon = null;
    let ariaLabel = "";
    let btnClass = "";

    if (isAlreadyCustom && !isCustomPicker) {
      action = "delete";
      svgIcon = this._createSVG(["M19.5 12h-15"]);
      ariaLabel = t("delete");
      btnClass = "bg-red-500/10 text-red-500 hover:bg-red-500/20";
    } else if (
      isCustomPicker &&
      !customColors.includes(activeWrapper.dataset.color)
    ) {
      action = "add";
      svgIcon = this._createSVG(["M12 4.5v15m7.5-7.5h-15"]);
      ariaLabel = t("add_color");
      btnClass = "bg-green-500/10 text-green-500 hover:bg-green-500/20";
    }

    if (action) {
      const actionBtnWrapper = document.createElement("div");
      actionBtnWrapper.className = "color-action-btn";

      const button = document.createElement("button");
      button.type = "button";
      button.dataset.action = action;
      button.setAttribute("aria-label", ariaLabel);
      button.className = `w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-full focus:outline-none custom-focus transition-colors ${btnClass}`;
      button.appendChild(svgIcon);

      actionBtnWrapper.appendChild(button);
      activeWrapper.before(actionBtnWrapper);

      requestAnimationFrame(() => {
        actionBtnWrapper.classList.add("is-visible");
      });
    }
  },

  updateColorSelectionUI(type, hex, doScroll = true) {
    const isAccent = type === "accent";
    const container = $(
      isAccent ? "accent-colors-container" : "bg-colors-container",
    );
    if (!container) return;

    container.querySelectorAll(".custom-color-wrapper").forEach((el) => {
      el.classList.remove("is-active");
      const btn = el.querySelector("button");
      if (btn && btn.dataset.iconAdded) {
        btn.innerHTML = "";
        delete btn.dataset.iconAdded;
      }
    });

    const activeWrapper = container.querySelector(
      `.custom-color-wrapper[data-color="${hex}"]`,
    );
    if (activeWrapper) {
      activeWrapper.classList.add("is-active");
      const button = activeWrapper.querySelector("button");
      if (button && !activeWrapper.matches(".custom-color-picker-wrapper")) {
        const lum = this.getLuminance(
          ...Object.values(
            this.hexToRGB(
              hex === "default" ? (this.isDark() ? "#1c1c1e" : "#f3f4f6") : hex,
            ),
          ),
        );
        const iconColor = lum > 0.4 ? "#1f2937" : "#ffffff";
        const checkmarkSVG = this._createSVG(["M4.5 12.75l6 6 9-13.5"]);
        checkmarkSVG.style.color = iconColor;
        button.appendChild(checkmarkSVG);
        button.dataset.iconAdded = "true";
      }

      if (doScroll) {
        activeWrapper.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
          inline: "center",
        });
      }
    }
  },

  handleColorClick(event, type) {
    const target = event.target;
    const isAccent = type === "accent";

    const actionBtn = target.closest(".color-action-btn button");
    if (actionBtn) {
      sm.vibrate(40, "medium");
      const action = actionBtn.dataset.action;
      const actionBtnWrapper = actionBtn.parentElement;
      const colorSourceElement = actionBtnWrapper.nextElementSibling;

      if (action === "add" && colorSourceElement) {
        this.addCustomColor(type, colorSourceElement.dataset.color);
      } else if (action === "delete" && colorSourceElement) {
        this.deleteColorWithAnimation(
          type,
          colorSourceElement,
          actionBtnWrapper,
        );
      }
      return;
    }

    const colorWrapper = target.closest(".custom-color-wrapper");
    if (colorWrapper) {
      const color = colorWrapper.dataset.color;
      const isAlreadyActive = colorWrapper.classList.contains("is-active");
      const hasActionButton =
        colorWrapper.previousElementSibling?.classList.contains(
          "color-action-btn",
        );

      sm.vibrate(20, "light");

      if (isAlreadyActive && hasActionButton) {
        this._removeActionButton(colorWrapper.parentElement);
      } else {
        isAccent
          ? this.setColor(color, true, true)
          : this.setBgColor(color, true, true);
      }
    }
  },

  deleteColorWithAnimation(type, colorWrapper, actionWrapper) {
    const isAccent = type === "accent";
    const colorToDelete = colorWrapper.dataset.color;

    actionWrapper.classList.add("is-deleting");
    colorWrapper.classList.add("is-deleting");

    setTimeout(() => {
      actionWrapper.classList.add("is-collapsing");
      colorWrapper.classList.add("is-collapsing");
    }, 150);

    colorWrapper.addEventListener(
      "transitionend",
      (e) => {
        if (e.propertyName !== "max-width") return;

        actionWrapper.remove();
        colorWrapper.remove();
        this.deleteCustomColor(type, colorToDelete);

        const currentSelected = isAccent ? this.currentAccent : this.currentBg;
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
  },

  addCustomColor(type, color) {
    const isAccent = type === "accent";
    const customColors = isAccent
      ? this.customAccentColors
      : this.customBgColors;
    const container = $(
      isAccent ? "accent-colors-container" : "bg-colors-container",
    );
    const pickerWrapper = container.querySelector(
      ".custom-color-picker-wrapper",
    );

    if (customColors.length >= MAX_CUSTOM_COLORS) {
      showToast(isAccent ? t("accent_limit_msg") : t("bg_limit_msg"));
      return;
    }
    if (customColors.includes(color)) {
      this._removeActionButton(container);
      return;
    }

    customColors.push(color);
    const key = isAccent ? "custom_accent_colors" : "custom_bg_colors";
    safeSetLS(key, JSON.stringify(customColors));

    const newEl = this._createColorButtonEl(color, true);
    container.insertBefore(newEl, pickerWrapper);

    newEl.classList.add("is-newly-added");
    requestAnimationFrame(() => newEl.classList.remove("is-newly-added"));

    this._removeActionButton(container);
    pickerWrapper.classList.remove("has-custom-color");

    isAccent
      ? this.setColor(color, true, true)
      : this.setBgColor(color, true, true);
  },

  setColor(hex, showAction = false, doScroll = true) {
    const isChanging = this.currentAccent !== hex;
    this.currentAccent = hex;
    safeSetLS("theme_color", hex);
    document.documentElement.style.setProperty("--primary-color", hex);
    const { h } = this.hexToHSL(hex);
    document.documentElement.style.setProperty("--accent-h", h);
    this.updateColorSelectionUI("accent", hex, doScroll);

    const pickerWrapper = $("accent-colors-container")?.querySelector(
      ".custom-color-picker-wrapper",
    );
    if (pickerWrapper) {
      const isStandard = this.standardAccentColors.includes(hex);
      if (!isStandard) {
        pickerWrapper.classList.add("has-custom-color");
        pickerWrapper.style.setProperty("--custom-picker-bg", hex);
      } else {
        pickerWrapper.classList.remove("has-custom-color");
      }
    }

    if (showAction) this._handleActionButtonLogic("accent", hex);
    else if (isChanging) this._removeActionButton($("accent-colors-container"));
  },

  setBgColor(hex, showAction = false, doScroll = true) {
    const isChanging = this.currentBg !== hex;
    this.currentBg = hex;
    safeSetLS("theme_bg_color", hex);
    this.applyBgTheme(hex, this.isDark());
    this.updateColorSelectionUI("bg", hex, doScroll);

    const pickerWrapper = $("bg-colors-container")?.querySelector(
      ".custom-color-picker-wrapper",
    );
    if (pickerWrapper) {
      const isStandard = this.standardBgColors.includes(hex);
      if (!isStandard) {
        pickerWrapper.classList.add("has-custom-color");
        pickerWrapper.style.setProperty("--custom-picker-bg", hex);
      } else {
        pickerWrapper.classList.remove("has-custom-color");
      }
    }

    if (showAction) this._handleActionButtonLogic("bg", hex);
    else if (isChanging) this._removeActionButton($("bg-colors-container"));
  },

  isDark() {
    return document.documentElement.classList.contains("dark");
  },

  setMode(mode) {
    this._internalSetMode(mode, true);
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

    const setupPickerListeners = (pickerId, handler) => {
      const picker = $(pickerId);
      if (picker) {
        const pickerWrapper = picker.closest(".custom-color-picker-wrapper");
        picker.addEventListener("input", (e) => {
          pickerWrapper.dataset.color = e.target.value;
          handler(e.target.value, true, false);
        });
        picker.addEventListener("change", (e) => {
          pickerWrapper.dataset.color = e.target.value;
          handler(e.target.value, true, true);
        });
      }
    };
    setupPickerListeners("customColorInput", this.setColor.bind(this));
    setupPickerListeners("customBgInput", this.setBgColor.bind(this));

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
    if (labelsArray[val]) {
      label.textContent = t(labelsArray[val]);
    }
    const min = parseFloat(slider.min);
    const max = parseFloat(slider.max);
    if (isNaN(val) || isNaN(min) || isNaN(max)) return;
    const percent = max - min > 0 ? (val - min) / (max - min) : 0;
    const thumbWidth = 24;
    const trackWidth = slider.offsetWidth;
    if (trackWidth === 0) return;
    const offset = thumbWidth / 2 - percent * thumbWidth;
    label.style.left = `calc(${percent * 100}% + ${offset}px)`;
  },

  renderColorSection(type) {
    const isAccent = type === "accent";
    const container = $(
      isAccent ? "accent-colors-container" : "bg-colors-container",
    );
    if (!container) return;

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
    const pickerWrapper = document.createElement("div");
    pickerWrapper.className =
      "custom-color-wrapper custom-color-picker-wrapper w-9 h-9 shrink-0 group rounded-full overflow-hidden border border-black/20 dark:border-white/20 relative";

    const bgLayer = document.createElement("div");
    bgLayer.className =
      "custom-color-bg-layer absolute inset-0 transition-colors duration-200";
    bgLayer.style.backgroundImage =
      "conic-gradient(from 0deg, red, orange, yellow, green, blue, indigo, violet, red)";

    const input = document.createElement("input");
    input.type = "color";
    input.id = pickerId;
    input.setAttribute("aria-label", t("add_color"));
    input.className =
      "absolute inset-[-10px] opacity-0 cursor-pointer z-10 w-[calc(100%+20px)] h-[calc(100%+20px)]";

    pickerWrapper.append(bgLayer, input);
    fragment.appendChild(pickerWrapper);

    container.appendChild(fragment);

    const activeColor = isAccent ? this.currentAccent : this.currentBg;
    const pickerColor = isAccent
      ? this.currentAccent
      : this.currentBg === "default"
        ? this.isDark()
          ? "#1c1c1e"
          : "#ffffff"
        : this.currentBg;

    if (pickerWrapper) pickerWrapper.dataset.color = pickerColor;
    input.value = pickerColor;

    this.updateColorSelectionUI(type, activeColor, false);
  },

  deleteCustomColor(type, color) {
    const isAccent = type === "accent";
    let customColors = isAccent ? this.customAccentColors : this.customBgColors;
    const key = isAccent ? "custom_accent_colors" : "custom_bg_colors";
    const index = customColors.indexOf(color);
    if (index > -1) {
      customColors.splice(index, 1);
      if (isAccent) this.customAccentColors = customColors;
      else this.customBgColors = customColors;
      safeSetLS(key, JSON.stringify(customColors));
    }
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
      "custom_accent_colors",
      "custom_bg_colors",
    ];
    themeKeys.forEach(safeRemoveLS);
    this.applySettings();
  },

  init() {
    this.applySettings();
    this.bindEvents();
  },

  applySettings() {
    try {
      this.customAccentColors =
        JSON.parse(safeGetLS("custom_accent_colors")) || [];
      this.customBgColors = JSON.parse(safeGetLS("custom_bg_colors")) || [];
    } catch (e) {
      this.customAccentColors = [];
      this.customBgColors = [];
    }

    this.renderColorSection("accent");
    this.renderColorSection("bg");

    this._internalSetMode(safeGetLS("theme_mode") || "system", false);

    this.currentAccent =
      safeGetLS("theme_color") || this.standardAccentColors[0];
    this.setColor(this.currentAccent, false, false);

    this.currentBg = safeGetLS("theme_bg_color") || "default";
    this.setBgColor(this.currentBg, false, false);

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

    this.syncSliderUIs(); // Вызов недостающей функции
  },

  // ++ ДОБАВЛЕНА НЕДОСТАЮЩАЯ ФУНКЦИЯ ++
  syncSliderUIs() {
    // Обновляем метку для слайдера виньетирования
    if ($("vignetteSlider")) {
      this.updateSliderLabel(
        "vignetteSlider",
        "vignette-label",
        this.vignetteLabels,
      );
    }
    // Обновляем метку для слайдера вибрации
    if ($("vibroSlider")) {
      this.updateSliderLabel("vibroSlider", "vibro-label", this.vibroLabels);
    }
    // Обновляем отображение размера шрифта
    if ($("fontSlider") && $("fontSizeDisplay")) {
      $("fontSizeDisplay").textContent = ($("fontSlider").value || 16) + " px";
    }
    // Обновляем отображение толщины кольца
    if ($("ringWidthSlider") && $("ringWidthDisplay")) {
      const value = Number($("ringWidthSlider").value || 4);
      $("ringWidthDisplay").textContent = `${value.toFixed(1)} px`;
    }
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
    this.applyBgTheme(this.currentBg, isDark);
    this.updateColorSelectionUI("accent", this.currentAccent, false);
    this.updateColorSelectionUI("bg", this.currentBg, false);
    if (useTransition)
      requestAnimationFrame(() =>
        document.body.classList.remove("is-updating-theme"),
      );
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
      document.body.classList.toggle("force-light-text", luminance < 0.4);
      document.body.classList.toggle("force-dark-text", luminance >= 0.4);
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
      requestAnimationFrame(() =>
        this.updateSliderLabel(
          "vignetteSlider",
          "vignette-label",
          this.vignetteLabels,
        ),
      );
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
        requestAnimationFrame(() =>
          this.updateSliderLabel(
            "vibroSlider",
            "vibro-label",
            this.vibroLabels,
          ),
        );
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
