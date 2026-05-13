// Файл: www/js/eruda/plugins.js

import { loadScriptOnce } from "./loader.js?v=VERSION";

// CSP-safe local paths resolved relative to this module:
const ERUDA_CORE_LOCAL = new URL("./vendor/eruda.min.js", import.meta.url).href;

const ERUDA_FPS_LOCAL = new URL("./vendor/eruda-fps-min.js", import.meta.url)
  .href;

export async function ensureErudaLoaded() {
  // Core must exist
  await loadScriptOnce(ERUDA_CORE_LOCAL);

  // Plugin is optional
  try {
    await loadScriptOnce(ERUDA_FPS_LOCAL);
  } catch (e) {
    console.warn("[eruda] fps plugin not loaded:", e?.message || e);
  }
}

export function safeAddPlugin(globalRefName) {
  try {
    if (window[globalRefName] && window.eruda?.add) {
      window.eruda.add(window[globalRefName]);
    }
  } catch {}
}
