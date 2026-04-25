// Файл: www/js/utils.js

export const $ = (id) => document.getElementById(id);

/**
 * Получает значение CSS переменной из :root.
 * @param {string} variable - Имя переменной (например, '--primary-color').
 * @returns {string} - Значение переменной.
 */
export const getCssVariable = (variable) =>
  getComputedStyle(document.documentElement).getPropertyValue(variable).trim();

// FIX #4: защита от null/undefined — str приводится к строке
export const escapeHTML = (str = "") =>
  String(str).replace(
    /[&<>'"]/g,
    (tag) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[
        tag
      ] || tag,
  );

export const updateText = (el, text) => {
  if (el && el.textContent !== String(text)) el.textContent = text;
};

export const updateTitle = (text) => {
  const newTitle = text ? `${text} - Stopwatch Pro` : "Stopwatch Pro";
  if (document.title !== newTitle) {
    document.title = newTitle;
  }
};

export const safeSetLS = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    console.error("Failed to write to localStorage:", e);
  }
};

export const safeGetLS = (key) => {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    console.error("Failed to read from localStorage:", e);
    return null;
  }
};

export const safeRemoveLS = (key) => {
  try {
    localStorage.removeItem(key);
  } catch (e) {
    console.error("Failed to remove from localStorage:", e);
  }
};

let wakeLock = null;

export const requestWakeLock = async () => {
  if ("wakeLock" in navigator && !wakeLock) {
    try {
      wakeLock = await navigator.wakeLock.request("screen");
      wakeLock.addEventListener("release", () => {
        wakeLock = null;
      });
    } catch (err) {
      // Ошибка может возникнуть, если документ неактивен, и это нормально.
    }
  }
};

export const releaseWakeLock = () => {
  if (wakeLock !== null) {
    wakeLock
      .release()
      .then(() => {
        wakeLock = null;
      })
      .catch(() => {
        wakeLock = null;
      });
  }
};

let toastTimeout = null;
export const showToast = (message) => {
  const toast = $("toast");
  if (!toast) return;

  if (toastTimeout) clearTimeout(toastTimeout);

  $("toast-msg").textContent = message;
  toast.classList.remove("opacity-0", "-translate-y-4");

  toastTimeout = setTimeout(() => {
    toast.classList.add("opacity-0", "-translate-y-4");
    toastTimeout = null;
  }, 3000);
};

export const announceToScreenReader = (text) => {
  const el = $("sr-only-announce");
  if (el) el.textContent = text;
};

export const adjustVal = (id, delta) => {
  const el = $(id);
  if (!el) return;

  let currentValue = parseInt(el.value, 10) || 0;

  // Если мы хотим прибавить (+5), а текущее значение меньше 5,
  // то просто установим значение равным 5.
  if (delta > 1 && currentValue < delta) {
    el.value = delta;
    return;
  }

  // Если мы хотим отнять (-5), а текущее значение между 1 и 5,
  // то просто установим значение равным 1.
  if (delta < -1 && currentValue > 1 && currentValue <= Math.abs(delta)) {
    el.value = 1;
    return;
  }

  const newValue = currentValue + delta;
  el.value = Math.max(1, newValue);
};

export const pad = (num) => String(num).padStart(2, "0");

export function getUniqueName(baseName, items, key = "name") {
  let name = baseName;
  let counter = 1;
  const lowerCaseNames = items.map((item) => item[key].toLowerCase());

  while (lowerCaseNames.includes(name.toLowerCase())) {
    name = `${baseName} ${counter++}`;
  }
  return name;
}

export function formatTime(ms, options = {}) {
  const {
    showMs = false,
    forceHours = false,
    showDays = false,
    daySuffix = "d",
    hourSuffix = "h",
  } = options;

  if (showDays) {
    const totalS = Math.floor(ms / 1000);
    const d = Math.floor(totalS / 86400);
    const h = Math.floor((totalS % 86400) / 3600);
    if (d > 0) return `${d}${daySuffix} ${h}${hourSuffix}`;
    if (h > 0) return `${h}${hourSuffix}`;
    return "";
  }

  const totalS = Math.floor(ms / 1000);
  const h = Math.floor(totalS / 3600);
  const m = Math.floor((totalS % 3600) / 60);
  const s = totalS % 60;

  let timeParts = [];
  if (h > 0 || forceHours) {
    timeParts.push(h);
  }
  timeParts.push(pad(m));
  timeParts.push(pad(s));

  let result = timeParts.join(":");

  if (showMs) {
    const milli = Math.floor((ms % 1000) / 10);
    result += `.${pad(milli)}`;
  }

  return result;
}

export const getLuminance = (r, g, b) => {
  const a = [r, g, b].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
};

export const hexToRGB = (H) => {
  if (!H || !H.startsWith("#")) return { r: 0, g: 0, b: 0 };
  let r = 0,
    g = 0,
    b = 0;
  if (H.length === 4) {
    r = parseInt(H[1] + H[1], 16);
    g = parseInt(H[2] + H[2], 16);
    b = parseInt(H[3] + H[3], 16);
  } else if (H.length === 7) {
    r = parseInt(H[1] + H[2], 16);
    g = parseInt(H[3] + H[4], 16);
    b = parseInt(H[5] + H[6], 16);
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
  if (!hex || hex.length !== 4 || hex[0] !== "#") {
    return hex; // Возвращаем как есть, если это не 3-значный hex
  }
  const r = hex[1];
  const g = hex[2];
  const b = hex[3];
  return `#${r}${r}${g}${g}${b}${b}`;
};
