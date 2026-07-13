// Файл: www/js/ui-settings/ui-settings-bindings.js

import { $, safeSetLS, showToast } from "../utils.js?v=VERSION";
import { t } from "../i18n.js?v=VERSION";
import { sm } from "../sound.js?v=VERSION";
import { adsManager } from "../ads.js?v=VERSION";
import { appProManager } from "../app-pro.js?v=VERSION";
import { APP_EVENTS } from "../constants/events.js?v=VERSION";
import { STORAGE_KEYS } from "../constants/storage-keys.js?v=VERSION";
import { emitAppEvent } from "../events/app-events.js?v=VERSION";

import {
  setFontSize,
  setRingWidth,
  updateVignette,
  updateVibroSliderUI,
  updateGlass,
  applyNavLabelsVisibility,
  updateSliderLabel,
  updateRangeValueByDataset,
  syncAllRangeValuesRight,
  syncSliderUIs,
  persistFontSize,
  persistRingWidth,
  persistVignetteAlpha,
} from "./ui-settings-apply.js?v=VERSION";

export function bindUiSettingsEvents(state) {
  const disposers = [];

  const bind = (el, event, handler, options) => {
    if (!el) return;
    el.addEventListener(event, handler, options);
    disposers.push(() => el.removeEventListener(event, handler, options));
  };

  const FONT_APPLY_DELAY_MS = 90;
  let fontApplyTimer = 0;
  let pendingFontSize = state.fontSize;

  bind(document, APP_EVENTS.LANGUAGE_CHANGED, () => syncSliderUIs(state));
  bind(document, APP_EVENTS.VIBRO_TOGGLED, (e) =>
    updateVibroSliderUI(e.detail.enabled),
  );

  const toggleListeners = {
    "toggle-ms": (val) => {
      state.showMs = val;
      safeSetLS(STORAGE_KEYS.APP_SHOW_MS, val);
      emitAppEvent(APP_EVENTS.MS_CHANGED, undefined);
    },
    "toggle-foreground-banner": (val) => {
      state.showForegroundBanner = val;
      safeSetLS(STORAGE_KEYS.APP_SHOW_FOREGROUND_BANNER, val);
      emitAppEvent(
        APP_EVENTS.FOREGROUND_NOTIFICATION_SETTING_CHANGED,
        undefined,
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
      emitAppEvent(APP_EVENTS.ADAPTIVE_BG_CHANGED, undefined);
    },
    "toggle-sw-minute-beep": (val) => {
      state.swMinuteBeep = val;
      safeSetLS(STORAGE_KEYS.APP_SW_MINUTE_BEEP, val);
    },

    "toggle-ads": (val) => {
      state.adsEnabled = val;

      const allowed = appProManager.requirePro("remove_ads", () => {
        showToast(t("disable_ads_pro"));
      });

      if (!allowed) {
        state.adsEnabled = true;
        if ($("toggle-ads")) $("toggle-ads").checked = true;
      }

      safeSetLS(STORAGE_KEYS.APP_ADS_ENABLED, state.adsEnabled);
      adsManager.setEnabled(state.adsEnabled);

      if (appProManager.purchased) {
        showToast(state.adsEnabled ? t("ads_enabled") : t("ads_disabled"));
      }

      emitAppEvent(APP_EVENTS.ADS_SETTINGS_CHANGED, undefined);
    },
  };

  Object.entries(toggleListeners).forEach(([id, callback]) => {
    const el = $(id);
    if (!el) return;

    const onChange = (e) => callback(e.target.checked);
    bind(el, "change", onChange);
  });

  const fontSlider = $("fontSlider");
  if (fontSlider) {
    const applyFontNow = (val) => {
      setFontSize(state, val);
    };

    const onFontChange = (e) => {
      const val = Number(e.target.value);
      pendingFontSize = val;

      if (fontApplyTimer) {
        clearTimeout(fontApplyTimer);
        fontApplyTimer = 0;
      }

      applyFontNow(val);
      persistFontSize(val);
      updateRangeValueByDataset(e.target);
    };

    const onFontInput = (e) => {
      pendingFontSize = Number(e.target.value);
      updateRangeValueByDataset(e.target);

      if (fontApplyTimer) clearTimeout(fontApplyTimer);
      fontApplyTimer = setTimeout(() => {
        fontApplyTimer = 0;
        applyFontNow(pendingFontSize);
      }, FONT_APPLY_DELAY_MS);
    };

    bind(fontSlider, "change", onFontChange);
    bind(fontSlider, "input", onFontInput);
  }

  const ringWidthSlider = $("ringWidthSlider");
  if (ringWidthSlider) {
    const onRingChange = (e) => {
      const val = Number(e.target.value);
      setRingWidth(state, val);
      persistRingWidth(val);
      updateRangeValueByDataset(e.target);
    };
    const onRingInput = (e) => {
      setRingWidth(state, Number(e.target.value));
      updateRangeValueByDataset(e.target);
    };

    bind(ringWidthSlider, "change", onRingChange);
    bind(ringWidthSlider, "input", onRingInput);
  }

  const vignetteSlider = $("vignetteSlider");
  if (vignetteSlider) {
    const onVignetteChange = (e) => {
      const idx = Number(e.target.value);
      state.vignetteAlpha = state.vignetteLevels[idx];
      updateVignette(state);
      updateSliderLabel(
        "vignetteSlider",
        "vignette-label",
        state.vignetteLabels,
      );
      updateRangeValueByDataset(e.target);
      persistVignetteAlpha(state.vignetteAlpha);
    };

    const onVignetteInput = (e) => {
      const idx = Number(e.target.value);
      state.vignetteAlpha = state.vignetteLevels[idx];
      updateVignette(state);
      updateSliderLabel(
        "vignetteSlider",
        "vignette-label",
        state.vignetteLabels,
      );
      updateRangeValueByDataset(e.target);
    };

    bind(vignetteSlider, "change", onVignetteChange);
    bind(vignetteSlider, "input", onVignetteInput);
  }

  const vibroSlider = $("vibroSlider");
  if (vibroSlider) {
    const onVibroChange = (e) => {
      const levels = [0.5, 0.75, 1, 1.5, 2];
      const newLevel = levels[Number(e.target.value)] || 1;
      sm.vibroLevel = newLevel;
      updateSliderLabel("vibroSlider", "vibro-label", state.vibroLabels);
      updateRangeValueByDataset(e.target);
      safeSetLS(STORAGE_KEYS.APP_VIBRO_LEVEL, newLevel);
      sm.vibrate(50, "strong");
    };

    const onVibroInput = (e) => {
      const levels = [0.5, 0.75, 1, 1.5, 2];
      sm.vibroLevel = levels[Number(e.target.value)] || 1;
      updateSliderLabel("vibroSlider", "vibro-label", state.vibroLabels);
      updateRangeValueByDataset(e.target);
    };

    bind(vibroSlider, "change", onVibroChange);
    bind(vibroSlider, "input", onVibroInput);
  }

  const onRangeInput = (e) => {
    const input = e.target;
    if (!(input instanceof HTMLInputElement) || input.type !== "range") return;
    updateRangeValueByDataset(input);
  };

  const onRangeChange = (e) => {
    const input = e.target;
    if (!(input instanceof HTMLInputElement) || input.type !== "range") return;
    updateRangeValueByDataset(input);
  };

  bind(document, "input", onRangeInput);
  bind(document, "change", onRangeChange);

  const providerSelect = $("adsProvider");
  if (providerSelect) {
    const onProviderChange = (e) => {
      const next = e.target.value || "yandex";
      state.adsProvider = next;
      safeSetLS(STORAGE_KEYS.APP_ADS_PROVIDER, next);
      adsManager.setProvider(next);
    };
    bind(providerSelect, "change", onProviderChange);
  }

  syncAllRangeValuesRight();

  return () => {
    if (fontApplyTimer) {
      clearTimeout(fontApplyTimer);
      fontApplyTimer = 0;
    }

    disposers.forEach((off) => {
      try {
        off?.();
      } catch (err) {
        console.error("[ui-settings-bindings.dispose]", err);
      }
    });
  };
}
