// Файл: www/js/ui-settings/ui-settings-apply.js

import { $, safeSetLS } from "../utils.js?v=VERSION";
import { t } from "../i18n.js?v=VERSION";
import { STORAGE_KEYS } from "../constants/storage-keys.js?v=VERSION";

export function applyUiSettingsToControls(state) {
  if ($("toggle-adaptive-bg"))
    $("toggle-adaptive-bg").checked = state.isAdaptiveBg;
  if ($("toggle-vignette")) $("toggle-vignette").checked = state.hasVignette;
  if ($("toggle-glass")) $("toggle-glass").checked = state.isLiquidGlass;
  if ($("toggle-nav-labels"))
    $("toggle-nav-labels").checked = state.hideNavLabels;
  if ($("toggle-ms")) $("toggle-ms").checked = state.showMs;
  if ($("toggle-foreground-banner")) {
    $("toggle-foreground-banner").checked = state.showForegroundBanner;
  }
  if ($("toggle-sw-minute-beep")) {
    $("toggle-sw-minute-beep").checked = state.swMinuteBeep;
  }

  if ($("toggle-ads")) {
    $("toggle-ads").checked = state.adsEnabled;
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
  document.documentElement.classList.toggle(
    "glass-effect",
    state.isLiquidGlass,
  );
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

  const rect = slider.getBoundingClientRect();
  const trackWidth = rect.width;
  if (!trackWidth) return;

  const percent = max - min > 0 ? (val - min) / (max - min) : 0;

  const cssThumb = getComputedStyle(document.documentElement)
    .getPropertyValue("--tr-thumb-size")
    .trim();
  const thumb = Number.parseFloat(cssThumb) || 24;

  const x = percent * trackWidth;
  const leftPx = x + thumb / 2 - percent * thumb;

  label.style.left = `${leftPx}px`;
}

function parseLabels(raw) {
  return String(raw || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function updateRangeValueByDataset(input) {
  if (!input) return;

  const valueId = input.dataset.rangeValueId;
  if (!valueId) return;

  const valueEl = $(valueId);
  if (!valueEl) return;

  const mode = input.dataset.rangeMode || "number";
  const unit = input.dataset.rangeUnit || "";
  const raw = Number(input.value);

  if (mode === "labels") {
    const labels = parseLabels(input.dataset.rangeLabels);
    const idx = Number.isFinite(raw) ? Math.round(raw) : 0;
    const key = labels[idx] || labels[0] || "";
    valueEl.textContent = key ? t(key) : "";
    return;
  }

  if (mode === "percent01") {
    const pct = Math.round((Number.isFinite(raw) ? raw : 0) * 100);
    valueEl.textContent = `${pct}%`;
    return;
  }

  if (mode === "number") {
    const num = Number.isFinite(raw) ? raw : 0;
    valueEl.textContent = `${num}${unit}`;
    return;
  }

  valueEl.textContent = `${input.value}${unit}`;
}

// Backward-compatible helper for current code paths.
export function updateRangeValueRight(sliderId, valueId, labelsArray) {
  const slider = $(sliderId);
  if (!slider) return;

  slider.dataset.rangeValueId = valueId;
  slider.dataset.rangeMode = "labels";
  slider.dataset.rangeLabels = (labelsArray || []).join(",");

  updateRangeValueByDataset(slider);
}

export function syncAllRangeValuesRight(root = document) {
  root
    .querySelectorAll('input[type="range"][data-range-value-id]')
    .forEach((input) => updateRangeValueByDataset(input));
}

export function syncSliderUIs(state) {
  requestAnimationFrame(() => {
    updateSliderLabel("vignetteSlider", "vignette-label", state.vignetteLabels);
    updateSliderLabel("vibroSlider", "vibro-label", state.vibroLabels);
    syncAllRangeValuesRight();
  });
}

export function persistFontSize(size) {
  safeSetLS(STORAGE_KEYS.FONT_SIZE, String(size));
}

export function persistRingWidth(width) {
  safeSetLS(STORAGE_KEYS.APP_RING_WIDTH, String(width));
}

export function persistVignetteAlpha(alpha) {
  safeSetLS(STORAGE_KEYS.APP_VIGNETTE_ALPHA, String(alpha));
}
