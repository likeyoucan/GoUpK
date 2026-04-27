// Файл: www/js/ui-settings/ui-settings-state.js

import { safeGetLS, safeRemoveLS } from "../utils.js?v=VERSION";

export const UI_SETTINGS_KEYS = {
  fontSize: "font_size",
  adaptiveBg: "app_adaptive_bg",
  vignette: "app_vignette",
  vignetteAlpha: "app_vignette_alpha",
  liquidGlass: "app_liquid_glass",
  hideNavLabels: "app_hide_nav_labels",
  ringWidth: "app_ring_width",
  showMs: "app_show_ms",
  showForegroundBanner: "app_show_foreground_banner",
  swMinuteBeep: "app_sw_minute_beep",
};

export function createUiSettingsState() {
  return {
    showMs: true,
    showForegroundBanner: true,
    isAdaptiveBg: true,
    hasVignette: false,
    isLiquidGlass: false,
    hideNavLabels: false,
    vignetteAlpha: 0.2,
    fontSize: 16,
    ringWidth: 4,
    swMinuteBeep: true,
    lastSliderValues: {},

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
  };
}

export function loadUiSettingsFromStorage(state) {
  state.isAdaptiveBg = safeGetLS(UI_SETTINGS_KEYS.adaptiveBg) !== "false";
  state.hasVignette = safeGetLS(UI_SETTINGS_KEYS.vignette) === "true";
  state.isLiquidGlass = safeGetLS(UI_SETTINGS_KEYS.liquidGlass) === "true";
  state.hideNavLabels = safeGetLS(UI_SETTINGS_KEYS.hideNavLabels) === "true";
  state.showMs = safeGetLS(UI_SETTINGS_KEYS.showMs) !== "false";
  state.showForegroundBanner =
    safeGetLS(UI_SETTINGS_KEYS.showForegroundBanner) !== "false";
  state.swMinuteBeep = safeGetLS(UI_SETTINGS_KEYS.swMinuteBeep) !== "false";

  state.fontSize = Number(safeGetLS(UI_SETTINGS_KEYS.fontSize)) || 16;
  state.ringWidth = Number(safeGetLS(UI_SETTINGS_KEYS.ringWidth)) || 4;
  state.vignetteAlpha =
    parseFloat(safeGetLS(UI_SETTINGS_KEYS.vignetteAlpha)) || 0.2;
}

export function resetUiSettingsStorage() {
  Object.values(UI_SETTINGS_KEYS).forEach(safeRemoveLS);
}