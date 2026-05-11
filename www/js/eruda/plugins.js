// Файл: www/js/eruda/plugins.js

import { loadScriptOnce } from "./loader.js?v=VERSION";

export const ERUDA_CORE = "https://cdn.jsdelivr.net/npm/eruda@3.4.3";
export const ERUDA_PLUGINS = [
  "https://cdn.jsdelivr.net/npm/eruda-fps/eruda-fps.min.js",
];

export async function ensureErudaLoaded() {
  await loadScriptOnce(ERUDA_CORE);
  await Promise.allSettled(ERUDA_PLUGINS.map((src) => loadScriptOnce(src)));
}

export function safeAddPlugin(globalRefName) {
  try {
    if (window[globalRefName] && window.eruda?.add) {
      window.eruda.add(window[globalRefName]);
    }
  } catch {}
}