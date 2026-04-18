// Файл: www/js/sound.js

import { $, safeGetLS, safeSetLS, safeRemoveLS } from "./utils.js?v=VERSION";

export const sm = {
  audioCtx: null,
  soundEnabled: true,
  vibroEnabled: true,
  vibroLevel: 1,
  volume: 1,
  theme: "classic",
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

    $("vibroSlider")?.addEventListener("input", (e) => {
      const levels = [0.5, 0.75, 1, 1.5, 2];
      this.vibroLevel = levels[e.target.value] || 1;
      safeSetLS("app_vibro_level", this.vibroLevel);
    });

    $("vibroSlider")?.addEventListener("change", () =>
      this.vibrate(50, "strong"),
    );

    $("volumeSlider")?.addEventListener("input", (e) => {
      this.vibrate(10, "tactile");
      this.volume = parseFloat(e.target.value);
      const display = $("volumeDisplay");
      if (display) display.textContent = Math.round(this.volume * 100) + "%";
      safeSetLS("app_volume", this.volume);
    });
    $("volumeSlider")?.addEventListener("change", () => this.play("click"));

    $("soundThemeSelect")?.addEventListener("change", (e) => {
      this.theme = e.target.value;
      safeSetLS("app_sound_theme", this.theme);
      this.play("click");
    });

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
    this.theme = safeGetLS("app_sound_theme") || "classic";

    if ($("toggle-sound")) $("toggle-sound").checked = this.soundEnabled;
    if ($("toggle-vibro")) $("toggle-vibro").checked = this.vibroEnabled;
    if ($("vibroSlider")) {
      const levels = [0.5, 0.75, 1, 1.5, 2];
      const closestIndex = levels.reduce(
        (prev, curr, index) =>
          Math.abs(curr - this.vibroLevel) <
          Math.abs(levels[prev] - this.vibroLevel)
            ? index
            : prev,
        0,
      );
      $("vibroSlider").value = closestIndex;
    }
    if ($("volumeSlider")) {
      $("volumeSlider").value = this.volume;
      const display = $("volumeDisplay");
      if (display) display.textContent = Math.round(this.volume * 100) + "%";
    }
    if ($("soundThemeSelect")) $("soundThemeSelect").value = this.theme;

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
    ];
    soundKeys.forEach(safeRemoveLS);

    // Просто вызываем applySettings(), чтобы обновить UI, но НЕ init()
    this.applySettings();
  },

  updateVolumeUI() {
    const volSlider = $("volumeSlider");
    if (volSlider) {
      volSlider.disabled = !this.soundEnabled;
      volSlider.parentElement.style.opacity = this.soundEnabled ? "1" : "0.5";
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
      const intensityMultiplier = this.vibroIntensities[intensityKey] || 1;
      const finalMultiplier = intensityMultiplier * this.vibroLevel;
      const applyLevel = (val) =>
        Math.max(1, Math.min(1000, Math.round(val * finalMultiplier)));
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
    const peakVol = 0.8 * this.volume * volMultiplier;
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
  play(type) {
    if (!this.soundEnabled || !this.audioCtx || this.volume === 0) return;
    this.unlock();
    if (this.theme === "classic") {
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
    } else if (this.theme === "sport") {
      if (type === "click") this.playNote(1200, "triangle", 0, 0.05, 0.2, 200);
      else if (type === "tick")
        this.playNote(1500, "triangle", 0, 0.1, 0.3, 300);
      else if (type === "work_start") {
        this.playNote(2500, "triangle", 0.0, 0.3, 0.7, 100);
        this.playNote(1000, "sine", 0.0, 0.3, 0.6, 50);
      } else if (type === "rest_start") {
        this.playNote(1200, "triangle", 0.0, 0.3, 0.4, 100);
        this.playNote(600, "sine", 0.0, 0.3, 0.5, 50);
      } else if (type === "complete") {
        const playSwoosh = (time, duration, isFinal = false) => {
          this.playNote(
            isFinal ? 3500 : 2500,
            "triangle",
            time,
            duration,
            0.7,
            100,
          );
          this.playNote(isFinal ? 1500 : 1000, "sine", time, duration, 0.8, 50);
          if (isFinal) this.playNote(300, "square", time, duration, 0.3, 20);
        };
        playSwoosh(0.0, 0.25);
        playSwoosh(0.35, 0.25);
        playSwoosh(0.7, 0.8, true);
      } else if (type === "minute_beep")
        this.playNote(2000, "triangle", 0, 0.08, 0.4);
    } else if (this.theme === "vibe") {
      if (type === "click") this.playNote(300, "sine", 0, 0.1, 0.4);
      else if (type === "tick") this.playNote(400, "sine", 0, 0.15, 0.5);
      else if (type === "work_start") {
        this.playNote(261.63, "sine", 0, 1.5, 0.6);
        this.playNote(329.63, "sine", 0, 1.5, 0.5);
        this.playNote(392.0, "sine", 0, 1.5, 0.5);
      } else if (type === "rest_start") {
        this.playNote(392.0, "sine", 0.0, 1.0, 0.4);
        this.playNote(329.63, "sine", 0.1, 1.0, 0.4);
        this.playNote(261.63, "sine", 0.2, 1.5, 0.5);
      } else if (type === "complete") {
        this.playNote(261.63, "sine", 0.0, 3.0, 0.6);
        this.playNote(329.63, "sine", 0.1, 3.0, 0.5);
        this.playNote(392.0, "sine", 0.2, 3.0, 0.5);
        this.playNote(493.88, "sine", 0.3, 3.0, 0.4);
      } else if (type === "minute_beep")
        this.playNote(1046.5, "sine", 0, 0.2, 0.5);
    } else if (this.theme === "work") {
      if (type === "click") this.playNote(500, "sine", 0, 0.03, 0.2);
      else if (type === "tick") this.playNote(700, "sine", 0, 0.05, 0.2);
      else if (type === "work_start") {
        this.playNote(880, "sine", 0.0, 1.5, 0.4);
        this.playNote(1760, "sine", 0.0, 0.5, 0.1);
      } else if (type === "rest_start") {
        this.playNote(523.25, "sine", 0.0, 1.5, 0.4);
        this.playNote(261.63, "sine", 0.0, 2.5, 0.5);
      } else if (type === "complete") {
        this.playNote(880, "sine", 0.0, 1.0, 0.4);
        this.playNote(783.99, "sine", 0.4, 1.0, 0.4);
        this.playNote(659.25, "sine", 0.8, 2.0, 0.4);
      } else if (type === "minute_beep")
        this.playNote(880, "sine", 0, 0.07, 0.3);
    } else if (this.theme === "life") {
      if (type === "click") this.playNote(440, "triangle", 0, 0.08, 0.3);
      else if (type === "tick") this.playNote(523.25, "triangle", 0, 0.1, 0.4);
      else if (type === "work_start") {
        this.playNote(523.25, "triangle", 0.0, 0.2, 0.4);
        this.playNote(659.25, "triangle", 0.12, 0.2, 0.4);
        this.playNote(783.99, "triangle", 0.24, 0.2, 0.4);
        this.playNote(1046.5, "triangle", 0.36, 0.6, 0.5);
      } else if (type === "rest_start") {
        this.playNote(392.0, "triangle", 0.0, 0.15, 0.4);
        this.playNote(523.25, "triangle", 0.15, 0.6, 0.6);
      } else if (type === "complete") {
        this.playNote(523.25, "triangle", 0.0, 0.15, 0.4);
        this.playNote(523.25, "triangle", 0.15, 0.15, 0.4);
        this.playNote(523.25, "triangle", 0.3, 0.15, 0.4);
        this.playNote(659.25, "triangle", 0.45, 0.4, 0.5);
        this.playNote(587.33, "triangle", 0.85, 0.15, 0.4);
        this.playNote(659.25, "triangle", 1.0, 1.0, 0.5);
      } else if (type === "minute_beep")
        this.playNote(783.99, "triangle", 0, 0.15, 0.4);
    }
  },
};
