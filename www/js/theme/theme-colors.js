// Файл: www/js/theme/theme-colors.js

export function getPairedRestColor(hue) {
  if (hue >= 75 && hue < 185) return "#3b82f6";
  if (hue >= 185 && hue < 250) return "#22c55e";
  if (hue >= 335 || hue < 20) return "#2dd4bf";
  if (hue >= 20 && hue < 75) return "#6366f1";
  if (hue >= 250 && hue < 335) return "#facc15";
  return "#3b82f6";
}

// Keep danger in warm red-orange zone on vivid/red backgrounds.
export function getPairedAlertColor(hue, luminance) {
  if (luminance > 88) return "hsl(16 84% 50%)";
  if (hue >= 20 && hue < 80) return "hsl(18 88% 54%)";
  return "hsl(20 92% 54%)";
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

function hexToRgbSafe(hex) {
  const h = String(hex || "").trim();
  if (!h.startsWith("#")) return null;

  if (h.length === 4) {
    return {
      r: parseInt(h[1] + h[1], 16),
      g: parseInt(h[2] + h[2], 16),
      b: parseInt(h[3] + h[3], 16),
    };
  }

  if (h.length === 7) {
    return {
      r: parseInt(h.slice(1, 3), 16),
      g: parseInt(h.slice(3, 5), 16),
      b: parseInt(h.slice(5, 7), 16),
    };
  }

  return null;
}

function pickOnPrimaryFromHex(hex) {
  const rgb = hexToRgbSafe(hex);
  if (!rgb) return "#ffffff";

  const lum = relativeLuminance(rgb.r, rgb.g, rgb.b);
  return lum > 0.54 ? "#111827" : "#ffffff";
}

// Important rule:
// This adaptation works ONLY when adaptive colors are enabled.
// If adaptive is OFF (html.no-adaptive), white stays white and black stays black.
function normalizeHex6(hex) {
  const h = String(hex || "")
    .trim()
    .toLowerCase();
  if (!h.startsWith("#")) return h;
  if (h.length === 4) {
    return `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}`;
  }
  return h;
}

// Important rule:
// This adaptation works ONLY when adaptive colors are enabled.
// If adaptive is OFF (html.no-adaptive), white stays white and black stays black.
function adaptExtremeAccentForAdaptive(hex, rootEl) {
  if (rootEl.classList.contains("no-adaptive")) return hex;

  const norm = normalizeHex6(hex);
  const isDarkTheme = rootEl.classList.contains("dark");

  // Only exact white/black are adapted.
  if (!isDarkTheme && norm === "#ffffff") return "#d1d5db"; // light gray
  if (isDarkTheme && norm === "#000000") return "#4b5563"; // dark gray

  return hex;
}

function isRedLikeHue(h) {
  return h >= 345 || h <= 15;
}

function applyIconHoverPalette({ root, hue, adaptive, isRedZone }) {
  // Defaults: share green, edit blue, delete from alert.
  let shareColor = "#16a34a";
  let shareBg = "color-mix(in srgb, #16a34a 16%, transparent)";
  let editColor = "#2563eb";
  let editBg = "color-mix(in srgb, #2563eb 16%, transparent)";
  let deleteColor =
    "color-mix(in srgb, var(--alert-color) 92%, var(--text-color))";
  let deleteBg = "color-mix(in srgb, var(--alert-color) 20%, transparent)";

  if (!adaptive) {
    if (isRedZone) {
      // Red background: avoid red-on-red for delete hover.
      deleteColor = "#c2410c";
      deleteBg = "color-mix(in srgb, #fb923c 28%, transparent)";
    } else if (hue >= 185 && hue < 255) {
      // Blue/cyan background: avoid blue/green collisions.
      shareColor = "#d97706";
      shareBg = "color-mix(in srgb, #f59e0b 18%, transparent)";
      editColor = "#7c3aed";
      editBg = "color-mix(in srgb, #8b5cf6 18%, transparent)";
    } else if (hue >= 95 && hue < 165) {
      // Green backgrounds: shift share/edit away from green.
      shareColor = "#2563eb";
      shareBg = "color-mix(in srgb, #2563eb 16%, transparent)";
      editColor = "#7c3aed";
      editBg = "color-mix(in srgb, #8b5cf6 18%, transparent)";
    }
  }

  root.style.setProperty("--icon-share-hover-color", shareColor);
  root.style.setProperty("--icon-share-hover-bg", shareBg);
  root.style.setProperty("--icon-edit-hover-color", editColor);
  root.style.setProperty("--icon-edit-hover-bg", editBg);
  root.style.setProperty("--icon-delete-hover-color", deleteColor);
  root.style.setProperty("--icon-delete-hover-bg", deleteBg);
}

/**
 * @param {{hex: string, rootEl: HTMLElement, hexToHSL: (hex: string) => {h: number, l: number}}} params
 */
export function applyAccentVars({ hex, rootEl, hexToHSL }) {
  const isDark = rootEl.classList.contains("dark");
  const isRedZone =
    rootEl.classList.contains("no-adaptive") &&
    rootEl.classList.contains("bg-red-zone");

  const forcedRedZoneAlert = isDark ? "hsl(28 88% 66%)" : "hsl(28 90% 62%)";

  if (hex === "default") {
    rootEl.style.removeProperty("--primary-color");
    rootEl.style.removeProperty("--accent-h");

    // In default theme keep high-contrast rest color.
    rootEl.style.setProperty(
      "--secondary-accent-color",
      isDark ? "#60a5fa" : "#4ade80",
    );

    rootEl.style.setProperty("--pro-cta-color", "#34d399");
    rootEl.style.setProperty("--pro-badge-bg", "#34d399");
    rootEl.style.setProperty("--pro-badge-fg", "#052e16");

    rootEl.style.setProperty(
      "--on-primary-color",
      isDark ? "#111827" : "#ffffff",
    );

    if (isRedZone) {
      rootEl.style.setProperty("--alert-color", forcedRedZoneAlert);
      rootEl.style.setProperty(
        "--alert-color-fg",
        pickReadableTextForHsl(forcedRedZoneAlert),
      );
      return;
    }

    const alert = "hsl(20 92% 54%)";
    rootEl.style.setProperty("--alert-color", alert);
    rootEl.style.setProperty("--alert-color-fg", pickReadableTextForHsl(alert));
    return;
  }

  const effectiveHex = adaptExtremeAccentForAdaptive(hex, rootEl);

  rootEl.style.setProperty("--primary-color", effectiveHex);
  const { h, l } = hexToHSL(effectiveHex);
  rootEl.style.setProperty("--accent-h", h);

  rootEl.style.setProperty("--secondary-accent-color", getPairedRestColor(h));
  rootEl.style.setProperty("--pro-cta-color", effectiveHex);

  rootEl.style.removeProperty("--pro-badge-bg");
  rootEl.style.removeProperty("--pro-badge-fg");

  rootEl.style.setProperty(
    "--on-primary-color",
    pickOnPrimaryFromHex(effectiveHex),
  );

  if (isRedZone) {
    rootEl.style.setProperty("--alert-color", forcedRedZoneAlert);
    rootEl.style.setProperty(
      "--alert-color-fg",
      pickReadableTextForHsl(forcedRedZoneAlert),
    );
    return;
  }

  const alert = getPairedAlertColor(h, l);
  rootEl.style.setProperty("--alert-color", alert);
  rootEl.style.setProperty("--alert-color-fg", pickReadableTextForHsl(alert));
}

/**
 * @param {{
 *   hex: string,
 *   uiSettingsManager: {isAdaptiveBg: boolean},
 *   hexToRGB: (hex: string) => {r: number, g: number, b: number},
 *   hexToHSL: (hex: string) => {h: number, s: number, l: number},
 *   getLuminance: (r: number, g: number, b: number) => number
 * }} params
 */
export function applyBgTheme({
  hex,
  uiSettingsManager,
  hexToRGB,
  hexToHSL,
  getLuminance,
}) {
  const root = document.documentElement;
  document.body.classList.remove("force-light-text", "force-dark-text");

  const isAdaptive = !!uiSettingsManager.isAdaptiveBg;
  root.classList.toggle("no-adaptive", !isAdaptive);

  if (hex === "default") {
    root.style.removeProperty("--bg-color");
    root.style.removeProperty("--surface-color");
    root.classList.remove("bg-red-zone", "bg-deep-dark");

    applyIconHoverPalette({
      root,
      hue: 210,
      adaptive: isAdaptive,
      isRedZone: false,
    });
    return;
  }

  const { r, g, b } = hexToRGB(hex);
  const { h, s, l } = hexToHSL(hex);
  const luminance = getLuminance(r, g, b);

  // Red zone is only meaningful for non-adaptive custom background mode.
  const isRedZone = !isAdaptive && isRedLikeHue(h) && s > 20;
  root.classList.toggle("bg-red-zone", isRedZone);

  applyIconHoverPalette({
    root,
    hue: h,
    adaptive: isAdaptive,
    isRedZone,
  });

  if (!isAdaptive) {
    // Combined "light/dark" estimation for bright saturated tones.
    const perceived = (r * 299 + g * 587 + b * 114) / 255000;
    const shouldUseDarkText = luminance >= 0.42 || perceived >= 0.58 || l >= 58;

    root.classList.toggle("bg-deep-dark", !shouldUseDarkText);

    root.style.setProperty("--bg-color", hex);
    root.style.setProperty(
      "--surface-color",
      `color-mix(in srgb, ${hex}, ${
        shouldUseDarkText ? (l > 88 ? "black 4%" : "white 22%") : "white 10%"
      })`,
    );

    document.body.classList.toggle("force-light-text", !shouldUseDarkText);
    document.body.classList.toggle("force-dark-text", shouldUseDarkText);
    return;
  }

  root.classList.remove("bg-deep-dark");

  const isDarkLocal = root.classList.contains("dark");
  const sat = isDarkLocal ? Math.min(s, 40) : Math.max(s, 20);

  root.style.setProperty(
    "--bg-color",
    `hsl(${h} ${sat}% ${isDarkLocal ? 8 : 94}%)`,
  );
  root.style.setProperty(
    "--surface-color",
    `hsl(${h} ${sat}% ${isDarkLocal ? 14 : 98}%)`,
  );
}

// Explicit re-export to avoid ESM named export mismatch in some cached deploy states.
export { applyAccentVars, applyBgTheme };
