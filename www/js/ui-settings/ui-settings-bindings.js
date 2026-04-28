// Файл: www/js/ui-settings/ui-settings-bindings.js

import { $, safeSetLS } from "../utils.js?v=VERSION";
import { sm } from "../sound.js?v=VERSION";
import { APP_EVENTS } from "../constants/events.js?v=VERSION";
import { STORAGE_KEYS } from "../constants/storage-keys.js?v=VERSION";

import {
  setFontSize,
  setRingWidth,
  updateVignette,
  updateVibroSliderUI,
  updateGlass,
  applyNavLabelsVisibility,
  updateSliderLabel,
  syncSliderUIs,
  persistFontSize,
  persistRingWidth,
  persistVignetteAlpha,
} from "./ui-settings-apply.js?v=VERSION";

export function bindUiSettingsEvents(state) {
  document.addEventListener(APP_EVENTS.LANGUAGE_CHANGED, () =>
    syncSliderUIs(state),
  );
  document.addEventListener(APP_EVENTS.VIBRO_TOGGLED, (e) =>
    updateVibroSliderUI(e.detail.enabled),
  );

  const toggleListeners = {
    "toggle-ms": (val) => {
      state.showMs = val;
      safeSetLS(STORAGE_KEYS.APP_SHOW_MS, val);
      document.dispatchEvent(new CustomEvent(APP_EVENTS.MS_CHANGED));
    },
    "toggle-foreground-banner": (val) => {
      state.showForegroundBanner = val;
      safeSetLS(STORAGE_KEYS.APP_SHOW_FOREGROUND_BANNER, val);
      document.dispatchEvent(
        new CustomEvent(APP_EVENTS.FOREGROUND_NOTIFICATION_SETTING_CHANGED),
      );
    },
    "toggle-nav-labels": (val) => {
      state.hideNavLabels = val;
      safeSetLS(STORAGE_KEYS.APP_HIDE_NAV_LABELS, val);
      applyNavLabelsVisibility(state);
    },
    "toggle-glass": (val) => {
      state.isLiquidGlass = val;
      safeSetLS(STORAGE_KEYS.APP_LIQUID_GLASS, val);
      updateGlass(state);
    },
    "toggle-vignette": (val) => {
      state.hasVignette = val;
      safeSetLS(STORAGE_KEYS.APP_VIGNETTE, val);
      updateVignette(state);
      if (state.hasVignette) syncSliderUIs(state);
    },
    "toggle-adaptive-bg": (val) => {
      state.isAdaptiveBg = val;
      safeSetLS(STORAGE_KEYS.APP_ADAPTIVE_BG, val);
      document.dispatchEvent(new CustomEvent(APP_EVENTS.ADAPTIVE_BG_CHANGED));
    },
    "toggle-sw-minute-beep": (val) => {
      state.swMinuteBeep = val;
      safeSetLS(STORAGE_KEYS.APP_SW_MINUTE_BEEP, val);
    },
  };

  Object.entries(toggleListeners).forEach(([id, callback]) => {
    $(id)?.addEventListener("change", (e) => callback(e.target.checked));
  });

  $("fontSlider")?.addEventListener("change", (e) => {
    const val = Number(e.target.value);
    setFontSize(state, val);
    persistFontSize(val);
  });

  $("fontSlider")?.addEventListener("input", (e) => {
    setFontSize(state, Number(e.target.value));
  });

  $("ringWidthSlider")?.addEventListener("change", (e) => {
    const val = Number(e.target.value);
    setRingWidth(state, val);
    persistRingWidth(val);
  });

  $("ringWidthSlider")?.addEventListener("input", (e) => {
    setRingWidth(state, Number(e.target.value));
  });

  $("vignetteSlider")?.addEventListener("change", (e) => {
    const idx = Number(e.target.value);
    state.vignetteAlpha = state.vignetteLevels[idx];
    updateVignette(state);
    updateSliderLabel("vignetteSlider", "vignette-label", state.vignetteLabels);
    persistVignetteAlpha(state.vignetteAlpha);
  });

  $("vignetteSlider")?.addEventListener("input", (e) => {
    const idx = Number(e.target.value);
    state.vignetteAlpha = state.vignetteLevels[idx];
    updateVignette(state);
    updateSliderLabel("vignetteSlider", "vignette-label", state.vignetteLabels);
  });

  $("vibroSlider")?.addEventListener("change", (e) => {
    const levels = [0.5, 0.75, 1, 1.5, 2];
    const newLevel = levels[Number(e.target.value)] || 1;
    sm.vibroLevel = newLevel;
    updateSliderLabel("vibroSlider", "vibro-label", state.vibroLabels);
    safeSetLS(STORAGE_KEYS.APP_VIBRO_LEVEL, newLevel);
    sm.vibrate(50, "strong");
  });

  $("vibroSlider")?.addEventListener("input", (e) => {
    const levels = [0.5, 0.75, 1, 1.5, 2];
    sm.vibroLevel = levels[Number(e.target.value)] || 1;
    updateSliderLabel("vibroSlider", "vibro-label", state.vibroLabels);
  });
}
