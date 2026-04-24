import { $, safeGetLS, safeSetLS, safeRemoveLS } from "./utils.js?v=VERSION";
import { t } from "./i18n.js?v=VERSION";
import { sm } from "./sound.js?v=VERSION";

export const uiSettingsManager = {
  // Состояние
  showMs: true,
  isAdaptiveBg: true,
  hasVignette: false,
  isLiquidGlass: false,
  hideNavLabels: false,
  vignetteAlpha: 0.2,
  ringWidth: 4,
  swMinuteBeep: true,
  lastSliderValues: {},

  // Константы
  vignetteLevels: [0.1, 0.15, 0.2, 0.25, 0.3],
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

  init() {
    this._bindEvents();
    this.applySettings();
  },

  _bindEvents() {
    document.addEventListener("languageChanged", () => this.syncSliderUIs());

    document.addEventListener("vibroToggled", (e) =>
      this.updateVibroSliderUI(e.detail.enabled),
    );

    // Слушаем событие от sm.applySettings() — синхронизируем ползунки
    // vibroSlider и volumeSlider с актуальными значениями sm после любого
    // вызова sm.applySettings() или sm.resetSettings()
    document.addEventListener("soundSettingsApplied", () => {
      this._restoreVibroSlider(sm.vibroLevel);
      this._restoreVolumeSlider(sm.volume);
      // Принудительно обновляем лейблы через два rAF — первый ждёт layout,
      // второй гарантирует что offsetWidth уже ненулевой
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          this.syncSliderUIs();
        });
      });
    });

    const toggleListeners = {
      "toggle-ms": (val) => {
        this.showMs = val;
        safeSetLS("app_show_ms", val);
        document.dispatchEvent(new CustomEvent("msChanged"));
      },
      "toggle-nav-labels": (val) => {
        this.hideNavLabels = val;
        safeSetLS("app_hide_nav_labels", val);
        this.applyNavLabelsVisibility();
      },
      "toggle-glass": (val) => {
        this.isLiquidGlass = val;
        safeSetLS("app_liquid_glass", val);
        this.updateGlass();
      },
      "toggle-vignette": (val) => {
        this.hasVignette = val;
        safeSetLS("app_vignette", val);
        this.updateVignette();
      },
      "toggle-adaptive-bg": (val) => {
        this.isAdaptiveBg = val;
        safeSetLS("app_adaptive_bg", val);
        document.dispatchEvent(new CustomEvent("adaptiveBgChanged"));
      },
    };

    for (const [id, callback] of Object.entries(toggleListeners)) {
      $(id)?.addEventListener("change", (e) => callback(e.target.checked));
    }

    const sliderListeners = {
      fontSlider: (val) => this.setFontSize(val),
      ringWidthSlider: (val) => this.setRingWidth(val),

      vignetteSlider: (val, isFinal = true) => {
        const newAlpha = this.vignetteLevels[val];
        this.vignetteAlpha = newAlpha;
        this.updateVignette();
        this.updateSliderLabel(
          "vignetteSlider",
          "vignette-label",
          this.vignetteLabels,
        );
        if (isFinal) {
          safeSetLS("app_vignette_alpha", newAlpha);
        }
      },

      vibroSlider: (val, isFinal = true) => {
        const levels = [0.5, 0.75, 1, 1.5, 2];
        const newLevel = levels[val] || 1;
        sm.vibroLevel = newLevel;
        this.updateSliderLabel("vibroSlider", "vibro-label", this.vibroLabels);
        if (isFinal) {
          safeSetLS("app_vibro_level", newLevel);
          sm.vibrate(50, "strong");
        }
      },
    };

    for (const [id, callback] of Object.entries(sliderListeners)) {
      const slider = $(id);
      if (!slider) continue;

      slider.addEventListener("input", (e) => {
        const currentValue = e.target.value;
        if (this.lastSliderValues[id] !== currentValue) {
          this.lastSliderValues[id] = currentValue;
          callback(currentValue, false);
        }
      });

      slider.addEventListener("change", (e) => {
        const finalValue = e.target.value;
        this.lastSliderValues[id] = finalValue;
        callback(finalValue, true);
      });
    }
  },

  // Вспомогательный метод: восстанавливает позицию vibroSlider по числовому уровню
  _restoreVibroSlider(level) {
    const slider = $("vibroSlider");
    if (!slider) return;
    const levels = [0.5, 0.75, 1, 1.5, 2];
    const closestIndex = levels.reduce(
      (prev, curr, index) =>
        Math.abs(curr - level) < Math.abs(levels[prev] - level)
          ? index
          : prev,
      0,
    );
    slider.value = closestIndex;
  },

  // Вспомогательный метод: восстанавливает позицию volumeSlider и текст дисплея
  _restoreVolumeSlider(volume) {
    const slider = $("volumeSlider");
    if (!slider) return;
    slider.value = volume;
    const display = $("volumeDisplay");
    if (display) display.textContent = Math.round(volume * 100) + "%";
  },

  // Вспомогательный метод: восстанавливает позицию vignetteSlider по значению alpha
  _restoreVignetteSlider(alpha) {
    const slider = $("vignetteSlider");
    if (!slider) return;
    const closestIndex = this.vignetteLevels.reduce(
      (p, c, i) =>
        Math.abs(c - alpha) < Math.abs(this.vignetteLevels[p] - alpha)
          ? i
          : p,
      0,
    );
    slider.value = closestIndex;
  },

  applySettings() {
    // --- Переключатели ---
    this.isAdaptiveBg = safeGetLS("app_adaptive_bg") !== "false";
    if ($("toggle-adaptive-bg"))
      $("toggle-adaptive-bg").checked = this.isAdaptiveBg;

    this.hasVignette = safeGetLS("app_vignette") === "true";
    if ($("toggle-vignette")) $("toggle-vignette").checked = this.hasVignette;

    this.isLiquidGlass = safeGetLS("app_liquid_glass") === "true";
    if ($("toggle-glass")) $("toggle-glass").checked = this.isLiquidGlass;

    this.hideNavLabels = safeGetLS("app_hide_nav_labels") === "true";
    if ($("toggle-nav-labels"))
      $("toggle-nav-labels").checked = this.hideNavLabels;

    this.showMs = safeGetLS("app_show_ms") !== "false";
    if ($("toggle-ms")) $("toggle-ms").checked = this.showMs;

    this.swMinuteBeep = safeGetLS("app_sw_minute_beep") !== "false";
    if ($("toggle-sw-minute-beep"))
      $("toggle-sw-minute-beep").checked = this.swMinuteBeep;

    // --- Слайдеры шрифта и ширины кольца ---
    const fontSize = safeGetLS("font_size") || 16;
    if ($("fontSlider")) $("fontSlider").value = fontSize;
    this.setFontSize(fontSize);

    const ringWidth = safeGetLS("app_ring_width") || 4;
    if ($("ringWidthSlider")) $("ringWidthSlider").value = ringWidth;
    this.setRingWidth(ringWidth);

    // --- Виньетка ---
    this.vignetteAlpha = parseFloat(safeGetLS("app_vignette_alpha")) || 0.2;
    this._restoreVignetteSlider(this.vignetteAlpha);

    // --- Вибрация: берём значение из LS напрямую (sm может ещё не быть init) ---
    const vibroLevel = parseFloat(safeGetLS("app_vibro_level")) || 1;
    this._restoreVibroSlider(vibroLevel);

    // --- Громкость: берём значение из LS напрямую ---
    const volume =
      safeGetLS("app_volume") !== null
        ? parseFloat(safeGetLS("app_volume"))
        : 1;
    this._restoreVolumeSlider(volume);

    // --- Применение визуальных эффектов ---
    this.applyNavLabelsVisibility();
    this.updateGlass();
    this.updateVignette();

    // Синхронизация лейблов через двойной rAF — гарантирует ненулевой offsetWidth
    // даже если панель настроек скрыта при загрузке (display:none → offsetWidth = 0)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.syncSliderUIs();
      });
    });
  },

  resetSettings() {
    const keys = [
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
    keys.forEach(safeRemoveLS);
    // applySettings() читает LS (ключи удалены → берутся дефолты)
    // и обновляет все элементы UI включая ползунки
    this.applySettings();
  },

  syncSliderUIs() {
    // Обновляем лейбл виньетки — всегда, независимо от hasVignette,
    // чтобы позиция была корректной когда панель станет видимой
    this.updateSliderLabel(
      "vignetteSlider",
      "vignette-label",
      this.vignetteLabels,
    );
    // Обновляем лейбл вибрации — всегда, независимо от vibroEnabled
    this.updateSliderLabel("vibroSlider", "vibro-label", this.vibroLabels);
  },

  updateSliderLabel(sliderId, labelId, labelsArray) {
    const slider = $(sliderId);
    const label = $(labelId);
    if (!slider || !label) return;

    const val = parseInt(slider.value, 10);
    const min = parseFloat(slider.min);
    const max = parseFloat(slider.max);

    label.textContent = t(labelsArray[val] || labelsArray[0]);

    const percent = max - min > 0 ? (val - min) / (max - min) : 0;
    const thumbWidth = 24;
    const trackWidth = slider.offsetWidth;

    // Если ширина нулевая (скрытая панель) — пропускаем позиционирование,
    // оно будет пересчитано при следующем syncSliderUIs()
    if (trackWidth === 0) return;

    const offset = thumbWidth / 2 - percent * thumbWidth;
    label.style.left = `calc(${percent * 100}% + ${offset}px)`;
  },

  setFontSize(s) {
    const n = Number(s);
    document.documentElement.style.setProperty("--font-scale", n / 16);
    if ($("fontSizeDisplay")) $("fontSizeDisplay").textContent = `${n} px`;
    safeSetLS("font_size", n);
  },

  setRingWidth(w) {
    const n = Number(w);
    this.ringWidth = n;
    document.documentElement.style.setProperty("--ring-stroke-width", n);
    if ($("ringWidthDisplay"))
      $("ringWidthDisplay").textContent = `${n.toFixed(1)} px`;
    safeSetLS("app_ring_width", n);
  },

  updateVignette() {
    const bg = document.querySelector(".app-bg");
    if (!bg) return;
    const c = $("vignette-depth-container");
    c?.classList.toggle("hidden", !this.hasVignette);
    c?.classList.toggle("flex", this.hasVignette);
    bg.classList.toggle("has-vignette", this.hasVignette);
    if (this.hasVignette) {
      document.documentElement.style.setProperty(
        "--vignette-alpha",
        this.vignetteAlpha * 0.4,
      );
    }
    // Обновляем лейбл всегда — не только когда hasVignette,
    // чтобы при включении виньетки лейбл уже был на правильной позиции
    requestAnimationFrame(() => {
      this.updateSliderLabel(
        "vignetteSlider",
        "vignette-label",
        this.vignetteLabels,
      );
    });
  },

  updateVibroSliderUI(isEnabled) {
    const c = $("vibro-level-container");
    c?.classList.toggle("hidden", !isEnabled);
    c?.classList.toggle("flex", isEnabled);
    // Обновляем лейбл всегда — не только когда включено,
    // чтобы при включении вибрации лейбл уже был на правильной позиции
    requestAnimationFrame(() => {
      this.updateSliderLabel("vibroSlider", "vibro-label", this.vibroLabels);
    });
  },

  updateGlass() {
    document.documentElement.classList.toggle(
      "glass-effect",
      this.isLiquidGlass,
    );
  },

  applyNavLabelsVisibility() {
    document.body.classList.toggle("hide-nav-labels", this.hideNavLabels);
  },
};
