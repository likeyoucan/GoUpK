// Файл: www/js/theme/theme-repository.js

import { safeGetLS, safeSetLS, safeRemoveLS } from "../utils.js?v=VERSION";
import { STORAGE_KEYS } from "../constants/storage-keys.js?v=VERSION";

export function loadThemeSettings() {
  return {
    mode: safeGetLS(STORAGE_KEYS.THEME_MODE) || "system",
    accent: safeGetLS(STORAGE_KEYS.THEME_COLOR) || "default",
    bg: safeGetLS(STORAGE_KEYS.THEME_BG_COLOR) || "default",
  };
}

export function saveThemeMode(mode) {
  safeSetLS(STORAGE_KEYS.THEME_MODE, mode);
}

export function saveThemeAccent(accent) {
  safeSetLS(STORAGE_KEYS.THEME_COLOR, accent);
}

export function saveThemeBg(bg) {
  safeSetLS(STORAGE_KEYS.THEME_BG_COLOR, bg);
}

export function resetThemeSettings() {
  safeRemoveLS(STORAGE_KEYS.THEME_MODE);
  safeRemoveLS(STORAGE_KEYS.THEME_COLOR);
  safeRemoveLS(STORAGE_KEYS.THEME_BG_COLOR);
}
