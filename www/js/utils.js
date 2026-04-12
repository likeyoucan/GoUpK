// utils.js

export const $ = (id) => document.getElementById(id);

export const escapeHTML = (str) =>
  str.replace(
    /[&<>'"]/g,
    (tag) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[
        tag
      ] || tag)
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
  } catch (e) {}
};

export const safeGetLS = (key) => {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    return null;
  }
};

export const safeRemoveLS = (key) => {
  try {
    localStorage.removeItem(key);
  } catch (e) {}
};

let wakeLock = null;

export const requestWakeLock = async () => {
  if ("wakeLock" in navigator && !wakeLock) {
    try {
      wakeLock = await navigator.wakeLock.request("screen");
      wakeLock.addEventListener("release", () => {
        wakeLock = null;
      });
    } catch (err) {}
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

export const formatTimeStr = (totalSeconds, showHoursIfZero = false) => {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  if (h > 0 || showHoursIfZero) return `${pad(h)}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
};

export const formatMsTime = (ms, showMs = true) => {
  const totalS = Math.floor(ms / 1000);
  const h = Math.floor(totalS / 3600);
  const m = Math.floor((totalS % 3600) / 60);
  const s = Math.floor(totalS % 60);
  const milli = Math.floor((ms % 1000) / 10);

  let str = `${pad(m)}:${pad(s)}`;
  if (showMs) str += `.${pad(milli)}`;

  if (h > 0) return `${h}:${str}`;
  return str;
};

export const formatMainDisplay = (ms, showMs = true) => {
  const totalS = Math.floor(ms / 1000);
  const m = Math.floor((totalS % 3600) / 60);
  const s = Math.floor(totalS % 60);
  const milli = Math.floor((ms % 1000) / 10);

  let str = `${pad(m)}:${pad(s)}`;
  if (showMs) str += `.${pad(milli)}`;
  return str;
};

export const getExtendedDisplay = (ms, strDay = "d", strHour = "h") => {
  const totalS = Math.floor(ms / 1000);
  const d = Math.floor(totalS / 86400);
  const h = Math.floor((totalS % 86400) / 3600);

  if (d > 0) return `${d}${strDay} ${h}${strHour}`;
  if (h > 0) return `${h}${strHour}`;
  return "";
};

const createWorker = () => {
  try {
    return new Worker("./js/worker.js");
  } catch (e) {
    return {
      postMessage: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      terminate: () => {},
    };
  }
};

export const bgWorker = createWorker();