/**
 * utils.js
 * Набор универсальных вспомогательных функций для всего приложения.
 */

// 1. DOM & UI Utilities
// =============================================================================

/**
 * Короткий псевдоним для document.getElementById.
 * @param {string} id - ID HTML-элемента.
 * @returns {HTMLElement|null}
 */
export const $ = (id) => document.getElementById(id);

/**
 * Безопасно обновляет текстовое содержимое элемента, только если оно изменилось.
 * Это предотвращает ненужные перерисовки DOM.
 * @param {HTMLElement} el - Целевой элемент.
 * @param {string|number} text - Новый текст.
 */
export const updateText = (el, text) => {
  if (el && el.textContent !== String(text)) {
    el.textContent = text;
  }
};

/**
 * Заполняет HTML-шаблон данными из объекта.
 * @param {string} templateId - ID элемента <template>.
 * @param {Object} data - Объект с данными для вставки.
 * @returns {HTMLElement|null} Заполненный корневой элемент из шаблона.
 */
export function fillTemplate(templateId, data) {
  const template = $(templateId);
  if (!template) {
    console.error(`Template with id "${templateId}" not found.`);
    return null;
  }
  const clone = template.content.cloneNode(true);
  for (const key in data) {
    const el = clone.querySelector(`[data-template="${key}"]`);
    if (el) {
      el.textContent = data[key];
    }
  }
  return clone.firstElementChild;
}

/**
 * Создает и возвращает SVG-иконку.
 * @param {string} pathData - Данные для атрибута 'd' тега <path>.
 * @param {string[]} [classes=[]] - Массив CSS-классов для SVG-элемента.
 * @returns {SVGSVGElement}
 */
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

/**
 * Показывает toast-уведомление с сообщением.
 * @param {string} message - Сообщение для отображения.
 */
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

/**
 * Объявляет текст для скринридеров.
 * @param {string} text - Текст для объявления.
 */
export const announceToScreenReader = (text) => {
  const el = $("sr-only-announce");
  if (el) el.textContent = text;
};

/**
 * Получает значение CSS переменной из :root.
 * @param {string} variable - Имя переменной (например, '--primary-color').
 * @returns {string} Значение переменной.
 */
export const getCssVariable = (variable) =>
  getComputedStyle(document.documentElement).getPropertyValue(variable).trim();


// 2. Data & Storage Utilities
// =============================================================================

/**
 * Безопасно записывает значение в localStorage.
 * @param {string} key
 * @param {string} value
 */
export const safeSetLS = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    console.error("Failed to write to localStorage:", e);
  }
};

/**
 * Безопасно читает значение из localStorage.
 * @param {string} key
 * @returns {string|null}
 */
export const safeGetLS = (key) => {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    console.error("Failed to read from localStorage:", e);
    return null;
  }
};

/**
 * Безопасно удаляет значение из localStorage.
 * @param {string} key
 */
export const safeRemoveLS = (key) => {
  try {
    localStorage.removeItem(key);
  } catch (e) {
    console.error("Failed to remove from localStorage:", e);
  }
};


// 3. Formatting & Naming Utilities
// =============================================================================

/**
 * Дополняет число нулём слева до двух знаков.
 * @param {number|string} num
 * @returns {string}
 */
export const pad = (num) => String(num).padStart(2, "0");

/**
 * Форматирует время в миллисекундах в строку "ЧЧ:ММ:СС.мс".
 * @param {number} ms - Время в миллисекундах.
 * @param {object} [options={}] - Опции форматирования.
 * @returns {string}
 */
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

/**
 * Генерирует уникальное имя на основе базового, проверяя существующие элементы.
 * @param {string} baseName - Базовое имя.
 * @param {Array<Object>} items - Массив объектов для проверки.
 * @param {string} [key="name"] - Ключ объекта для сравнения.
 * @returns {string} Уникальное имя.
 */
export function getUniqueName(baseName, items, key = "name") {
  let name = baseName;
  let counter = 1;
  const lowerCaseNames = items.map((item) => item[key].toLowerCase());
  while (lowerCaseNames.includes(name.toLowerCase())) {
    name = `${baseName} ${counter++}`;
  }
  return name;
}

/**
 * Обновляет заголовок страницы.
 * @param {string} text - Текст для добавления в заголовок.
 */
export const updateTitle = (text) => {
  const newTitle = text ? `${text} - Stopwatch Pro` : "Stopwatch Pro";
  if (document.title !== newTitle) {
    document.title = newTitle;
  }
};


// 4. Color Utilities
// =============================================================================

export const hexToRGB = (H) => {
  if (!H || !H.startsWith("#")) return { r: 0, g: 0, b: 0 };
  let r = 0, g = 0, b = 0;
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

export const getLuminance = (r, g, b) => {
  const a = [r, g, b].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
};

export const hexToHSL = (H) => {
  if (!H || !H.startsWith("#")) return { h: 142, s: 50, l: 50 };
  const { r: r255, g: g255, b: b255 } = hexToRGB(H);
  let r = r255 / 255, g = g255 / 255, b = b255 / 255;
  let cmin = Math.min(r, g, b), cmax = Math.max(r, g, b), delta = cmax - cmin;
  let h = 0, s = 0, l = (cmax + cmin) / 2;
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

export const normalizeHexColor = (hex) => {
    if (!hex || hex.length !== 4 || hex[0] !== '#') {
        return hex;
    }
    const r = hex[1], g = hex[2], b = hex[3];
    return `#${r}${r}${g}${g}${b}${b}`;
};


// 5. Native & Browser API Wrappers
// =============================================================================

let wakeLock = null;
export const requestWakeLock = async () => {
  if ("wakeLock" in navigator && !wakeLock) {
    try {
      wakeLock = await navigator.wakeLock.request("screen");
      wakeLock.addEventListener("release", () => { wakeLock = null; });
    } catch (err) { /* Ошибка нормальна, если документ неактивен */ }
  }
};

export const releaseWakeLock = () => {
  if (wakeLock !== null) {
    wakeLock.release().then(() => { wakeLock = null; }).catch(() => { wakeLock = null; });
  }
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


// 6. Miscellaneous / Specific Helpers
// =============================================================================

export const escapeHTML = (str) =>
  str.replace(
    /[&<>'"]/g,
    (tag) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[tag] || tag,
  );

export const adjustVal = (id, delta) => {
  const el = $(id);
  if (!el) return;
  let currentValue = parseInt(el.value, 10) || 0;
  if (delta > 1 && currentValue < delta) {
    el.value = delta;
    return;
  }
  if (delta < -1 && currentValue > 1 && currentValue <= Math.abs(delta)) {
    el.value = 1;
    return;
  }
  el.value = Math.max(1, currentValue + delta);
};