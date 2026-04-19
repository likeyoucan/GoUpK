// Файл: www/js/utils.js

export const $ = (id) => document.getElementById(id);

export const escapeHTML = (str) =>
  str.replace(
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
      // console.error(`${err.name}, ${err.message}`);
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
  if (el) el.value = Math.max(1, (parseInt(el.value) || 0) + delta);
};

export const pad = (num) => String(num).padStart(2, "0");

/**
 * Генерирует уникальное имя на основе базового, проверяя его в массиве объектов.
 * @param {string} baseName - Базовое имя.
 * @param {Array<Object>} items - Массив объектов для проверки.
 * @param {string} [key='name'] - Ключ объекта, по которому проверять имя.
 * @returns {string} - Уникальное имя.
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
 * Функция форматирования времени.
 * @param {number} ms - Время в миллисекундах.
 * @param {object} options - Опции форматирования.
 * @param {boolean} [options.showMs=false] - Показывать миллисекунды?
 * @param {boolean} [options.forceHours=false] - Всегда показывать часы, даже если их 0?
 * @param {boolean} [options.showDays=false] - Показывать дни?
 * @param {string} [options.daySuffix='d'] - Суффикс для дней.
 * @param {string} [options.hourSuffix='h'] - Суффикс для часов.
 * @returns {string} - Отформатированная строка времени.
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

// --- Worker Initialization ---
const createWorker = () => {
  try {
    return new Worker("./js/worker.js?v=VERSION");
  } catch (e) {
    console.error("Failed to create background worker:", e);
    // Возвращаем "пустышку", чтобы приложение не упало, если воркер не создался
    return {
      postMessage: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      terminate: () => {},
    };
  }
};

export const bgWorker = createWorker();
