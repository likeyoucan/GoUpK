// Файл: www/js/custom-select/registry.js

const activeSelects = new Set();

export function registerSelect(select) {
  activeSelects.add(select);
}

export function unregisterSelect(select) {
  activeSelects.delete(select);
}

export function getActiveSelects() {
  return activeSelects;
}

export function closeAllSelectsExcept(current) {
  activeSelects.forEach((select) => {
    if (select !== current && select.isOpen) {
      select.close();
    }
  });
}

export function closeAllOpenSelects() {
  activeSelects.forEach((select) => {
    if (select.isOpen) select.close();
  });
}

export function forEachActiveSelect(cb) {
  activeSelects.forEach(cb);
}