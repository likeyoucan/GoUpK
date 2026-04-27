// Файл: www/js/color/color-data.js

export const MAX_CUSTOM_COLORS = 50;
export const LONG_PRESS_DURATION = 500;
export const MOVE_CANCEL_THRESHOLD = 8;

export function normalizeColor(normalizeHexColor, color) {
  return color ? normalizeHexColor(color).toLowerCase() : "";
}

export function loadCustomColors({ safeGetLS }) {
  try {
    const accent = JSON.parse(safeGetLS("custom_accent_colors")) || [];
    const bg = JSON.parse(safeGetLS("custom_bg_colors")) || [];
    return { accent, bg };
  } catch {
    return { accent: [], bg: [] };
  }
}

export function persistCustomColors({ safeSetLS }, type, colors) {
  safeSetLS(
    type === "accent" ? "custom_accent_colors" : "custom_bg_colors",
    JSON.stringify(colors),
  );
}

export function removeColorFromList({ normalizeHexColor }, list, color) {
  const target = normalizeColor(normalizeHexColor, color);
  const index = list
    .map((c) => normalizeColor(normalizeHexColor, c))
    .indexOf(target);

  if (index > -1) {
    list.splice(index, 1);
    return true;
  }
  return false;
}

export function buildBlocklist({
  isAccent,
  standardAccentColors,
  standardBgColors,
  customAccentColors,
  customBgColors,
  normalizeHexColor,
}) {
  const raw = isAccent
    ? [...standardAccentColors, ...customAccentColors]
    : [...standardBgColors, ...customBgColors];

  return raw.map((c) => normalizeColor(normalizeHexColor, c));
}