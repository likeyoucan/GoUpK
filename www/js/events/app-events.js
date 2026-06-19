// Файл: www/js/events/app-events.js

import { emitEvent, onEvent } from "../core/event-bus.js?v=VERSION";

/**
 * @template {keyof import("./app-events.types.js").AppEventDetailMap} K
 * @param {K} name
 * @param {import("./app-events.types.js").AppEventDetailMap[K]} detail
 */
export function emitAppEvent(name, detail) {
  emitEvent(name, detail, document);
}

/**
 * @template {keyof import("./app-events.types.js").AppEventDetailMap} K
 * @param {K} name
 * @param {(event: CustomEvent<import("./app-events.types.js").AppEventDetailMap[K]>) => void} handler
 * @param {Document | Window | HTMLElement} [target=document]
 */
export function onAppEvent(name, handler, target = document) {
  return onEvent(name, handler, target);
}
