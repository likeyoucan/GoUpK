// Файл: www/js/events/app-events.js

/**
 * @template {keyof import("./app-events.types.js").AppEventDetailMap} K
 * @param {K} name
 * @param {import("./app-events.types.js").AppEventDetailMap[K]} detail
 */
export function emitAppEvent(name, detail) {
  document.dispatchEvent(new CustomEvent(name, { detail }));
}

/**
 * @template {keyof import("./app-events.types.js").AppEventDetailMap} K
 * @param {K} name
 * @param {(event: CustomEvent<import("./app-events.types.js").AppEventDetailMap[K]>) => void} handler
 * @param {Document | Window | HTMLElement} [target=document]
 */
export function onAppEvent(name, handler, target = document) {
  if (!target || typeof target.addEventListener !== "function") {
    return () => {};
  }

  const wrapped = (e) => handler(/** @type {any} */ (e));
  target.addEventListener(name, wrapped);

  return () => {
    target.removeEventListener(name, wrapped);
  };
}
