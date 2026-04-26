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
  lastNonZeroVolume: 1,
  theme: "classic",
  soundThemeSelect: null,

  isInitialized: false,
  _onVolumeInput: null,
  _onVolumeChange: null,

  // Debounce for volume preview sound (one sound after fast drag)
  volumePreviewTimer: null,
  VOLUME_PREVIEW_DELAY: 160,

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

  setSoundEnabled(enabled, { persist = true, restoreVolume = true } = {}) {
    this.soundEnabled = enabled;

    const toggle = $("toggle-sound");
    if (toggle) toggle.checked = enabled;

    if (!enabled) {
      if (this.volume > 0) {
        this.lastNonZeroVolume = this.volume;
        safeSetLS("app_volume_last_non_zero", this.lastNonZeroVolume);
      }

      this.volume = 0;

      const volumeSlider = $("volumeSlider");
      if (volumeSlider) volumeSlider.value = "0";

      const display = $("volumeDisplay");
      if (display) display.textContent = "0%";
    } else {
      if (restoreVolume) {
        const restored =
          this.lastNonZeroVolume > 0 ? this.lastNonZeroVolume : 1;
        this.volume = restored;

        const volumeSlider = $("volumeSlider");
        if (volumeSlider) volumeSlider.value = String(restored);

        const display = $("volumeDisplay");
        if (display) display.textContent = Math.round(restored * 100) + "%";
      }

      this.initAudio();
    }

    if (persist) {
      safeSetLS("app_sound", this.soundEnabled);
      safeSetLS("app_volume", this.volume);
    }
  },

  init() {
    if (window.__STOPWATCH_SM_INITED__) return;
    window.__STOPWATCH_SM_INITED__ = true;

    if (this.isInitialized) return;
    this.isInitialized = true;

    this.applySettings();
    this.initAudio();

    $("toggle-sound")?.addEventListener("change", (e) => {
      this.setSoundEnabled(e.target.checked, {
        persist: true,
        restoreVolume: true,
      });
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

    const volumeSlider = $("volumeSlider");
    if (volumeSlider && volumeSlider.dataset.boundSound !== "1") {
      volumeSlider.dataset.boundSound = "1";

      this._onVolumeInput = (e) => {
        const prevVolume = this.volume;
        const newVolume = parseFloat(e.target.value);

        this.volume = newVolume;

        const display = $("volumeDisplay");
        if (display) display.textContent = Math.round(this.volume * 100) + "%";

        if (this.volumePreviewTimer) {
          clearTimeout(this.volumePreviewTimer);
          this.volumePreviewTimer = null;
        }

        // Move to 0 => toggle OFF
        if (newVolume <= 0) {
          if (prevVolume > 0) {
            this.lastNonZeroVolume = prevVolume;
            safeSetLS("app_volume_last_non_zero", this.lastNonZeroVolume);
          }

          if (this.soundEnabled) {
            this.setSoundEnabled(false, {
              persist: true,
              restoreVolume: false,
            });
          } else {
            safeSetLS("app_volume", 0);
          }
          return;
        }

        // Move above 0 => toggle ON
        this.lastNonZeroVolume = newVolume;
        safeSetLS("app_volume_last_non_zero", this.lastNonZeroVolume);

        if (!this.soundEnabled) {
          this.setSoundEnabled(true, {
            persist: true,
            restoreVolume: false,
          });
        } else {
          safeSetLS("app_volume", newVolume);
        }

        // One preview sound after drag settles
        if (this.soundEnabled && this.volume > 0) {
          this.volumePreviewTimer = setTimeout(() => {
            this.play("click");
            this.volumePreviewTimer = null;
          }, this.VOLUME_PREVIEW_DELAY);
        }
      };

      this._onVolumeChange = (e) => {
        if (this.volumePreviewTimer) {
          clearTimeout(this.volumePreviewTimer);
          this.volumePreviewTimer = null;
        }

        const prevVolume = this.volume;
        const finalVolume = parseFloat(e.target.value);
        this.volume = finalVolume;

        if (finalVolume <= 0) {
          if (prevVolume > 0) {
            this.lastNonZeroVolume = prevVolume;
            safeSetLS("app_volume_last_non_zero", this.lastNonZeroVolume);
          }

          if (this.soundEnabled) {
            this.setSoundEnabled(false, {
              persist: true,
              restoreVolume: false,
            });
          } else {
            safeSetLS("app_volume", 0);
          }
          return;
        }

        this.lastNonZeroVolume = finalVolume;
        safeSetLS("app_volume_last_non_zero", this.lastNonZeroVolume);

        if (!this.soundEnabled) {
          this.setSoundEnabled(true, {
            persist: true,
            restoreVolume: false,
          });
        } else {
          safeSetLS("app_volume", finalVolume);
        }

        // No immediate extra sound on change to avoid duplicates
      };

      volumeSlider.addEventListener("input", this._onVolumeInput);
      volumeSlider.addEventListener("change", this._onVolumeChange);
    }

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
    this.vibroLevel = parseFloat(safeGetLS("app_vibro_level")) || 1;

    this.volume =
      safeGetLS("app_volume") !== null
        ? parseFloat(safeGetLS("app_volume"))
        : 1;

    this.lastNonZeroVolume =
      safeGetLS("app_volume_last_non_zero") !== null
        ? parseFloat(safeGetLS("app_volume_last_non_zero"))
        : 1;

    if (
      !Number.isFinite(this.lastNonZeroVolume) ||
      this.lastNonZeroVolume <= 0
    ) {
      this.lastNonZeroVolume = 1;
    }

    if (this.soundEnabled) {
      if (!Number.isFinite(this.volume) || this.volume <= 0) {
        this.volume = this.lastNonZeroVolume;
      }
    } else {
      if (Number.isFinite(this.volume) && this.volume > 0) {
        this.lastNonZeroVolume = this.volume;
        safeSetLS("app_volume_last_non_zero", this.lastNonZeroVolume);
      }
      this.volume = 0;
    }

    this.theme = safeGetLS("app_sound_theme") || "classic";

    if ($("toggle-sound")) $("toggle-sound").checked = this.soundEnabled;
    if ($("toggle-vibro")) $("toggle-vibro").checked = this.vibroEnabled;

    if ($("vibroSlider")) {
      const levels = [0.5, 0.75, 1, 1.5, 2];
      const closestIndex = levels.reduce(
        (p, c, i) =>
          Math.abs(c - this.vibroLevel) < Math.abs(levels[p] - this.vibroLevel)
            ? i
            : p,
        0,
      );
      $("vibroSlider").value = closestIndex;
    }

    const volumeSlider = $("volumeSlider");
    if (volumeSlider) {
      volumeSlider.value = String(this.volume);
      const display = $("volumeDisplay");
      if (display) display.textContent = Math.round(this.volume * 100) + "%";
    }

    if (this.soundThemeSelect) {
      this.soundThemeSelect.setValue(this.theme, false);
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
      "app_vibro_level",
      "app_sound_theme",
      "app_volume",
      "app_volume_last_non_zero",
    ];
    soundKeys.forEach(safeRemoveLS);

    this.soundEnabled = true;
    this.vibroEnabled = true;
    this.vibroLevel = 1;
    this.volume = 1;
    this.lastNonZeroVolume = 1;
    this.theme = "classic";

    if (this.volumePreviewTimer) {
      clearTimeout(this.volumePreviewTimer);
      this.volumePreviewTimer = null;
    }

    this.applySettings();
    this.initAudio();
  },

  updateVolumeUI() {
    const volSlider = $("volumeSlider");
    if (!volSlider) return;

    volSlider.disabled = false;
    const parentContainer = volSlider.closest(".p-4");
    if (parentContainer) parentContainer.classList.remove("is-disabled");
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
        light: 0.7,
        medium: 1.0,
        strong: 1.4,
        tactile: 0.5,
      };
      const typeMultiplier = intensityMap[intensityKey] || 1;
      const levelMultiplier = this.vibroLevel;
      const finalMultiplier = typeMultiplier * levelMultiplier;

      const applyLevel = (duration) => {
        const baseDuration = duration * 1.5;
        const newDuration = Math.round(baseDuration * finalMultiplier);
        return Math.max(1, Math.min(200, newDuration));
      };

      const pattern = Array.isArray(basePattern)
        ? basePattern.map(applyLevel)
        : applyLevel(basePattern);

      navigator.vibrate(pattern);
    } catch (e) {}
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
    if (!this.audioCtx) return;

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
      const attackTime = Math.min(0.05, duration * 0.1);
      const releaseTime = Math.min(0.05, duration * 0.1);
      gainNode.gain.linearRampToValueAtTime(peakVol, startTime + attackTime);
      gainNode.gain.linearRampToValueAtTime(
        peakVol,
        startTime + duration - releaseTime,
      );
      gainNode.gain.linearRampToValueAtTime(0.001, startTime + duration);
    } else {
      gainNode.gain.linearRampToValueAtTime(
        peakVol,
        startTime + Math.min(0.02, duration * 0.1),
      );
      gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    }

    osc.frequency.setValueAtTime(freq, startTime);

    if (slideToFreq) {
      if (sustain) {
        osc.frequency.linearRampToValueAtTime(
          slideToFreq,
          startTime + duration * 0.4,
        );
        osc.frequency.linearRampToValueAtTime(
          slideToFreq,
          startTime + duration,
        );
      } else {
        osc.frequency.exponentialRampToValueAtTime(
          slideToFreq,
          startTime + duration,
        );
      }
    }

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
        const playSwoosh = (time, duration, isFinal = false) => {
          this.playNote(
            isFinal ? 3500 : 2500,
            "triangle",
            time,
            duration,
            0.75 * vol,
            100,
          );
          this.playNote(
            isFinal ? 1500 : 1000,
            "sine",
            time,
            duration,
            0.8 * vol,
            50,
          );
          if (isFinal)
            this.playNote(300, "square", time, duration, 0.4 * vol, 20);
        };
        playSwoosh(0.0, 0.25);
        playSwoosh(0.35, 0.25);
        playSwoosh(0.7, 0.8, true);
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
