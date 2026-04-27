// Файл: www/js/theme/theme-colors.js

export function getPairedRestColor(hue) {
  if (hue >= 75 && hue < 185) return "#3b82f6";
  if (hue >= 185 && hue < 250) return "#22c55e";
  if (hue >= 335 || hue < 20) return "#2dd4bf";
  if (hue >= 20 && hue < 75) return "#6366f1";
  if (hue >= 250 && hue < 335) return "#facc15";
  return "#3b82f6";
}

export function getPairedAlertColor(hue, luminance) {
  if (luminance < 10) return "hsl(0, 90%, 60%)";
  if (hue >= 335 || hue < 20) return "hsl(35, 100%, 58%)";
  return "hsl(0, 90%, 60%)";
}

export function applyAccentVars({ hex, rootEl, hexToHSL }) {
  if (hex === "default") {
    rootEl.style.removeProperty("--primary-color");
    rootEl.style.removeProperty("--accent-h");
    rootEl.style.setProperty("--secondary-accent-color", "#3b82f6");
    rootEl.style.setProperty("--alert-color", "hsl(0, 90%, 60%)");
    return;
  }

  rootEl.style.setProperty("--primary-color", hex);
  const { h, l } = hexToHSL(hex);
  rootEl.style.setProperty("--accent-h", h);

  rootEl.style.setProperty("--secondary-accent-color", getPairedRestColor(h));
  rootEl.style.setProperty("--alert-color", getPairedAlertColor(h, l));
}

export function applyBgTheme({
  hex,
  uiSettingsManager,
  hexToRGB,
  hexToHSL,
  getLuminance,
}) {
  const root = document.documentElement;
  const isDark = root.classList.contains("dark");
  document.body.classList.remove("force-light-text", "force-dark-text");

  root.classList.toggle("no-adaptive", !uiSettingsManager.isAdaptiveBg);

  if (hex === "default") {
    root.style.removeProperty("--bg-color");
    root.style.removeProperty("--surface-color");
    return;
  }

  const { r, g, b } = hexToRGB(hex);
  const { h, s, l } = hexToHSL(hex);

  if (!uiSettingsManager.isAdaptiveBg) {
    root.style.setProperty("--bg-color", hex);
    root.style.setProperty(
      "--surface-color",
      `color-mix(in srgb, ${hex}, ${isDark ? "white 10%" : l > 90 ? "black 5%" : "white 25%"})`,
    );

    const luminance = getLuminance(r, g, b);
    document.body.classList.toggle("force-light-text", luminance < 0.48);
    document.body.classList.toggle("force-dark-text", luminance >= 0.48);
    return;
  }

  const sat = isDark ? Math.min(s, 40) : Math.max(s, 20);
  root.style.setProperty("--bg-color", `hsl(${h} ${sat}% ${isDark ? 8 : 94}%)`);
  root.style.setProperty(
    "--surface-color",
    `hsl(${h} ${sat}% ${isDark ? 14 : 98}%)`,
  );
}