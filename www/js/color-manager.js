// Файл: www/js/color-manager.js

import { $, safeGetLS, safeSetLS, showToast, createSVGIcon, getLuminance, hexToRGB } from "./utils.js?v=VERSION";
import { t } from "./i18n.js?v=VERSION";
import { sm } from "./sound.js?v=VERSION";

const MAX_CUSTOM_COLORS = 50;
const LONG_PRESS_DURATION = 500;

export const colorManager = {
  customAccentColors: [],
  customBgColors: [],
  activeActionTarget: null,
  longPressTimer: null,

  standardAccentColors: ["#22c55e", "#3b82f6", "#a855f7", "#ec4899", "#f97316", "#ef4444", "#6366f1", "#e11d48"],
  standardBgColors: ["default", "#60a5fa", "#c084fc", "#f472b6", "#34d399", "#facc15", "#f87171", "#2dd4bf"],

  init() {
    this.loadColors();
    this.populateColorSection("accent");
    this.populateColorSection("bg");
    this._bindEvents();
  },

  loadColors() {
    try {
      this.customAccentColors = JSON.parse(safeGetLS("custom_accent_colors")) || [];
      this.customBgColors = JSON.parse(safeGetLS("custom_bg_colors")) || [];
    } catch (e) {
      this.customAccentColors = [];
      this.customBgColors = [];
    }
  },

  _bindEvents() {
    this._bindContainerEvents("accent-colors-container", "accent");
    this._bindContainerEvents("bg-colors-container", "bg");

    const setupPickerEvents = (type) => {
        const pickerId = type === 'accent' ? 'customColorInput' : 'customBgInput';
        const previewId = type === 'accent' ? 'accent-picker-preview' : 'bg-picker-preview';
        const picker = $(pickerId);
        if (!picker) return;

        picker.addEventListener("input", (e) => {
            $(previewId).style.backgroundColor = e.target.value;
            document.dispatchEvent(new CustomEvent("colorSelected", { detail: { type, color: e.target.value, fromPicker: true } }));
        });
        
        picker.addEventListener("change", (e) => {
            this._handlePickerInteraction(picker.closest('.color-picker-wrapper'), type);
        });
    };
    setupPickerEvents('accent');
    setupPickerEvents('bg');
  },
  
  _bindContainerEvents(containerId, type) {
    const container = $(containerId);
    if (!container) return;

    container.addEventListener("click", (e) => this._handleClick(e, type));
    
    container.addEventListener("contextmenu", (e) => {
        const swatch = e.target.closest('.color-swatch-wrapper[data-custom="true"]');
        if (swatch) {
            e.preventDefault();
            this._showActionButton(swatch, 'delete');
        }
    });

    let touchMoved = false;
    container.addEventListener("touchstart", (e) => {
        const swatch = e.target.closest('.color-swatch-wrapper[data-custom="true"]');
        if (swatch) {
            touchMoved = false;
            this.longPressTimer = setTimeout(() => {
                if (!touchMoved) {
                    e.preventDefault();
                    this._showActionButton(swatch, 'delete');
                }
            }, LONG_PRESS_DURATION);
        }
    }, { passive: false });

    container.addEventListener("touchmove", () => {
        touchMoved = true;
        if (this.longPressTimer) clearTimeout(this.longPressTimer);
    });

    const endTouch = () => {
        if (this.longPressTimer) clearTimeout(this.longPressTimer);
    };
    container.addEventListener("touchend", endTouch);
    container.addEventListener("touchcancel", endTouch);
  },

  _handleClick(event, type) {
    const swatch = event.target.closest(".color-swatch-wrapper");
    const pickerWrapper = event.target.closest(".color-picker-wrapper");
    const actionBtn = event.target.closest(".action-btn");

    if (actionBtn) {
        if (actionBtn.dataset.action === 'add') {
            this.addCustomColor(type, actionBtn.dataset.color);
        } else if (actionBtn.dataset.action === 'delete') {
            this._deleteColor(actionBtn.dataset.color, type);
        }
        return;
    }

    if (this.activeActionTarget && !this.activeActionTarget.contains(event.target)) {
      this._hideActionButton();
    }

    if (swatch) {
      const color = swatch.dataset.color;
      document.dispatchEvent(new CustomEvent("colorSelected", { detail: { type, color, fromPicker: false } }));
      if (swatch.dataset.custom === 'true') {
        this._showActionButton(swatch, 'delete');
      }
    } else if (pickerWrapper) {
      this._handlePickerInteraction(pickerWrapper, type);
    }
  },
  
  _handlePickerInteraction(pickerWrapper, type) {
    const isAccent = type === 'accent';
    const picker = pickerWrapper.querySelector('input[type="color"]');
    const color = picker.value.toLowerCase();
    const allColors = [
        ...(isAccent ? this.standardAccentColors : this.standardBgColors),
        ...(isAccent ? this.customAccentColors : this.customBgColors)
    ].map(c => c.toLowerCase());

    if (allColors.includes(color)) {
        this._hideActionButton();
    } else {
        this._showActionButton(pickerWrapper, 'add');
    }
  },

  _showActionButton(targetWrapper, action) {
    if (this.activeActionTarget && this.activeActionTarget !== targetWrapper) {
        this._hideActionButton();
    }
    if (this.activeActionTarget === targetWrapper) return;

    sm.vibrate(30, "medium");
    this.activeActionTarget = targetWrapper;
    
    const color = (action === 'add')
        ? targetWrapper.querySelector('input[type="color"]').value
        : targetWrapper.dataset.color;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.action = action;
    btn.dataset.color = color;
    btn.className = "action-btn absolute -top-2.5 -right-2.5 w-7 h-7 flex items-center justify-center rounded-full text-white shadow-lg focus:outline-none custom-focus active:scale-90 transition-all z-30";
    btn.style.animation = 'fadeInScale 0.2s cubic-bezier(0.4, 0, 0.2, 1) both';

    if (action === 'add') {
        btn.setAttribute("aria-label", t("add_color"));
        btn.classList.add("bg-green-500");
        btn.append(createSVGIcon("M12 4.5v15m7.5-7.5h-15", ["w-4", "h-4"]));
    } else {
        btn.setAttribute("aria-label", `${t("delete")} ${color}`);
        btn.classList.add("bg-red-500");
        btn.append(createSVGIcon("M6 18L18 6M6 6l12 12", ["w-4", "h-4"]));
    }
    
    targetWrapper.append(btn);
  },

  _hideActionButton() {
    if (!this.activeActionTarget) return;
    const btn = this.activeActionTarget.querySelector(".action-btn");
    if (btn) {
      btn.style.animation = 'fadeOutScale 0.2s cubic-bezier(0.4, 0, 0.2, 1) both';
      btn.addEventListener("animationend", () => btn.remove(), { once: true });
    }
    this.activeActionTarget = null;
  },
  
  addCustomColor(type, color) {
    this._hideActionButton();
    const isAccent = type === "accent";
    const customColors = isAccent ? this.customAccentColors : this.customBgColors;
    const standardColors = isAccent ? this.standardAccentColors : this.standardBgColors;
    
    const normalizedColor = color.toLowerCase();
    
    if ([...standardColors, ...customColors].map(c => c.toLowerCase()).includes(normalizedColor)) {
        showToast(t("color_already_exists"));
        return; 
    }

    if (customColors.length >= MAX_CUSTOM_COLORS) {
      showToast(t(isAccent ? "accent_limit_msg" : "bg_limit_msg"));
      return;
    }

    sm.vibrate(40, "medium");
    customColors.push(normalizedColor);
    safeSetLS(isAccent ? "custom_accent_colors" : "custom_bg_colors", JSON.stringify(customColors));
    this._addColorToDOM(normalizedColor, type);
    document.dispatchEvent(new CustomEvent("colorSelected", { detail: { type, color: normalizedColor, fromPicker: false } }));
  },

  _deleteColor(color, type) {
    sm.vibrate(40, "medium");
    this._hideActionButton();
    const isAccent = type === 'accent';
    const container = $(isAccent ? 'accent-colors-container' : 'bg-colors-container');
    const wrapper = container.querySelector(`.color-swatch-wrapper[data-color="${color}"]`);

    if (wrapper) {
      document.dispatchEvent(new CustomEvent('colorDeleted', { detail: { type, color } }));

      wrapper.classList.add("is-collapsing");
      wrapper.addEventListener("transitionend", () => {
        wrapper.remove();
        let customColors = isAccent ? this.customAccentColors : this.customBgColors;
        const index = customColors.map(c => c.toLowerCase()).indexOf(color.toLowerCase());
        if (index > -1) {
          customColors.splice(index, 1);
          safeSetLS(isAccent ? 'custom_accent_colors' : 'custom_bg_colors', JSON.stringify(customColors));
        }
      }, { once: true });
    }
  },

  populateColorSection(type) {
    const container = $(type === "accent" ? "accent-colors-container" : "bg-colors-container");
    if (!container) return;

    container.querySelectorAll('.color-swatch-wrapper').forEach(el => el.remove());
    
    const isAccent = type === "accent";
    const colors = isAccent ? [...this.standardAccentColors, ...this.customAccentColors] : [...this.standardBgColors, ...this.customBgColors];
    const picker = container.querySelector('.color-picker-wrapper');

    colors.forEach(color => {
        const isCustom = (isAccent ? this.customAccentColors : this.customBgColors).includes(color);
        const swatch = this._createColorSwatch(color, isCustom);
        if (picker) {
            container.insertBefore(swatch, picker);
        } else {
            container.appendChild(swatch);
        }
    });
  },
  
  _createColorSwatch(color, isCustom) {
    const wrapper = document.createElement("div");
    wrapper.className = "color-swatch-wrapper relative rounded-full";
    wrapper.dataset.color = color;
    wrapper.dataset.custom = isCustom;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "color-btn w-9 h-9 flex items-center justify-center rounded-full shrink-0 transition-transform active:scale-90 border border-black/20 dark:border-white/20 focus:outline-none custom-focus";
    button.setAttribute("aria-label", color === 'default' ? t('default_color') : color);

    if (color === "default") button.classList.add("default-bg-btn");
    else button.style.backgroundColor = color;
    
    wrapper.append(button);
    return wrapper;
  },

  _addColorToDOM(color, type) {
    const swatch = this._createColorSwatch(color, true);
    const container = $(type === "accent" ? "accent-colors-container" : "bg-colors-container");
    const picker = container.querySelector(".color-picker-wrapper");
    if (picker) {
        container.insertBefore(swatch, picker);
    } else {
        container.append(swatch);
    }
  },

  updateSelectionUI(type, color, doScroll = true) {
    const container = $(type === 'accent' ? 'accent-colors-container' : 'bg-colors-container');
    if (!container) return;

    container.querySelectorAll('.color-swatch-wrapper').forEach(el => {
        el.classList.remove('ring-[var(--primary-color)]', 'ring-2', 'ring-offset-2', 'ring-offset-surface');
        el.querySelector('.injected-checkmark')?.remove();
    });
    
    const normalizedColor = color.toLowerCase();
    const activeWrapper = container.querySelector(`.color-swatch-wrapper[data-color="${normalizedColor}"]`);
    
    if (activeWrapper) {
      activeWrapper.classList.add('ring-[var(--primary-color)]', 'ring-2', 'ring-offset-2', 'ring-offset-surface');
      
      const isDefault = normalizedColor === 'default';
      const isDark = document.documentElement.classList.contains('dark');
      const luminance = isDefault ? (isDark ? 0 : 1) : getLuminance(...Object.values(hexToRGB(normalizedColor)));
      const iconColor = luminance > 0.5 ? '#1f2937' : '#ffffff';

      const svgIcon = createSVGIcon("M4.5 12.75l6 6 9-13.5", ["w-5", "h-5", "injected-checkmark"]);
      svgIcon.style.color = iconColor;
      
      activeWrapper.querySelector('.color-btn')?.append(svgIcon);

      if (doScroll) {
        activeWrapper.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  },

  syncPickers(accentColor, bgColor) {
      const accentPicker = $('customColorInput');
      if (accentPicker) accentPicker.value = accentColor;
      $('accent-picker-preview').style.backgroundColor = accentColor;
      
      const bgPicker = $('customBgInput');
      const finalBg = bgColor.startsWith('#') ? bgColor : (document.documentElement.classList.contains('dark') ? '#000000' : '#f3f4f6');
      if (bgPicker) bgPicker.value = finalBg;
      $('bg-picker-preview').style.backgroundColor = finalBg;
  }
};