// Файл: www/js/theme/theme-colors.js

export function getPairedRestColor(hue) {
  if (hue >= 75 && hue < 185) return "#3b82f6";
  if (hue >= 185 && hue < 250) return "#22c55e";
  if (hue >= 335 || hue < 20) return "#2dd4bf";
  if (hue >= 20 && hue < 75) return "#6366f1";
  if (hue >= 250 && hue < 335) return "#facc15";
  return "#3b82f6";
}

// Держим danger в красной зоне, не уводим в светло-оранжевый.
export function getPairedAlertColor(hue, luminance) {
  if (luminance > 88) return "hsl(0 82% 48%)";
  if (hue >= 20 && hue < 80) return "hsl(0 84% 52%)";
  return "hsl(0 90% 60%)";
}

function parseHsl(hslString) {
  const nums = String(hslString).match(/-?\d+(\.\d+)?/g) || [];
  const h = Number(nums[0] || 0);
  const s = Number(nums[1] || 0);
  const l = Number(nums[2] || 0);
  return { h, s, l };
}

function hslToRgb(h, s, l) {
  const hh = ((h % 360) + 360) % 360;
  const ss = Math.max(0, Math.min(100, s)) / 100;
  const ll = Math.max(0, Math.min(100, l)) / 100;

  const c = (1 - Math.abs(2 * ll - 1)) * ss;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = ll - c / 2;

  let r1 = 0;
  let g1 = 0;
  let b1 = 0;

  if (hh < 60) {
    r1 = c;
    g1 = x;
    b1 = 0;
  } else if (hh < 120) {
    r1 = x;
    g1 = c;
    b1 = 0;
  } else if (hh < 180) {
    r1 = 0;
    g1 = c;
    b1 = x;
  } else if (hh < 240) {
    r1 = 0;
    g1 = x;
    b1 = c;
  } else if (hh < 300) {
    r1 = x;
    g1 = 0;
    b1 = c;
  } else {
    r1 = c;
    g1 = 0;
    b1 = x;
  }

  return {
    r: Math.round((r1 + m) * 255),
    g: Math.round((g1 + m) * 255),
    b: Math.round((b1 + m) * 255),
  };
}

function relativeLuminance(r, g, b) {
  const norm = [r, g, b].map((v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  return norm[0] * 0.2126 + norm[1] * 0.7152 + norm[2] * 0.0722;
}

function contrastRatio(l1, l2) {
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}

function pickReadableTextForHsl(hslString) {
  const { h, s, l } = parseHsl(hslString);
  const { r, g, b } = hslToRgb(h, s, l);
  const bgLum = relativeLuminance(r, g, b);

  const whiteLum = 1;
  const darkLum = relativeLuminance(17, 24, 39); // #111827

  const cWhite = contrastRatio(bgLum, whiteLum);
  const cDark = contrastRatio(bgLum, darkLum);

  return cDark >= cWhite ? "#111827" : "#ffffff";
}

function isRedLikeHue(h) {
  return h >= 345 || h <= 15;
}

export function applyAccentVars({ hex, rootEl, hexToHSL }) {
  if (hex === "default") {
    rootEl.style.removeProperty("--primary-color");
    rootEl.style.removeProperty("--accent-h");
    rootEl.style.setProperty("--secondary-accent-color", "#8b5cf6"); // было #3b82f6

    const alert = "hsl(0 90% 60%)";
    rootEl.style.setProperty("--alert-color", alert);
    rootEl.style.setProperty("--alert-color-fg", pickReadableTextForHsl(alert));
    return;
  }

  rootEl.style.setProperty("--primary-color", hex);
  const { h, l } = hexToHSL(hex);
  rootEl.style.setProperty("--accent-h", h);

  rootEl.style.setProperty("--secondary-accent-color", getPairedRestColor(h));

  const alert = getPairedAlertColor(h, l);
  rootEl.style.setProperty("--alert-color", alert);
  rootEl.style.setProperty("--alert-color-fg", pickReadableTextForHsl(alert));
}

export function applyBgTheme({
  hex,
  uiSettingsManager,
  hexToRGB,
  hexToHSL,
  getLuminance,
}) {
  const root = document.documentElement;
  document.body.classList.remove("force-light-text", "force-dark-text");

  root.classList.toggle("no-adaptive", !uiSettingsManager.isAdaptiveBg);

  if (hex === "default") {
    root.style.removeProperty("--bg-color");
    root.style.removeProperty("--surface-color");
    root.classList.remove("bg-red-zone");
    return;
  }

  const { r, g, b } = hexToRGB(hex);
  const { h, s, l } = hexToHSL(hex);
  const luminance = getLuminance(r, g, b);

  root.classList.toggle("bg-red-zone", isRedLikeHue(h) && s > 32);

  if (!uiSettingsManager.isAdaptiveBg) {
    // При выключенных adaptive colors: определяем light/dark по выбранному bg.
    const shouldUseDarkTheme = luminance < 0.42 && l < 62;

    root.classList.toggle("dark", shouldUseDarkTheme);
    root.style.colorScheme = shouldUseDarkTheme ? "dark" : "light";

    root.style.setProperty("--bg-color", hex);
    root.style.setProperty(
      "--surface-color",
      `color-mix(in srgb, ${hex}, ${
        shouldUseDarkTheme ? "white 10%" : l > 88 ? "black 4%" : "white 22%"
      })`,
    );

    // force-* для контраста UI-текста/иконок на экстремальных фонах
    document.body.classList.toggle("force-light-text", shouldUseDarkTheme);
    document.body.classList.toggle("force-dark-text", !shouldUseDarkTheme);
    return;
  }

  const isDark = root.classList.contains("dark");
  const sat = isDark ? Math.min(s, 40) : Math.max(s, 20);

  root.style.setProperty("--bg-color", `hsl(${h} ${sat}% ${isDark ? 8 : 94}%)`);
  root.style.setProperty(
    "--surface-color",
    `hsl(${h} ${sat}% ${isDark ? 14 : 98}%)`,
  );
}
