// Файл: www/js/sound.js

import { $, safeGetLS, safeSetLS, safeRemoveLS } from "./utils.js?v=VERSION";
import { CustomSelect } from "./custom-select.js?v=VERSION";
import { t } from "./i18n.js?v=VERSION";

export const sm = {
  audioCtx: null,
  soundEnabled: true,
  vibroEnabled: true,
  vibroLevel: 1,
  volume: 1,
  theme: "classic",
  soundThemeSelect: null,
  THEME_VOL_MULTIPLIERS: {
    classic: 1.0,
    sport: 1.6,
    vibe: 2.2,
    work: 1.9,
    life: 1.7,
  },
  vibroIntensities: {
    light: 0.5,
    medium: 1,
    strong: 1.5,
    tactile: 0.8,
  },

  unlock() {
    if (this.audioCtx && this.audioCtx.state === "suspended") {
      this.audioCtx.resume().catch(() => {});
    }
  },

  init() {
    this.applySettings();
    this.initAudio();

    $("toggle-sound")?.addEventListener("change", (e) => {
      this.soundEnabled = e.target.checked;
      safeSetLS("app_sound", this.soundEnabled);
      if (this.soundEnabled) this.initAudio();
      this.updateVolumeUI();
    });

    $("toggle-vibro")?.addEventListener("change", (e) => {
      this.vibroEnabled = e.target.checked;
      safeSetLS("app_vibro", this.vibroEnabled);
      document.dispatchEvent(
        new CustomEvent("vibroToggled", {
          detail: { enabled: this.vibroEnabled },
        }),
      );
      if (this.vibroEnabled) this.vibrate(50, "medium");
    });

    const soundThemeOptions = [
      { value: "classic", text: t("theme_classic") },
      { value: "sport", text: t("theme_sport") },
      { value: "vibe", text: t("theme_vibe") },
      { value: "work", text: t("theme_work") },
      { value: "life", text: t("theme_life") },
    ];

    this.soundThemeSelect = new CustomSelect(
      "soundThemeSelectContainer",
      soundThemeOptions,
      (newTheme) => {
        this.theme = newTheme;
        safeSetLS("app_sound_theme", this.theme);
        this.play("click", { theme: newTheme });
      },
      this.theme,
    );

    const unlockHandler = () => this.unlock();
    document.addEventListener("click", unlockHandler, {
      once: true,
      capture: true,
    });
    document.addEventListener("touchstart", unlockHandler, {
      once: true,
      passive: true,
    });
  },

  applySettings() {
    this.soundEnabled = safeGetLS("app_sound") !== "false";
    this.vibroEnabled = safeGetLS("app_vibro") !== "false";
    this.volume =
      safeGetLS("app_volume") !== null
        ? parseFloat(safeGetLS("app_volume"))
        : 1;
    this.vibroLevel = parseFloat(safeGetLS("app_vibro_level")) || 1;
    this.theme = safeGetLS("app_sound_theme") || "classic";

    if ($("toggle-sound")) $("toggle-sound").checked = this.soundEnabled;
    if ($("toggle-vibro")) $("toggle-vibro").checked = this.vibroEnabled;

    if (this.soundThemeSelect) {
      this.soundThemeSelect.setValue(this.theme, false);
    }
    
    // Обновляем текст громкости при загрузке
    const display = $("volumeDisplay");
    if (display) {
      display.textContent = Math.round(this.volume * 100) + "%";
    }

    this.updateVolumeUI();
    document.dispatchEvent(
      new CustomEvent("vibroToggled", {
        detail: { enabled: this.vibroEnabled },
      }),
    );
  },

  resetSettings() {
    const soundKeys = [
      "app_sound",
      "app_vibro",
      "app_sound_theme",
      "app_volume",
      "app_vibro_level",
    ];
    soundKeys.forEach(safeRemoveLS);
    this.applySettings();
  },

  // Этот метод вызывается из ui-settings.js
  setVolume(newVolume, isFinal = false) {
    const vol = parseFloat(newVolume);
    this.volume = vol;
    
    const display = $("volumeDisplay");
    if (display) {
      display.textContent = Math.round(vol * 100) + "%";
    }

    if (isFinal) {
      // Пользователь закончил изменение громкости
      safeSetLS("app_volume", vol);
      this.play("click", { theme: this.theme });
    } else {
      // Пользователь все еще перетаскивает ползунок
      this.vibrate(10, "tactile");
    }
  },

  updateVolumeUI() {
    const volSlider = $("volumeSlider");
    if (volSlider) {
      volSlider.disabled = !this.soundEnabled;
      const parentContainer = volSlider.closest(".p-4");
      if (parentContainer) {
        parentContainer.classList.toggle("is-disabled", !this.soundEnabled);
      }
    }
  },

  initAudio() {
    if (this.audioCtx || !this.soundEnabled) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) this.audioCtx = new AudioContext();
    } catch (e) {
      this.soundEnabled = false;
    }
  },

  vibrate(basePattern, intensityKey = "medium") {
    if (!this.vibroEnabled || !navigator.vibrate) return;
    try {
      const intensityMap = {
        light: 0.7, medium: 1.0, strong: 1.4, tactile: 0.5,
      };
      const typeMultiplier = intensityMap[intensityKey] || 1;
      const levelMultiplier = this.vibroLevel;
      const finalMultiplier = typeMultiplier * levelMultiplier;
      const applyLevel = (duration) => {
        const newDuration = Math.round(duration * finalMultiplier);
        return Math.max(1, Math.min(200, newDuration));
      };
      const pattern = Array.isArray(basePattern)
        ? basePattern.map(applyLevel)
        : applyLevel(basePattern);
      navigator.vibrate(pattern);
    } catch (e) { /* Игнорируем ошибки */ }
  },

  playNote(freq, type, startTimeOffset, duration, volMultiplier = 1, slideToFreq = null, sustain = false) {
    if (!this.audioCtx || !this.soundEnabled || this.volume === 0) return;
    const osc = this.audioCtx.createOscillator();
    const gainNode = this.audioCtx.createGain();
    osc.type = type;
    osc.connect(gainNode);
    gainNode.connect(this.audioCtx.destination);
    const now = this.audioCtx.currentTime;
    const startTime = now + startTimeOffset;
    const peakVol = 0.95 * this.volume * volMultiplier;
    gainNode.gain.setValueAtTime(0, startTime);
    if (sustain) {
      gainNode.gain.linearRampToValueAtTime(peakVol, startTime + 0.05);
      gainNode.gain.linearRampToValueAtTime(peakVol, startTime + duration - 0.05);
      gainNode.gain.linearRampToValueAtTime(0.001, startTime + duration);
    } else {
      gainNode.gain.linearRampToValueAtTime(peakVol, startTime + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    }
    osc.frequency.setValueAtTime(freq, startTime);
    if (slideToFreq) {
      osc.frequency.exponentialRampToValueAtTime(slideToFreq, startTime + duration);
    }
    osc.onended = () => { osc.disconnect(); gainNode.disconnect(); };
    osc.start(startTime);
    osc.stop(startTime + duration);
  },

  play(type, options = {}) {
    if (!this.soundEnabled || !this.audioCtx || this.volume === 0) return;
    this.unlock();

    const activeTheme = options.theme || this.theme;
    const vol = this.THEME_VOL_MULTIPLIERS[activeTheme] || 1.0;
    
    // --- Classic (Эталон) ---
    if (activeTheme === "classic") {
      if (type === "click") this.playNote(2000, "square", 0, 0.05, 0.2);
      else if (type === "tick") this.playNote(2500, "square", 0, 0.05, 0.3);
      else if (type === "work_start") {
        this.playNote(2500, "square", 0.0, 0.1, 0.4);
        this.playNote(2500, "square", 0.5, 0.1, 0.4);
        this.playNote(2500, "square", 1.0, 0.1, 0.4);
        this.playNote(3000, "square", 1.5, 0.6, 0.6);
      } else if (type === "rest_start") {
        this.playNote(2500, "square", 0.0, 0.1, 0.4);
        this.playNote(1500, "square", 0.15, 0.5, 0.5);
      } else if (type === "complete") {
        for (let i = 0; i < 3; i++) {
          const offset = i * 0.6;
          this.playNote(2500, "square", offset + 0.0, 0.06, 0.5);
          this.playNote(2500, "square", offset + 0.1, 0.06, 0.5);
          this.playNote(2500, "square", offset + 0.2, 0.06, 0.5);
        }
      } else if (type === "minute_beep")
        this.playNote(1500, "sine", 0, 0.1, 0.3);
    }
  },
};