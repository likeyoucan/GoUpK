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
  vibroIntensities: { light: 0.5, medium: 1, strong: 1.5, tactile: 0.8 },

  unlock() {
    if (this.audioCtx && this.audioCtx.state === "suspended") {
      this.audioCtx.resume().catch(() => {});
    }
  },

  init() {
    this.applySettings();
    this.initAudio();

    // Обработчики остались только для элементов, которыми управляет этот модуль
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
    // Этот метод только читает настройки и обновляет внутреннее состояние и UI
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
    if (this.soundThemeSelect)
      this.soundThemeSelect.setValue(this.theme, false);

    const display = $("volumeDisplay");
    if (display) display.textContent = Math.round(this.volume * 100) + "%";

    this.updateVolumeUI();
    document.dispatchEvent(
      new CustomEvent("vibroToggled", {
        detail: { enabled: this.vibroEnabled },
      }),
    );
  },

  resetSettings() {
    const keys = [
      "app_sound",
      "app_vibro",
      "app_sound_theme",
      "app_volume",
      "app_vibro_level",
    ];
    keys.forEach(safeRemoveLS);
    this.applySettings();
  },

  setVolume(newVolume, isFinal = false) {
    const vol = parseFloat(newVolume);
    this.volume = vol;
    const display = $("volumeDisplay");
    if (display) display.textContent = Math.round(vol * 100) + "%";

    if (isFinal) {
      safeSetLS("app_volume", vol);
      this.play("click", { theme: this.theme });
    } else {
      this.vibrate(10, "tactile");
    }
  },

  updateVolumeUI() {
    const volSlider = $("volumeSlider");
    if (volSlider) {
      volSlider.disabled = !this.soundEnabled;
      volSlider
        .closest(".p-4")
        ?.classList.toggle("is-disabled", !this.soundEnabled);
    }
  },

  initAudio() {
    if (this.audioCtx || !this.soundEnabled) return;
    try {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      this.soundEnabled = false;
    }
  },

  vibrate(basePattern, intensityKey = "medium") {
    if (!this.vibroEnabled || !navigator.vibrate) return;
    try {
      const intensityMap = {
        light: 0.7,
        medium: 1.0,
        strong: 1.4,
        tactile: 0.5,
      };
      const typeMultiplier = intensityMap[intensityKey] || 1;
      const levelMultiplier = this.vibroLevel;
      const finalMultiplier = typeMultiplier * levelMultiplier;
      const applyLevel = (duration) =>
        Math.max(1, Math.min(200, Math.round(duration * finalMultiplier)));
      const pattern = Array.isArray(basePattern)
        ? basePattern.map(applyLevel)
        : applyLevel(basePattern);
      navigator.vibrate(pattern);
    } catch (e) {
      /* Ignore */
    }
  },

  playNote(
    freq,
    type,
    startTimeOffset,
    duration,
    volMultiplier = 1,
    slideToFreq = null,
    sustain = false,
  ) {
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
      gainNode.gain.linearRampToValueAtTime(
        peakVol,
        startTime + duration - 0.05,
      );
      gainNode.gain.linearRampToValueAtTime(0.001, startTime + duration);
    } else {
      gainNode.gain.linearRampToValueAtTime(peakVol, startTime + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    }
    osc.frequency.setValueAtTime(freq, startTime);
    if (slideToFreq)
      osc.frequency.exponentialRampToValueAtTime(
        slideToFreq,
        startTime + duration,
      );
    osc.onended = () => {
      osc.disconnect();
      gainNode.disconnect();
    };
    osc.start(startTime);
    osc.stop(startTime + duration);
  },

  play(type, options = {}) {
    if (!this.soundEnabled || !this.audioCtx || this.volume === 0) return;
    this.unlock();
    const activeTheme = options.theme || this.theme;
    const vol = this.THEME_VOL_MULTIPLIERS[activeTheme] || 1.0;

    // --- ПОЛНЫЙ КОД ВОСПРОИЗВЕДЕНИЯ ЗВУКОВ ---
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
    } else if (activeTheme === "sport") {
      if (type === "click")
        this.playNote(1200, "triangle", 0, 0.05, 0.25 * vol, 200);
      else if (type === "tick")
        this.playNote(1500, "triangle", 0, 0.1, 0.35 * vol, 300);
      else if (type === "work_start") {
        this.playNote(2500, "triangle", 0.0, 0.3, 0.7 * vol, 100);
        this.playNote(1000, "sine", 0.0, 0.3, 0.6 * vol, 50);
      } else if (type === "rest_start") {
        this.playNote(1200, "triangle", 0.0, 0.3, 0.5 * vol, 100);
        this.playNote(600, "sine", 0.0, 0.3, 0.6 * vol, 50);
      } else if (type === "complete") {
        const p = (t, d, f) => {
          this.playNote(f ? 3500 : 2500, "triangle", t, d, 0.75 * vol, 100);
          this.playNote(f ? 1500 : 1000, "sine", t, d, 0.8 * vol, 50);
          if (f) this.playNote(300, "square", t, d, 0.4 * vol, 20);
        };
        p(0.0, 0.25);
        p(0.35, 0.25);
        p(0.7, 0.8, true);
      } else if (type === "minute_beep")
        this.playNote(2000, "triangle", 0, 0.08, 0.5 * vol);
    } else if (activeTheme === "vibe") {
      if (type === "click") this.playNote(300, "sine", 0, 0.1, 0.5 * vol);
      else if (type === "tick") this.playNote(400, "sine", 0, 0.15, 0.6 * vol);
      else if (type === "work_start") {
        this.playNote(261.63, "sine", 0, 1.5, 0.7 * vol);
        this.playNote(329.63, "sine", 0, 1.5, 0.6 * vol);
        this.playNote(392.0, "sine", 0, 1.5, 0.6 * vol);
      } else if (type === "rest_start") {
        this.playNote(392.0, "sine", 0.0, 1.0, 0.5 * vol);
        this.playNote(329.63, "sine", 0.1, 1.0, 0.5 * vol);
        this.playNote(261.63, "sine", 0.2, 1.5, 0.6 * vol);
      } else if (type === "complete") {
        this.playNote(261.63, "sine", 0.0, 3.0, 0.7 * vol);
        this.playNote(329.63, "sine", 0.1, 3.0, 0.6 * vol);
        this.playNote(392.0, "sine", 0.2, 3.0, 0.6 * vol);
        this.playNote(493.88, "sine", 0.3, 3.0, 0.5 * vol);
      } else if (type === "minute_beep")
        this.playNote(1046.5, "sine", 0, 0.2, 0.6 * vol);
    } else if (activeTheme === "work") {
      if (type === "click") this.playNote(500, "sine", 0, 0.03, 0.3 * vol);
      else if (type === "tick") this.playNote(700, "sine", 0, 0.05, 0.3 * vol);
      else if (type === "work_start") {
        this.playNote(880, "sine", 0.0, 1.5, 0.5 * vol);
        this.playNote(1760, "sine", 0.0, 0.5, 0.15 * vol);
      } else if (type === "rest_start") {
        this.playNote(523.25, "sine", 0.0, 1.5, 0.5 * vol);
        this.playNote(261.63, "sine", 0.0, 2.5, 0.6 * vol);
      } else if (type === "complete") {
        this.playNote(880, "sine", 0.0, 1.0, 0.5 * vol);
        this.playNote(783.99, "sine", 0.4, 1.0, 0.5 * vol);
        this.playNote(659.25, "sine", 0.8, 2.0, 0.5 * vol);
      } else if (type === "minute_beep")
        this.playNote(880, "sine", 0, 0.07, 0.4 * vol);
    } else if (activeTheme === "life") {
      if (type === "click") this.playNote(440, "triangle", 0, 0.08, 0.35 * vol);
      else if (type === "tick")
        this.playNote(523.25, "triangle", 0, 0.1, 0.45 * vol);
      else if (type === "work_start") {
        this.playNote(523.25, "triangle", 0.0, 0.2, 0.5 * vol);
        this.playNote(659.25, "triangle", 0.12, 0.2, 0.5 * vol);
        this.playNote(783.99, "triangle", 0.24, 0.2, 0.5 * vol);
        this.playNote(1046.5, "triangle", 0.36, 0.6, 0.6 * vol);
      } else if (type === "rest_start") {
        this.playNote(392.0, "triangle", 0.0, 0.15, 0.5 * vol);
        this.playNote(523.25, "triangle", 0.15, 0.6, 0.7 * vol);
      } else if (type === "complete") {
        this.playNote(523.25, "triangle", 0.0, 0.15, 0.5 * vol);
        this.playNote(523.25, "triangle", 0.15, 0.15, 0.5 * vol);
        this.playNote(523.25, "triangle", 0.3, 0.15, 0.5 * vol);
        this.playNote(659.25, "triangle", 0.45, 0.4, 0.6 * vol);
        this.playNote(587.33, "triangle", 0.85, 0.15, 0.5 * vol);
        this.playNote(659.25, "triangle", 1.0, 1.0, 0.6 * vol);
      } else if (type === "minute_beep")
        this.playNote(783.99, "triangle", 0, 0.15, 0.5 * vol);
    }
  },
};
