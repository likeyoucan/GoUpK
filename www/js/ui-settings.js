// Файл: www/js/ui-settings.js

import { $ } from "./utils.js?v=VERSION";
import {
  createUiSettingsState,
  loadUiSettingsFromStorage,
  resetUiSettingsStorage,
} from "./ui-settings/ui-settings-state.js?v=VERSION";
import {
  applyUiSettingsToControls,
  setFontSize,
  setRingWidth,
  updateVignette,
  updateVibroSliderUI,
  updateGlass,
  applyNavLabelsVisibility,
  syncSliderUIs,
} from "./ui-settings/ui-settings-apply.js?v=VERSION";
import { bindUiSettingsEvents } from "./ui-settings/ui-settings-bindings.js?v=VERSION";

const state = createUiSettingsState();

export const uiSettingsManager = {
  get showMs() {
    return state.showMs;
  },
  set showMs(v) {
    state.showMs = !!v;
  },

  get showForegroundBanner() {
    return state.showForegroundBanner;
  },
  set showForegroundBanner(v) {
    state.showForegroundBanner = !!v;
  },

  get isAdaptiveBg() {
    return state.isAdaptiveBg;
  },
  set isAdaptiveBg(v) {
    state.isAdaptiveBg = !!v;
  },

  get hasVignette() {
    return state.hasVignette;
  },
  set hasVignette(v) {
    state.hasVignette = !!v;
  },

  get isLiquidGlass() {
    return state.isLiquidGlass;
  },
  set isLiquidGlass(v) {
    state.isLiquidGlass = !!v;
  },

  get hideNavLabels() {
    return state.hideNavLabels;
  },
  set hideNavLabels(v) {
    state.hideNavLabels = !!v;
  },

  get vignetteAlpha() {
    return state.vignetteAlpha;
  },
  set vignetteAlpha(v) {
    state.vignetteAlpha = Number(v) || 0.2;
  },

  get fontSize() {
    return state.fontSize;
  },
  set fontSize(v) {
    state.fontSize = Number(v) || 16;
  },

  get ringWidth() {
    return state.ringWidth;
  },
  set ringWidth(v) {
    state.ringWidth = Number(v) || 4;
  },

  get swMinuteBeep() {
    return state.swMinuteBeep;
  },
  set swMinuteBeep(v) {
    state.swMinuteBeep = !!v;
  },

  get lastSliderValues() {
    return state.lastSliderValues;
  },

  get vignetteLevels() {
    return state.vignetteLevels;
  },

  get vignetteLabels() {
    return state.vignetteLabels;
  },

  get vibroLabels() {
    return state.vibroLabels;
  },

  init() {
    this.applySettings();
    bindUiSettingsEvents(state);
  },

  applySettings() {
    loadUiSettingsFromStorage(state);
    applyUiSettingsToControls(state);

    setFontSize(state, state.fontSize);
    setRingWidth(state, state.ringWidth);
    applyNavLabelsVisibility(state);
    updateGlass(state);
    updateVignette(state);
    syncSliderUIs(state);

    const vibroEnabled = $("toggle-vibro")?.checked ?? true;
    updateVibroSliderUI(vibroEnabled);
  },

  resetSettings() {
    resetUiSettingsStorage();

    state.showMs = true;
    state.showForegroundBanner = true;
    state.isAdaptiveBg = true;
    state.hasVignette = false;
    state.isLiquidGlass = false;
    state.hideNavLabels = false;
    state.vignetteAlpha = 0.2;
    state.fontSize = 16;
    state.ringWidth = 4;
    state.swMinuteBeep = true;

    this.applySettings();
  },

  syncSliderUIs() {
    syncSliderUIs(state);
  },

  setFontSize(size) {
    setFontSize(state, size);
  },

  setRingWidth(width) {
    setRingWidth(state, width);
  },

  updateVignette() {
    updateVignette(state);
  },

  updateVibroSliderUI(isEnabled) {
    updateVibroSliderUI(isEnabled);
  },

  updateGlass() {
    updateGlass(state);
  },

  applyNavLabelsVisibility() {
    applyNavLabelsVisibility(state);
  },
};
