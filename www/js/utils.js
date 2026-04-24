// Файл: www/js/utils.js

// Константы для ключей localStorage
export const LS_KEYS = {
  APP_LANG: "app_lang",
  APP_SOUND: "app_sound",
  APP_VIBRO: "app_vibro",
  APP_VIBRO_LEVEL: "app_vibro_level",
  APP_VOLUME: "app_volume",
  APP_SOUND_THEME: "app_sound_theme",
  THEME_MODE: "theme_mode",
  THEME_COLOR: "theme_color",
  THEME_BG_COLOR: "theme_bg_color",
  FONT_SIZE: "font_size",
  APP_ADAPTIVE_BG: "app_adaptive_bg",
  APP_VIGNETTE: "app_vignette",
  APP_VIGNETTE_ALPHA: "app_vignette_alpha",
  APP_LIQUID_GLASS: "app_liquid_glass",
  APP_HIDE_NAV_LABELS: "app_hide_nav_labels",
  APP_RING_WIDTH: "app_ring_width",
  APP_SHOW_MS: "app_show_ms",
  APP_SW_MINUTE_BEEP: "app_sw_minute_beep",
  SW_SAVED_SESSIONS: "sw_saved_sessions",
  TB_WORKOUTS: "tb_workouts",
  TB_SELECTED_ID: "tb_selected_id",
  CUSTOM_ACCENT_COLORS: "custom_accent_colors",
  CUSTOM_BG_COLORS: "custom_bg_colors",
};

export const $ = (id) => document.getElementById(id);

export const getCssVariable = (variable) => 
  getComputedStyle(document.documentElement).getPropertyValue(variable).trim();

// ИСПРАВЛЕНИЕ (Пункт #4): Защита от null/undefined
export const escapeHTML = (str) =>
  String(str || "").replace(
    /[&<>'"]/g,
    (tag) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[tag] || tag,
  );

export const updateText = (el, text) => {
  if (el && el.textContent !== String(text)) el.textContent = text;
};

export const updateTitle = (text) => {
  const newTitle = text ? `${text} - Stopwatch Pro` : "Stopwatch Pro";
  if (document.title !== newTitle) document.title = newTitle;
};

// ИСПРАВЛЕНИЕ (Пункт #12): Логирование ошибок только в "dev-режиме" (проверяем наличие Eruda)
const logError = (message, error) => {
  if (window.eruda) {
    console.error(message, error);
  }
};

export const safeSetLS = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    logError("Failed to write to localStorage:", e);
  }
};

export const safeGetLS = (key) => {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    logError("Failed to read from localStorage:", e);
    return null;
  }
};

export const safeRemoveLS = (key) => {
  try {
    localStorage.removeItem(key);
  } catch (e) {
    logError("Failed to remove from localStorage:", e);
  }
};

// (Код для WakeLock, Toast, Announce без изменений)
let wakeLock = null;
export const requestWakeLock = async () => { /*...*/ };
export const releaseWakeLock = () => { /*...*/ };
let toastTimeout = null;
export const showToast = (message) => { /*...*/ };
export const announceToScreenReader = (text) => { /*...*/ };

export const adjustVal = (id, delta) => { /*...*/ };
export const pad = (num) => String(num).padStart(2, "0");
export const getUniqueName = (baseName, items, key = "name") => { /*...*/ };
export function formatTime(ms, options = {}) { /*...*/ };
export const getLuminance = (r, g, b) => { /*...*/ };

// ИСПРАВЛЕНИЕ (Пункт #13): Используем .slice() вместо конкатенации
export const hexToRGB = (H) => {
  if (!H || !H.startsWith("#")) return { r: 0, g: 0, b: 0 };
  let r = 0, g = 0, b = 0;
  if (H.length === 4) {
    r = parseInt(H[1] + H[1], 16);
    g = parseInt(H[2] + H[2], 16);
    b = parseInt(H[3] + H[3], 16);
  } else if (H.length === 7) {
    r = parseInt(H.slice(1, 3), 16);
    g = parseInt(H.slice(3, 5), 16);
    b = parseInt(H.slice(5, 7), 16);
  }
  return { r, g, b };
};

export const hexToHSL = (H) => {
  if (!H || !H.startsWith("#")) return { h: 142, s: 50, l: 50 };
  const { r: r255, g: g255, b: b255 } = hexToRGB(H);
  let r = r255 / 255,
    g = g255 / 255,
    b = b255 / 255;
  let cmin = Math.min(r, g, b),
    cmax = Math.max(r, g, b),
    delta = cmax - cmin;
  let h = 0,
    s = 0,
    l = (cmax + cmin) / 2;
  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1));
    if (cmax === r) h = ((g - b) / delta) % 6;
    else if (cmax === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
  }
  h = Math.round(h * 60);
  if (h < 0) h += 360;
  return { h, s: +(s * 100).toFixed(1), l: +(l * 100).toFixed(1) };
};

export const createSVGIcon = (pathData, classes = []) => {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");

  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2.5");
  svg.setAttribute("focusable", "false");
  svg.setAttribute("aria-hidden", "true");
  if (classes.length) svg.classList.add(...classes);

  path.setAttribute("d", pathData);
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");

  svg.appendChild(path);
  return svg;
};

const createWorker = () => {
  try {
    return new Worker("./js/worker.js?v=VERSION");
  } catch (e) {
    console.error("Failed to create background worker:", e);
    return {
      postMessage: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      terminate: () => {},
    };
  }
};

export const bgWorker = createWorker();

/**
 * Преобразует 3-значный HEX-цвет в 6-значный.
 * @param {string} hex - HEX-цвет (например, '#000' или '#f0c').
 * @returns {string} - 6-значный HEX-цвет (например, '#000000' или '#ff00cc').
 */
export const normalizeHexColor = (hex) => {
    if (!hex || hex.length !== 4 || hex[0] !== '#') {
        return hex; // Возвращаем как есть, если это не 3-значный hex
    }
    const r = hex[1];
    const g = hex[2];
    const b = hex[3];
    return `#${r}${r}${g}${g}${b}${b}`;
};
