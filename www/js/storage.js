// Файл: www/js/storage.js

const DEBUG_STORAGE = false;

function logStorageError(action, key, error) {
  if (!DEBUG_STORAGE) return;
  console.error(`[storage:${action}] key="${key}"`, error);
}

export const safeSetLS = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    logStorageError("set", key, e);
  }
};

export const safeGetLS = (key) => {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    logStorageError("get", key, e);
    return null;
  }
};

export const safeRemoveLS = (key) => {
  try {
    localStorage.removeItem(key);
  } catch (e) {
    logStorageError("remove", key, e);
  }
};
