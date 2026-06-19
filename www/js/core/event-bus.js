// Файл: www/js/core/event-bus.js

/**
 * @template {keyof import("../events/app-events.types.js").AppEventDetailMap} K
 * @param {K} name
 * @param {import("../events/app-events.types.js").AppEventDetailMap[K]} detail
 * @param {Document | Window | HTMLElement} [target=document]
 */
export function emitEvent(name, detail, target = document) {
  if (!target || typeof target.dispatchEvent !== "function") return;
  target.dispatchEvent(new CustomEvent(name, { detail }));
}

/**
 * @template {keyof import("../events/app-events.types.js").AppEventDetailMap} K
 * @param {K} name
 * @param {(event: CustomEvent<import("../events/app-events.types.js").AppEventDetailMap[K]>) => void} handler
 * @param {Document | Window | HTMLElement} [target=document]
 */
export function onEvent(name, handler, target = document) {
  if (!target || typeof target.addEventListener !== "function") {
    return () => {};
  }

  const wrapped = (e) => handler(/** @type {any} */ (e));
  target.addEventListener(name, wrapped);

  return () => {
    target.removeEventListener(name, wrapped);
  };
}
