// Файл: www/js/eruda/plugins.js

import { loadScriptWithFallback, loadScriptOnce } from "./loader.js?v=VERSION";

const ERUDA_CORE_SOURCES = [
  "https://unpkg.com/eruda@3.4.3/eruda.js",
  "https://cdn.jsdelivr.net/npm/eruda@3.4.3",
];

const FPS_PLUGIN_SOURCES = [
  "https://unpkg.com/eruda-fps/eruda-fps.min.js",
  "https://cdn.jsdelivr.net/npm/eruda-fps/eruda-fps.min.js",
];

export async function ensureErudaLoaded() {
  // Core with fallback
  await loadScriptWithFallback(ERUDA_CORE_SOURCES);

  // Optional plugins: no throw, only warn
  try {
    await loadScriptWithFallback(FPS_PLUGIN_SOURCES);
  } catch (e) {
    console.warn("[eruda] fps plugin not loaded:", e?.message || e);
  }

  // Optional local plugin example (if you later add one)
  // await loadScriptOnce("/js/eruda-local-plugin.js").catch(() => {});
}

export function safeAddPlugin(globalRefName) {
  try {
    if (window[globalRefName] && window.eruda?.add) {
      window.eruda.add(window[globalRefName]);
    }
  } catch {}
}
