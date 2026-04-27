// Файл: www/js/ui-settings/ui-settings-apply.js

import { $, safeSetLS } from "../utils.js?v=VERSION";
import { t } from "../i18n.js?v=VERSION";

export function applyUiSettingsToControls(state) {
  if ($("toggle-adaptive-bg")) $("toggle-adaptive-bg").checked = state.isAdaptiveBg;
  if ($("toggle-vignette")) $("toggle-vignette").checked = state.hasVignette;
  if ($("toggle-glass")) $("toggle-glass").checked = state.isLiquidGlass;
  if ($("toggle-nav-labels")) $("toggle-nav-labels").checked = state.hideNavLabels;
  if ($("toggle-ms")) $("toggle-ms").checked = state.showMs;
  if ($("toggle-foreground-banner")) {
    $("toggle-foreground-banner").checked = state.showForegroundBanner;
  }
  if ($("toggle-sw-minute-beep")) {
    $("toggle-sw-minute-beep").checked = state.swMinuteBeep;
  }

  if ($("fontSlider")) $("fontSlider").value = state.fontSize;
  if ($("ringWidthSlider")) $("ringWidthSlider").value = state.ringWidth;

  if ($("vignetteSlider")) {
    const closestVignetteIndex = state.vignetteLevels.reduce(
      (prevIdx, curr, idx) =>
        Math.abs(curr - state.vignetteAlpha) <
        Math.abs(state.vignetteLevels[prevIdx] - state.vignetteAlpha)
          ? idx
          : prevIdx,
      0,
    );
    $("vignetteSlider").value = closestVignetteIndex;
  }
}

export function setFontSize(state, size) {
  state.fontSize = size;
  document.documentElement.style.setProperty("--font-scale", size / 16);
  if ($("fontSizeDisplay")) $("fontSizeDisplay").textContent = `${size} px`;
}

export function setRingWidth(state, width) {
  state.ringWidth = width;
  document.documentElement.style.setProperty("--ring-stroke-width", width);
  if ($("ringWidthDisplay")) {
    $("ringWidthDisplay").textContent = `${width.toFixed(1)} px`;
  }
}

export function updateVignette(state) {
  const bg = document.querySelector(".app-bg");
  if (!bg) return;

  const container = $("vignette-depth-container");
  container?.classList.toggle("hidden", !state.hasVignette);
  container?.classList.toggle("flex", state.hasVignette);

  bg.classList.toggle("has-vignette", state.hasVignette);

  if (state.hasVignette) {
    document.documentElement.style.setProperty(
      "--vignette-alpha",
      state.vignetteAlpha * 0.4,
    );
  }
}

export function updateVibroSliderUI(isEnabled) {
  const container = $("vibro-level-container");
  container?.classList.toggle("hidden", !isEnabled);
  container?.classList.toggle("flex", isEnabled);
}

export function updateGlass(state) {
  document.documentElement.classList.toggle("glass-effect", state.isLiquidGlass);
}

export function applyNavLabelsVisibility(state) {
  document.body.classList.toggle("hide-nav-labels", state.hideNavLabels);
}

export function updateSliderLabel(sliderId, labelId, labelsArray) {
  const slider = $(sliderId);
  const label = $(labelId);
  if (!slider || !label) return;

  const val = parseInt(slider.value, 10);
  const min = parseFloat(slider.min);
  const max = parseFloat(slider.max);

  label.textContent = t(labelsArray[val] || labelsArray[0]);

  const percent = max - min > 0 ? (val - min) / (max - min) : 0;
  const thumbWidth = 24;
  const trackWidth = slider.offsetWidth;
  if (trackWidth === 0) return;

  const offset = thumbWidth / 2 - percent * thumbWidth;
  label.style.left = `calc(${percent * 100}% + ${offset}px)`;
}

export function syncSliderUIs(state) {
  requestAnimationFrame(() => {
    updateSliderLabel("vignetteSlider", "vignette-label", state.vignetteLabels);
    updateSliderLabel("vibroSlider", "vibro-label", state.vibroLabels);
  });
}

export function persistFontSize(size) {
  safeSetLS("font_size", size);
}

export function persistRingWidth(width) {
  safeSetLS("app_ring_width", width);
}

export function persistVignetteAlpha(alpha) {
  safeSetLS("app_vignette_alpha", alpha);
}