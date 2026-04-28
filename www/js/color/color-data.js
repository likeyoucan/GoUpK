// Файл: www/js/color/color-data.js

import { STORAGE_KEYS } from "../constants/storage-keys.js?v=VERSION";

export const MAX_CUSTOM_COLORS = 50;
export const LONG_PRESS_DURATION = 500;
export const MOVE_CANCEL_THRESHOLD = 8;

export function normalizeColor(normalizeHexColor, color) {
  return color ? normalizeHexColor(color).toLowerCase() : "";
}

export function loadCustomColors({ safeGetLS }) {
  try {
    const accent =
      JSON.parse(safeGetLS(STORAGE_KEYS.CUSTOM_ACCENT_COLORS)) || [];
    const bg = JSON.parse(safeGetLS(STORAGE_KEYS.CUSTOM_BG_COLORS)) || [];
    return { accent, bg };
  } catch {
    return { accent: [], bg: [] };
  }
}

export function persistCustomColors({ safeSetLS }, type, colors) {
  safeSetLS(
    type === "accent"
      ? STORAGE_KEYS.CUSTOM_ACCENT_COLORS
      : STORAGE_KEYS.CUSTOM_BG_COLORS,
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
