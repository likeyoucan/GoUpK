// Файл: www/js/utils.js

export { safeGetLS, safeSetLS, safeRemoveLS } from "./storage.js?v=VERSION";

export const $ = (id) => document.getElementById(id);

export const getCssVariable = (variable) =>
  getComputedStyle(document.documentElement).getPropertyValue(variable).trim();

export const escapeHTML = (str = "") =>
  String(str).replace(
    /[&<>'"]/g,
    (tag) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
      })[tag] || tag,
  );

export const updateText = (el, text) => {
  if (!el) return;
  const next = String(text);
  if (el.textContent !== next) el.textContent = next;
};

export const updateTitle = (text) => {
  const nextTitle = text ? `${text} - Stopwatch Pro` : "Stopwatch Pro";
  if (document.title !== nextTitle) {
    document.title = nextTitle;
  }
};

let wakeLock = null;

export const requestWakeLock = async () => {
  if (!("wakeLock" in navigator)) return;
  if (wakeLock) return;

  try {
    wakeLock = await navigator.wakeLock.request("screen");
    wakeLock.addEventListener("release", () => {
      wakeLock = null;
    });
  } catch {}
};

export const releaseWakeLock = () => {
  if (!wakeLock) return;

  const current = wakeLock;
  wakeLock = null;

  current
    .release()
    .then(() => {})
    .catch(() => {});
};

let toastTimeout = 0;
let lastToastText = "";

export const showToast = (message) => {
  const toast = $("toast");
  const msgEl = $("toast-msg");
  if (!toast || !msgEl) return;

  const nextMsg = String(message || "");
  if (lastToastText !== nextMsg) {
    msgEl.textContent = nextMsg;
    lastToastText = nextMsg;
  }

  if (toastTimeout) {
    clearTimeout(toastTimeout);
    toastTimeout = 0;
  }

  toast.classList.remove("opacity-0", "-translate-y-4");

  toastTimeout = window.setTimeout(() => {
    toast.classList.add("opacity-0", "-translate-y-4");
    toastTimeout = 0;
  }, 3000);
};

export const announceToScreenReader = (text) => {
  const el = $("sr-only-announce");
  if (el) el.textContent = text;
};

// iOS-like GO entry animation trigger.
export function animateGoEnter(el) {
  if (!el) return;
  el.classList.remove("go-enter");
  void el.offsetWidth;
  el.classList.add("go-enter");
}

export const adjustVal = (id, delta) => {
  const el = $(id);
  if (!el) return;

  const currentValue = parseInt(el.value, 10) || 0;

  if (delta > 1 && currentValue < delta) {
    el.value = String(delta);
    return;
  }

  if (delta < -1 && currentValue > 1 && currentValue <= Math.abs(delta)) {
    el.value = "1";
    return;
  }

  const newValue = currentValue + delta;
  el.value = String(Math.max(1, newValue));
};

export const pad = (num) => String(num).padStart(2, "0");

export function getUniqueName(baseName, items, key = "name") {
  const base = String(baseName || "").trim() || "Item";
  let name = base;
  let counter = 1;

  const lowerCaseNames = items.map((item) =>
    String(item?.[key] || "").toLowerCase(),
  );

  while (lowerCaseNames.includes(name.toLowerCase())) {
    name = `${base} ${counter++}`;
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

  const safeMs = Math.max(0, Number(ms) || 0);

  if (showDays) {
    const totalS = Math.floor(safeMs / 1000);
    const d = Math.floor(totalS / 86400);
    const h = Math.floor((totalS % 86400) / 3600);

    if (d > 0) return `${d}${daySuffix} ${h}${hourSuffix}`;
    if (h > 0) return `${h}${hourSuffix}`;
    return "";
  }

  const totalS = Math.floor(safeMs / 1000);
  const h = Math.floor(totalS / 3600);
  const m = Math.floor((totalS % 3600) / 60);
  const s = totalS % 60;

  const parts = [];
  if (h > 0 || forceHours) parts.push(String(h));
  parts.push(pad(m), pad(s));

  let result = parts.join(":");

  if (showMs) {
    const centis = Math.floor((safeMs % 1000) / 10);
    result += `.${pad(centis)}`;
  }

  return result;
}

export const getLuminance = (r, g, b) => {
  const a = [r, g, b].map((v) => {
    const x = (Number(v) || 0) / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  });

  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
};

export const hexToRGB = (hex) => {
  const H = String(hex || "").trim();
  if (!H.startsWith("#")) return { r: 0, g: 0, b: 0 };

  if (H.length === 4) {
    return {
      r: parseInt(H[1] + H[1], 16),
      g: parseInt(H[2] + H[2], 16),
      b: parseInt(H[3] + H[3], 16),
    };
  }

  if (H.length === 7) {
    return {
      r: parseInt(H.slice(1, 3), 16),
      g: parseInt(H.slice(3, 5), 16),
      b: parseInt(H.slice(5, 7), 16),
    };
  }

  return { r: 0, g: 0, b: 0 };
};

export const hexToHSL = (hex) => {
  const H = String(hex || "").trim();
  if (!H.startsWith("#")) return { h: 142, s: 50, l: 50 };

  const { r: r255, g: g255, b: b255 } = hexToRGB(H);
  const r = r255 / 255;
  const g = g255 / 255;
  const b = b255 / 255;

  const cmin = Math.min(r, g, b);
  const cmax = Math.max(r, g, b);
  const delta = cmax - cmin;

  let h = 0;
  let s = 0;
  const l = (cmax + cmin) / 2;

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
    // Vite/ESM-safe worker creation
    return new Worker(new URL("./worker.js", import.meta.url), {
      type: "module",
    });
  } catch (eVite) {
    try {
      // Legacy fallback for current www runtime
      return new Worker("./js/worker.js?v=VERSION");
    } catch (eLegacy) {
      console.error("Failed to create background worker:", eVite, eLegacy);
      return {
        postMessage: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        terminate: () => {},
      };
    }
  }
};

export const bgWorker = createWorker();

export const normalizeHexColor = (hex) => {
  const v = String(hex || "").trim();
  if (v.length !== 4 || v[0] !== "#") return v;

  const r = v[1];
  const g = v[2];
  const b = v[3];
  return `#${r}${r}${g}${g}${b}${b}`;
};
