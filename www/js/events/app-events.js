// Файл: www/js/events/app-events.js

import { APP_EVENTS } from "../constants/events.js?v=VERSION";
import { emitEvent, onEvent } from "../core/event-bus.js?v=VERSION";

const DEV =
  (typeof import.meta !== "undefined" && import.meta?.env?.DEV) ||
  (typeof location !== "undefined" &&
    /localhost|127\.0\.0\.1/.test(location.host));

function validatePayload(name, detail) {
  if (!DEV) return;

  if (name === APP_EVENTS.TIMER_STARTED) {
    const ok =
      detail === "stopwatch" || detail === "timer" || detail === "tabata";
    if (!ok) {
      console.warn("[app-events] TIMER_STARTED payload invalid:", detail);
    }
  }

  if (name === APP_EVENTS.ACTIVE_TIMER_CHANGED) {
    const v = detail?.activeTimer;
    const ok =
      v === null || v === "stopwatch" || v === "timer" || v === "tabata";
    if (!ok) {
      console.warn(
        "[app-events] ACTIVE_TIMER_CHANGED payload invalid:",
        detail,
      );
    }
  }
}

/**
 * @template {keyof import("./app-events.types.js").AppEventDetailMap} K
 * @param {K} name
 * @param {import("./app-events.types.js").AppEventDetailMap[K]} detail
 */
export function emitAppEvent(name, detail) {
  validatePayload(name, detail);
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
