// Файл: www/js/eruda/loader.js

const scriptPromiseCache = {};

export function onReady(cb) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", cb, { once: true });
  } else {
    cb();
  }
}

export function injectStyle(cssText) {
  const s = document.createElement("style");
  s.type = "text/css";
  s.appendChild(document.createTextNode(cssText));
  document.head.appendChild(s);
}

export function el(tag, attrs, parent) {
  const n = document.createElement(tag);
  if (attrs) {
    Object.keys(attrs).forEach((k) => {
      const v = attrs[k];
      if (k === "style") Object.assign(n.style, v);
      else if (k === "text") n.textContent = v;
      else if (k.startsWith("on") && typeof v === "function") {
        n.addEventListener(k.slice(2), v);
      } else {
        n.setAttribute(k, v);
      }
    });
  }
  if (parent) parent.appendChild(n);
  return n;
}

export function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

export function loadScriptOnce(src) {
  if (scriptPromiseCache[src]) return scriptPromiseCache[src];

  scriptPromiseCache[src] = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.crossOrigin = "anonymous";
    s.referrerPolicy = "no-referrer";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load: ${src}`));
    document.body.appendChild(s);
  });

  return scriptPromiseCache[src];
}
