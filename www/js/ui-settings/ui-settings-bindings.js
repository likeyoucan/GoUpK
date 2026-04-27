// Файл: www/js/ui-settings/ui-settings-bindings.js

import { $, safeSetLS } from "../utils.js?v=VERSION";
import { sm } from "../sound.js?v=VERSION";

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
  document.addEventListener("languageChanged", () => syncSliderUIs(state));
  document.addEventListener("vibroToggled", (e) =>
    updateVibroSliderUI(e.detail.enabled),
  );

  const toggleListeners = {
    "toggle-ms": (val) => {
      state.showMs = val;
      safeSetLS("app_show_ms", val);
      document.dispatchEvent(new CustomEvent("msChanged"));
    },
    "toggle-foreground-banner": (val) => {
      state.showForegroundBanner = val;
      safeSetLS("app_show_foreground_banner", val);
      document.dispatchEvent(
        new CustomEvent("foregroundNotificationSettingChanged"),
      );
    },
    "toggle-nav-labels": (val) => {
      state.hideNavLabels = val;
      safeSetLS("app_hide_nav_labels", val);
      applyNavLabelsVisibility(state);
    },
    "toggle-glass": (val) => {
      state.isLiquidGlass = val;
      safeSetLS("app_liquid_glass", val);
      updateGlass(state);
    },
    "toggle-vignette": (val) => {
      state.hasVignette = val;
      safeSetLS("app_vignette", val);
      updateVignette(state);
      if (state.hasVignette) syncSliderUIs(state);
    },
    "toggle-adaptive-bg": (val) => {
      state.isAdaptiveBg = val;
      safeSetLS("app_adaptive_bg", val);
      document.dispatchEvent(new CustomEvent("adaptiveBgChanged"));
    },
    "toggle-sw-minute-beep": (val) => {
      state.swMinuteBeep = val;
      safeSetLS("app_sw_minute_beep", val);
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
    safeSetLS("app_vibro_level", newLevel);
    sm.vibrate(50, "strong");
  });

  $("vibroSlider")?.addEventListener("input", (e) => {
    const levels = [0.5, 0.75, 1, 1.5, 2];
    sm.vibroLevel = levels[Number(e.target.value)] || 1;
    updateSliderLabel("vibroSlider", "vibro-label", state.vibroLabels);
  });
}
