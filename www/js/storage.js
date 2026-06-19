// Файл: www/js/storage.js

import {
  storageGet,
  storageSet,
  storageRemove,
} from "./core/storage-bridge.js?v=VERSION";

export const safeSetLS = (key, value) => {
  storageSet(key, value);
};

export const safeGetLS = (key) => {
  return storageGet(key);
};

export const safeRemoveLS = (key) => {
  storageRemove(key);
};
