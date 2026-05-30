// Файл: www/js/theme/theme-colors.js

// Файл: www/js/theme/theme-colors.js

function normalizeHex(hex) {
  const value = String(hex || "").trim();
  if (!value.startsWith("#")) return value;

  if (value.length === 4) {
    return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`.toLowerCase();
  }

  return value.toLowerCase();
}

function getThemeKind(rootEl) {
  return rootEl.classList.contains("dark") ? "dark" : "light";
}

function getDefaultColor(rootEl, varName, fallback) {
  const value = getComputedStyle(rootEl).getPropertyValue(varName).trim();
  return value || fallback;
}

function setRootVar(rootEl, name, value) {
  rootEl.style.setProperty(name, value);
}

function clearContrastClasses(rootEl, bodyEl) {
  rootEl.classList.remove("bg-red-zone", "bg-deep-dark");
  bodyEl.classList.remove("force-light-text", "force-dark-text");
}

function setThemeBasedContrast(rootEl, bodyEl) {
  const theme = getThemeKind(rootEl);
  bodyEl.classList.toggle("force-light-text", theme === "dark");
  bodyEl.classList.toggle("force-dark-text", theme === "light");
  rootEl.classList.remove("bg-red-zone", "bg-deep-dark");
}

function setLuminanceBasedContrast(rootEl, bodyEl, luminance) {
  // "Deep dark" - truly dark backgrounds.
  const isDeepDark = luminance < 0.18;

  // General readable text mode.
  const useLightText = luminance < 0.52;

  rootEl.classList.toggle("bg-deep-dark", isDeepDark);
  bodyEl.classList.toggle("force-light-text", useLightText);
  bodyEl.classList.toggle("force-dark-text", !useLightText);
}

function setRedZoneClass(rootEl, h, s, l) {
  // Warm / aggressive tones where alert palette needs orange tuning.
  const isWarmHue = h >= 340 || h <= 30;
  const isSaturated = s >= 55;
  const isMidLight = l >= 30 && l <= 82;
  rootEl.classList.toggle(
    "bg-red-zone",
    isWarmHue && isSaturated && isMidLight,
  );
}

export function applyAccentVars({ hex, rootEl, hexToHSL }) {
  const theme = getThemeKind(rootEl);

  const resolved =
    hex === "default"
      ? getDefaultColor(
          rootEl,
          `--default-accent-${theme}`,
          theme === "dark" ? "#4ade80" : "#3399ff",
        )
      : normalizeHex(hex);

  const { h } = hexToHSL(resolved);
  setRootVar(rootEl, "--primary-color", resolved);
  setRootVar(rootEl, "--accent-h", String(h || 142));
}

export function applyBgTheme({
  hex,
  uiSettingsManager,
  hexToRGB,
  hexToHSL,
  getLuminance,
}) {
  const rootEl = document.documentElement;
  const bodyEl = document.body;

  const theme = getThemeKind(rootEl);

  const resolvedBg =
    hex === "default"
      ? getDefaultColor(
          rootEl,
          `--default-bg-${theme}`,
          theme === "dark" ? "#000000" : "#fcfdff",
        )
      : normalizeHex(hex);

  setRootVar(rootEl, "--bg-color", resolvedBg);

  const adaptiveOn = !!uiSettingsManager?.isAdaptiveBg;

  if (adaptiveOn) {
    // Adaptive ON: controls and text behavior follow selected theme only.
    rootEl.classList.remove("no-adaptive");
    setThemeBasedContrast(rootEl, bodyEl);
    return;
  }

  // Adaptive OFF: use real background luminance.
  rootEl.classList.add("no-adaptive");

  const { r, g, b } = hexToRGB(resolvedBg);
  const luminance = getLuminance(r, g, b);
  setLuminanceBasedContrast(rootEl, bodyEl, luminance);

  const { h, s, l } = hexToHSL(resolvedBg);
  setRedZoneClass(rootEl, h, s, l);
}
