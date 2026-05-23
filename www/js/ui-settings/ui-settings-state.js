// Файл: www/js/ui-settings/ui-settings-state.js

import { safeGetLS, safeRemoveLS } from "../utils.js?v=VERSION";
import { STORAGE_KEYS } from "../constants/storage-keys.js?v=VERSION";

const DEFAULT_INTERSTITIAL_TRIGGERS = {
  app_start: true,
  app_close: false,
  share: false,
  save_result: false,
  timer_start: false,
  timer_complete: true,
  tabata_complete: true,
};

function parseTriggers(raw) {
  if (!raw) return { ...DEFAULT_INTERSTITIAL_TRIGGERS };
  try {
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_INTERSTITIAL_TRIGGERS,
      ...(parsed && typeof parsed === "object" ? parsed : {}),
    };
  } catch {
    return { ...DEFAULT_INTERSTITIAL_TRIGGERS };
  }
}

export const UI_SETTINGS_KEYS = {
  fontSize: STORAGE_KEYS.FONT_SIZE,
  adaptiveBg: STORAGE_KEYS.APP_ADAPTIVE_BG,
  appIcon: STORAGE_KEYS.APP_ICON_NAME,
  vignette: STORAGE_KEYS.APP_VIGNETTE,
  vignetteAlpha: STORAGE_KEYS.APP_VIGNETTE_ALPHA,
  liquidGlass: STORAGE_KEYS.APP_LIQUID_GLASS,
  hideNavLabels: STORAGE_KEYS.APP_HIDE_NAV_LABELS,
  ringWidth: STORAGE_KEYS.APP_RING_WIDTH,
  showMs: STORAGE_KEYS.APP_SHOW_MS,
  showForegroundBanner: STORAGE_KEYS.APP_SHOW_FOREGROUND_BANNER,
  swMinuteBeep: STORAGE_KEYS.APP_SW_MINUTE_BEEP,

  // Ads
  adsEnabled: STORAGE_KEYS.APP_ADS_ENABLED,
  adsProvider: STORAGE_KEYS.APP_ADS_PROVIDER,
  adsBannerMode: STORAGE_KEYS.APP_ADS_BANNER_MODE,
  adsInterstitialTriggers: STORAGE_KEYS.APP_ADS_INTERSTITIAL_TRIGGERS,
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

    // Ads
    adsEnabled: true,
    adsProvider: "yandex",
    adsBannerMode: "always",
    adsInterstitialTriggers: { ...DEFAULT_INTERSTITIAL_TRIGGERS },

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

  // Ads
  state.adsEnabled = safeGetLS(UI_SETTINGS_KEYS.adsEnabled) !== "false";
  state.adsProvider = safeGetLS(UI_SETTINGS_KEYS.adsProvider) || "yandex";

  const bannerMode = safeGetLS(UI_SETTINGS_KEYS.adsBannerMode) || "always";
  state.adsBannerMode = bannerMode === "off" ? "off" : "always";

  state.adsInterstitialTriggers = parseTriggers(
    safeGetLS(UI_SETTINGS_KEYS.adsInterstitialTriggers),
  );
}

export function resetUiSettingsStorage() {
  Object.values(UI_SETTINGS_KEYS).forEach(safeRemoveLS);
}
