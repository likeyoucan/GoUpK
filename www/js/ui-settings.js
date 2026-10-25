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
import { adsManager } from "./ads.js?v=VERSION";
import {
  isNativeNotificationsRuntime,
  checkNotificationsGranted,
  requestNotificationsPermission,
} from "./foreground/notification-permission.js?v=VERSION";

/** @typedef {import("./types/managers-contracts.js").UiSettingsManagerContract} UiSettingsManagerContract */

const state = createUiSettingsState();

/** @type {UiSettingsManagerContract} */
export const uiSettingsManager = {
  _unbindEvents: null,
  _isInitialized: false,

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

  // Ads
  get adsEnabled() {
    return state.adsEnabled;
  },
  set adsEnabled(v) {
    state.adsEnabled = !!v;
  },

  get adsProvider() {
    return state.adsProvider;
  },
  set adsProvider(v) {
    state.adsProvider = v || "yandex";
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
    if (this._isInitialized) return;

    this.applySettings();
    this._unbindEvents = bindUiSettingsEvents(state);
    this._isInitialized = true;
  },

  destroy() {
    if (!this._isInitialized) return;

    try {
      this._unbindEvents?.();
    } catch (err) {
      console.error("[ui-settings.destroy]", err);
    }

    this._unbindEvents = null;
    this._isInitialized = false;
  },

  async reconcileForegroundBannerPermissionAtStartup() {
    if (!isNativeNotificationsRuntime()) {
      state.showForegroundBanner = false;
      return;
    }

    if (!state.showForegroundBanner) return;

    // Если тумблер сохранен как ON, а права нет, запрашиваем снова на старте.
    // Это покрывает кейс, когда permission было снято системой.
    let granted = await checkNotificationsGranted();
    if (!granted) {
      granted = await requestNotificationsPermission();
    }

    if (!granted) {
      state.showForegroundBanner = false;
      const toggle = $("toggle-foreground-banner");
      if (toggle) toggle.checked = false;
      // Сохраняем OFF в storage через binding-файл при следующем действии пользователя,
      // здесь только состояние in-memory + UI.
    }
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

    // Sync ads manager from settings state
    adsManager.setProvider(state.adsProvider);
    adsManager.setEnabled(state.adsEnabled);

    const adsProviderSelect = $("adsProvider");
    if (adsProviderSelect) {
      adsProviderSelect.value = state.adsProvider;
    }

    // Не блокируем инициализацию UI, но сразу запускаем reconcile.
    void this.reconcileForegroundBannerPermissionAtStartup();
  },

  resetSettings() {
    resetUiSettingsStorage();

    state.showMs = true;
    state.showForegroundBanner = false;
    state.isAdaptiveBg = true;
    state.hasVignette = false;
    state.isLiquidGlass = false;
    state.hideNavLabels = false;
    state.vignetteAlpha = 0.2;
    state.fontSize = 16;
    state.ringWidth = 4;
    state.swMinuteBeep = true;

    // Ads defaults
    state.adsEnabled = true;
    state.adsProvider = "yandex";

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
