// Файл: www/js/sound.js

import { $, safeGetLS, safeSetLS, safeRemoveLS } from "./utils.js?v=VERSION";
import { CustomSelect } from "./custom-select.js?v=VERSION";
import { t } from "./i18n.js?v=VERSION";

import {
  initAudio,
  unlockAudio,
  vibrate,
  playNote,
  play,
} from "./sound/sound-engine.js?v=VERSION";
import {
  syncVolumeUI,
  clearPreviewTimer,
  schedulePreview,
  setSoundEnabled,
  applySliderVolume,
  applySettings,
  resetSettings,
  updateVolumeUI,
} from "./sound/sound-state.js?v=VERSION";
import { bindSoundControls } from "./sound/sound-bindings.js?v=VERSION";

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
    unlockAudio(this);
  },

  setSoundEnabled(enabled, options = {}) {
    setSoundEnabled(
      this,
      enabled,
      {
        $,
        safeSetLS,
        initAudio: () => initAudio(this),
      },
      options,
    );
  },

  _syncVolumeUI(value) {
    syncVolumeUI(this, $, value);
  },

  _clearPreviewTimer() {
    clearPreviewTimer(this);
  },

  _schedulePreview() {
    schedulePreview(this);
  },

  _applySliderVolume(rawValue, options = {}) {
    applySliderVolume(
      this,
      rawValue,
      {
        $,
        safeSetLS,
        setSoundEnabled: (enabled, opts) => this.setSoundEnabled(enabled, opts),
      },
      options,
    );
  },

  init() {
    if (window.__STOPWATCH_SM_INITED__) return;
    window.__STOPWATCH_SM_INITED__ = true;

    if (this.isInitialized) return;
    this.isInitialized = true;

    this.applySettings();
    this.initAudio();

    bindSoundControls(this, { $, safeSetLS, CustomSelect, t });
  },

  applySettings() {
    applySettings(this, { $, safeGetLS, safeSetLS });
  },

  resetSettings() {
    resetSettings(this, {
      safeRemoveLS,
      applySettings: () => this.applySettings(),
      initAudio: () => this.initAudio(),
    });
  },

  updateVolumeUI() {
    updateVolumeUI($);
  },

  initAudio() {
    initAudio(this);
  },

  vibrate(basePattern, intensityKey = "medium") {
    vibrate(this, basePattern, intensityKey);
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
    playNote(
      this,
      freq,
      type,
      startTimeOffset,
      duration,
      volMultiplier,
      slideToFreq,
      sustain,
    );
  },

  play(type, options = {}) {
    play(this, type, options);
  },
};
