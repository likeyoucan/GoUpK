// Файл: www/js/theme.js

import { $, safeGetLS, safeSetLS, safeRemoveLS } from "./utils.js?v=VERSION";
import { t } from "./i18n.js?v=VERSION";
import { sm } from "./sound.js?v=VERSION";

export const themeManager = {
  currentMode: "system",
  currentBg: "default",
  showMs: true,
  isAdaptiveBg: true,
  hasVignette: false,
  isLiquidGlass: false,
  hideNavLabels: false,
  vignetteAlpha: 0.5,
  ringWidth: 4,
  swMinuteBeep: true,

  standardAccentColors: ["#22c55e", "#3b82f6", "#a855f7", "#ec4899", "#f97316", "#ef4444", "#6366f1", "#e11d48"],
  standardBgColors: ["default", "#60a5fa", "#c084fc", "#f472b6", "#34d399", "#facc15", "#f87171", "#2dd4bf"],
  customAccentColors: [],
  customBgColors: [],

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
    
    this.renderColorSection('accent');
    this.renderColorSection('bg');

    this.setMode(safeGetLS("theme_mode") || "system");
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
    if ($("vignetteSlider")) $("vignetteSlider").value = this.vignetteAlpha;
    if ($("fontSlider")) $("fontSlider").value = safeGetLS("font_size") || 16;
    if ($("ringWidthSlider")) $("ringWidthSlider").value = safeGetLS("app_ring_width") || 4;
  },

  bindEvents() {
    $("toggle-sw-minute-beep")?.addEventListener("change", e => { this.swMinuteBeep = e.target.checked; safeSetLS("app_sw_minute_beep", this.swMinuteBeep); });
    $("toggle-ms")?.addEventListener("change", e => { this.showMs = e.target.checked; safeSetLS("app_show_ms", this.showMs); document.dispatchEvent(new CustomEvent("msChanged")); });
    $("toggle-adaptive-bg")?.addEventListener("change", e => { this.isAdaptiveBg = e.target.checked; safeSetLS("app_adaptive_bg", this.isAdaptiveBg); this.updateAdaptiveClass(); this.applyBgTheme(this.currentBg, document.documentElement.classList.contains("dark")); });
    $("toggle-glass")?.addEventListener("change", e => { this.isLiquidGlass = e.target.checked; safeSetLS("app_liquid_glass", this.isLiquidGlass); this.updateGlass(); });
    $("toggle-vignette")?.addEventListener("change", e => { this.hasVignette = e.target.checked; safeSetLS("app_vignette", this.hasVignette); this.updateVignette(); });
    $("toggle-nav-labels")?.addEventListener("change", e => { this.hideNavLabels = e.target.checked; safeSetLS("app_hide_nav_labels", this.hideNavLabels); this.applyNavLabelsVisibility(); });

    $("vignetteSlider")?.addEventListener("input", e => { sm.vibrate(10); this.vignetteAlpha = parseFloat(e.target.value); safeSetLS("app_vignette_alpha", this.vignetteAlpha); this.updateVignette(); });
    $("fontSlider")?.addEventListener("input", e => { sm.vibrate(10); this.setFontSize(e.target.value); });
    $("ringWidthSlider")?.addEventListener("input", e => { sm.vibrate(10); this.setRingWidth(e.target.value); });

    document.querySelectorAll('[id^="theme-"]').forEach(btn => btn.addEventListener("click", e => this.setMode(e.currentTarget.getAttribute("data-theme-mode"))));

    $("accent-colors-container")?.addEventListener("click", e => this.handleColorClick(e, 'accent'));
    $("bg-colors-container")?.addEventListener("click", e => this.handleColorClick(e, 'bg'));

    // [ИЗМЕНЕНИЕ] Логика для color picker
    $("customColorInput")?.addEventListener("input", e => { this.setColor(e.target.value); this.checkAndShowAddButton('accent', e.target.value); });
    $("customBgInput")?.addEventListener("input", e => { this.setBgColor(e.target.value); this.checkAndShowAddButton('bg', e.target.value); });
    
    // [ИЗМЕНЕНИЕ] Обработчики для кнопок "+"
    $("add-accent-color-btn")?.addEventListener("click", () => this.addCustomColor('accent', $('customColorInput').value));
    $("add-bg-color-btn")?.addEventListener("click", () => this.addCustomColor('bg', $('customBgInput').value));

    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { if (this.currentMode === "system") this.setMode("system"); });
  },
  
  handleColorClick(event, type) {
    const target = event.target;
    
    const colorBtn = target.closest('.color-btn');
    if (colorBtn) {
      const color = colorBtn.dataset.color;
      type === 'accent' ? this.setColor(color) : this.setBgColor(color);
      this.checkAndShowAddButton(type, color); // Скрываем "+" если выбрали существующий цвет
      return;
    }
    
    const deleteBtn = target.closest('.delete-color-btn');
    if (deleteBtn) {
      event.stopPropagation();
      const color = deleteBtn.dataset.color;
      this.deleteCustomColor(type, color);
    }
  },

  renderColorSection(type) {
    const isAccent = type === 'accent';
    const container = $(isAccent ? 'accent-colors-container' : 'bg-colors-container');
    if (!container) return;

    container.querySelectorAll('.custom-color-wrapper').forEach(el => el.remove());
    
    const standardColors = isAccent ? this.standardAccentColors : this.standardBgColors;
    const customColors = isAccent ? this.customAccentColors : this.customBgColors;
    const pickerEl = container.querySelector('.relative');
    
    [...standardColors, ...customColors].forEach(color => {
      const isCustom = customColors.includes(color);
      pickerEl.insertAdjacentHTML('beforebegin', this._createColorButtonHTML(color, isCustom));
    });
  },

  _createColorButtonHTML(color, isCustom) {
    const deleteBtn = isCustom ? `<button type="button" data-color="${color}" class="delete-color-btn absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs font-bold shadow-md opacity-0 group-hover:opacity-100 transition-opacity z-10">×</button>` : '';
    const btnClasses = color === 'default' ? 'bg-btn default-bg-btn' : 'bg-btn';
    const bgStyle = color !== 'default' ? `background-color: ${color};` : '';
    
    return `
      <div class="custom-color-wrapper relative group">
        <button type="button" aria-label="Color ${color}" data-color="${color}" style="${bgStyle}"
                class="color-btn w-9 h-9 flex items-center justify-center rounded-full shrink-0 transition-transform active:scale-90 border border-black/20 dark:border-white/20 focus:outline-none custom-focus ${btnClasses}">
        </button>
        ${deleteBtn}
      </div>`;
  },
  
  // [ИЗМЕНЕНИЕ] Функция для управления видимостью кнопки "+"
  checkAndShowAddButton(type, color) {
    const isAccent = type === 'accent';
    const addBtn = $(isAccent ? 'add-accent-color-btn' : 'add-bg-color-btn');
    if (!addBtn) return;

    const allColors = [...(isAccent ? this.standardAccentColors : this.standardBgColors), ...(isAccent ? this.customAccentColors : this.customBgColors)];
    const isNewColor = !allColors.includes(color);

    addBtn.classList.toggle('hidden', !isNewColor);
    addBtn.classList.toggle('flex', isNewColor);
  },

  addCustomColor(type, color) {
    const isAccent = type === 'accent';
    const customColors = isAccent ? this.customAccentColors : this.customBgColors;
    const allColors = [...(isAccent ? this.standardAccentColors : this.standardBgColors), ...customColors];

    if (!allColors.includes(color)) {
        customColors.push(color);
        const key = isAccent ? 'custom_accent_colors' : 'custom_bg_colors';
        safeSetLS(key, JSON.stringify(customColors));
        this.renderColorSection(type);
        isAccent ? this.setColor(color) : this.setBgColor(color);
        this.checkAndShowAddButton(type, color); // Скроет кнопку после добавления
    }
  },

  deleteCustomColor(type, color) {
    const isAccent = type === 'accent';
    let customColors = isAccent ? this.customAccentColors : this.customBgColors;
    const key = isAccent ? 'custom_accent_colors' : 'custom_bg_colors';

    const index = customColors.indexOf(color);
    if (index > -1) {
        customColors.splice(index, 1);
        if(isAccent) this.customAccentColors = customColors; else this.customBgColors = customColors;
        safeSetLS(key, JSON.stringify(customColors));
        if (safeGetLS(isAccent ? 'theme_color' : 'theme_bg_color') === color) {
          isAccent ? this.setColor(this.standardAccentColors[0]) : this.setBgColor('default');
        }
        this.renderColorSection(type);
        this.checkAndShowAddButton(type, color); // Перепроверяем состояние кнопки
    }
  },

  resetSettings() {
    const themeKeys = ["theme_mode", "theme_color", "theme_bg_color", "font_size", "app_adaptive_bg", "app_vignette", "app_vignette_alpha", "app_liquid_glass", "app_hide_nav_labels", "app_ring_width", "app_show_ms", "app_sw_minute_beep"];
    themeKeys.forEach(safeRemoveLS);
    this.applySettings();
  },

  setMode(mode) {
    this.currentMode = mode;
    safeSetLS("theme_mode", mode);
    document.querySelectorAll('[id^="theme-"]').forEach(b => { b.classList.remove("app-surface", "shadow-sm", "app-text"); b.classList.add("app-text-sec"); });
    const activeBtn = $(`theme-${mode}`);
    if (activeBtn) { activeBtn.classList.remove("app-text-sec"); activeBtn.classList.add("app-surface", "shadow-sm", "app-text"); }
    const isDark = mode === 'dark' || (mode === 'system' && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", isDark);
    document.documentElement.style.colorScheme = isDark ? "dark" : "light";
    this.applyBgTheme(this.currentBg, isDark);
    this.renderColorSection('bg');
  },

  setColor(hex) {
    safeSetLS("theme_color", hex);
    document.documentElement.style.setProperty("--primary-color", hex);
    const { h } = this.hexToHSL(hex);
    document.documentElement.style.setProperty("--accent-h", h);
    this.updateButtons(document.querySelectorAll('#accent-colors-container .color-btn, #accent-colors-container input'), hex, 'customColorInput');
    this.checkAndShowAddButton('accent', hex);
  },

  setBgColor(hex) {
    this.currentBg = hex;
    safeSetLS("theme_bg_color", hex);
    const isDark = document.documentElement.classList.contains("dark");
    this.applyBgTheme(hex, isDark);
    this.updateButtons(document.querySelectorAll('#bg-colors-container .color-btn, #bg-colors-container input'), hex, 'customBgInput');
    this.checkAndShowAddButton('bg', hex);
  },

  updateButtons(btnCollection, hex, customId) {
    let foundOnButton = false;
    btnCollection.forEach((b) => {
      const isPicker = b.type === 'color';
      const targetColor = isPicker ? b.value : b.dataset.color;
      const elementToStyle = isPicker ? b.closest('.relative') : b;
      
      elementToStyle.classList.remove("ring-[var(--primary-color)]", "ring-2", "ring-offset-2", "ring-offset-white", "dark:ring-offset-gray-900");
      if (!isPicker) elementToStyle.innerHTML = "";

      if (targetColor === hex) {
        elementToStyle.classList.add("ring-[var(--primary-color)]", "ring-2", "ring-offset-2", "ring-offset-white", "dark:ring-offset-gray-900");
        if (!isPicker) {
          const iconColor = (targetColor === "default" || this.getLuminance(...Object.values(this.hexToRGB(targetColor))) > 0.5) ? 'black' : 'white';
          elementToStyle.innerHTML = `<svg focusable="false" aria-hidden="true" class="w-5 h-5" style="color: ${iconColor};" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path></svg>`;
          foundOnButton = true;
        }
      }
    });

    const pickerWrapper = $(customId)?.closest(".relative");
    if (!pickerWrapper) return;
    
    if (!foundOnButton && hex.startsWith("#")) {
      pickerWrapper.classList.add("ring-[var(--primary-color)]", "ring-2", "ring-offset-2", "ring-offset-white", "dark:ring-offset-gray-900");
    }
  },

  // Вспомогательные функции (без изменений)
  applyBgTheme(hex, isDark) {
    const root=document.documentElement; document.body.classList.remove("force-light-text","force-dark-text");
    if(hex==="default"){if(!this.isAdaptiveBg){root.style.setProperty("--bg-color",isDark?"#000000":"#f3f4f6"); root.style.setProperty("--surface-color",isDark?"#1c1c1e":"#ffffff");}else{root.style.removeProperty("--bg-color"); root.style.removeProperty("--surface-color");}return;}
    const rgb=this.hexToRGB(hex); const {h,s,l}=this.hexToHSL(hex);
    if(!this.isAdaptiveBg){root.style.setProperty("--bg-color",hex); if(isDark){root.style.setProperty("--surface-color",`color-mix(in srgb, ${hex}, white 10%)`);}else{const mixArg=l>90?"black 5%":"white 25%"; root.style.setProperty("--surface-color",`color-mix(in srgb, ${hex}, ${mixArg})`);} const luminance=this.getLuminance(rgb.r,rgb.g,rgb.b); document.body.classList.toggle("force-light-text",luminance<0.48); document.body.classList.toggle("force-dark-text",luminance>=0.48);}
    else{const satDark=Math.min(s,40); const satLight=Math.max(s,20); if(isDark){root.style.setProperty("--bg-color",`hsl(${h} ${satDark}% 8%)`); root.style.setProperty("--surface-color",`hsl(${h} ${satDark}% 14%)`);}else{root.style.setProperty("--bg-color",`hsl(${h} ${satLight}% 94%)`); root.style.setProperty("--surface-color",`hsl(${h} ${satLight}% 98%)`);}}
  },
  getLuminance(r,g,b){const a=[r,g,b].map(v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);});return a[0]*0.2126+a[1]*0.7152+a[2]*0.0722;},
  updateVignette(){const bg=document.querySelector(".app-bg");if(!bg)return;const c=$("vignette-depth-container");if(c){c.classList.toggle("hidden",!this.hasVignette);c.classList.toggle("flex",this.hasVignette);}if(this.hasVignette){bg.classList.add("has-vignette");document.documentElement.style.setProperty("--vignette-alpha",this.vignetteAlpha*0.3);}else{bg.classList.remove("has-vignette");}},
  updateGlass(){document.documentElement.classList.toggle("glass-effect",this.isLiquidGlass);},
  updateAdaptiveClass(){document.documentElement.classList.toggle("no-adaptive",!this.isAdaptiveBg);},
  hexToRGB(H){if(!H||!H.startsWith("#"))return{r:0,g:0,b:0};let r=0,g=0,b=0;if(H.length==4){r=parseInt(H[1]+H[1],16);g=parseInt(H[2]+H[2],16);b=parseInt(H[3]+H[3],16);}else if(H.length==7){r=parseInt(H[1]+H[2],16);g=parseInt(H[3]+H[4],16);b=parseInt(H[5]+H[6],16);}return{r,g,b};},
  hexToHSL(H){if(!H||!H.startsWith("#"))return{h:142,s:50,l:50};const{r:r255,g:g255,b:b255}=this.hexToRGB(H);let r=r255/255,g=g255/255,b=b255/255;let cmin=Math.min(r,g,b),cmax=Math.max(r,g,b),delta=cmax-cmin;let h=0,s=0,l=(cmax+cmin)/2;if(delta!==0){s=delta/(1-Math.abs(2*l-1));if(cmax===r)h=((g-b)/delta)%6;else if(cmax===g)h=(b-r)/delta+2;else h=(r-g)/delta+4;}h=Math.round(h*60);if(h<0)h+=360;return{h,s:+(s*100).toFixed(1),l:+(l*100).toFixed(1)};},
  setFontSize(s){const n=Number(s);const c=n/16;document.documentElement.style.setProperty("--font-scale",c);if($("fontSizeDisplay"))$("fontSizeDisplay").textContent=n+" px";safeSetLS("font_size",n);},
  applyNavLabelsVisibility(){document.body.classList.toggle("hide-nav-labels",this.hideNavLabels);},
  setRingWidth(w){const n=Number(w);this.ringWidth=n;document.documentElement.style.setProperty("--ring-stroke-width",n);if($("ringWidthDisplay")){$("ringWidthDisplay").textContent=`${n.toFixed(1)} px`;}safeSetLS("app_ring_width",n);},
  applyMaterialYouColors(c){const s=safeGetLS("theme_color");if(s&&s!=="auto")return;const p=c.system_accent1_500;if(p){this.setColor(p);}}
};