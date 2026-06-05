// Файл: www/js/ui/image-skeletons.js

const STYLE_ID = "__image_skeleton_styles__";
const DEFAULT_TIMEOUT_MS = 3000;

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .img-skeleton-host {
      position: relative;
      overflow: hidden;
    }

    .img-skeleton-overlay {
      position: absolute;
      inset: 0;
      border-radius: inherit;
      pointer-events: none;
      opacity: 0;
      transition: opacity 180ms ease;
      background: linear-gradient(
        90deg,
        color-mix(in srgb, var(--bg-color) 92%, transparent) 0%,
        color-mix(in srgb, var(--bg-color) 82%, var(--text-color) 18%) 50%,
        color-mix(in srgb, var(--bg-color) 92%, transparent) 100%
      );
      background-size: 220% 100%;
    }

    .img-skeleton-host.is-img-loading .img-skeleton-overlay,
    .img-skeleton-host.is-img-error .img-skeleton-overlay {
      opacity: 1;
      animation: img-skeleton-shimmer 1.1s ease-in-out infinite;
    }

    @keyframes img-skeleton-shimmer {
      0% { background-position: 0% 50%; }
      100% { background-position: 100% 50%; }
    }
  `;
  document.head.appendChild(style);
}

function ensureOverlay(host) {
  let overlay = host.querySelector(":scope > .img-skeleton-overlay");
  if (!overlay) {
    overlay = document.createElement("span");
    overlay.className = "img-skeleton-overlay";
    host.appendChild(overlay);
  }
  return overlay;
}

function setHostState(host, state) {
  host.classList.toggle("is-img-loading", state === "loading");
  host.classList.toggle("is-img-error", state === "error");
}

function resolveHostForImage(img) {
  return (
    img.closest(".app-icon-option") ||
    img.closest("#app-preloader") ||
    img.parentElement
  );
}

function bindImage(img, timeoutMs) {
  if (!(img instanceof HTMLImageElement)) return () => {};
  if (img.dataset.skeletonBound === "1") return () => {};

  img.dataset.skeletonBound = "1";

  const host = resolveHostForImage(img);
  if (!(host instanceof HTMLElement)) return () => {};

  host.classList.add("img-skeleton-host");
  ensureOverlay(host);

  let timeoutId = null;

  const clearTimer = () => {
    if (!timeoutId) return;
    clearTimeout(timeoutId);
    timeoutId = null;
  };

  const markReady = () => {
    clearTimer();
    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
      setHostState(host, "ready");
      img.style.opacity = "";
      img.removeAttribute("aria-hidden");
      return;
    }
    markError();
  };

  const markError = () => {
    clearTimer();
    // По ТЗ: оставляем анимированный layout в цвет фона.
    setHostState(host, "error");
    img.style.opacity = "0";
    img.setAttribute("aria-hidden", "true");
  };

  const markLoading = () => {
    setHostState(host, "loading");
    timeoutId = setTimeout(markError, timeoutMs);
  };

  if (img.complete) {
    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
      markReady();
    } else {
      markLoading();
    }
  } else {
    markLoading();
  }

  const onLoad = () => markReady();
  const onError = () => markError();

  img.addEventListener("load", onLoad);
  img.addEventListener("error", onError);

  return () => {
    clearTimer();
    img.removeEventListener("load", onLoad);
    img.removeEventListener("error", onError);
    delete img.dataset.skeletonBound;
  };
}

function collectTargets() {
  const targets = [];
  targets.push(
    ...document.querySelectorAll("#app-icon-options img.app-icon-preview"),
  );
  const preloaderIcon = document.getElementById("app-preloader-icon");
  if (preloaderIcon) targets.push(preloaderIcon);
  return targets;
}

export function initImageSkeletons({ timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  ensureStyles();

  const unbinders = new Map();

  const scan = () => {
    collectTargets().forEach((img) => {
      if (unbinders.has(img)) return;
      const unbind = bindImage(img, timeoutMs);
      unbinders.set(img, unbind);
    });
  };

  scan();

  const mo = new MutationObserver(scan);
  mo.observe(document.body, { childList: true, subtree: true });

  return () => {
    mo.disconnect();
    unbinders.forEach((unbind) => unbind?.());
    unbinders.clear();
  };
}
