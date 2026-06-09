// Файл: www/js/ui/image-skeletons.js

const STYLE_ID = "__image_skeleton_styles__";
const DEFAULT_TIMEOUT_MS = 3000;

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .img-skeleton-frame {
      position: relative;
      display: inline-block;
      overflow: hidden;
      vertical-align: middle;
      transform: translateZ(0);
      contain: layout paint;
      border-radius: 12px;
    }

    .img-skeleton-frame > img {
      display: block;
      width: 100%;
      height: 100%;
    }

    .img-skeleton-overlay {
      position: absolute;
      inset: 0;
      border-radius: inherit;
      pointer-events: none;
      opacity: 0;
      transition: opacity 220ms cubic-bezier(0.32, 0.72, 0, 1);
      background: color-mix(in srgb, var(--bg-color) 88%, var(--text-color) 12%);
      overflow: hidden;
      transform: translateZ(0);
    }

    .img-skeleton-shine {
      position: absolute;
      top: -40%;
      bottom: -40%;
      left: -170%;
      width: 90%;
      pointer-events: none;
      background: linear-gradient(
        90deg,
        transparent 0%,
        color-mix(in srgb, #ffffff 58%, transparent) 45%,
        color-mix(in srgb, #ffffff 72%, transparent) 50%,
        color-mix(in srgb, #ffffff 58%, transparent) 55%,
        transparent 100%
      );
      transform: skewX(-18deg) translate3d(0, 0, 0);
      will-change: transform;
      opacity: 0.7;
    }

    .img-skeleton-frame.is-img-loading .img-skeleton-overlay,
    .img-skeleton-frame.is-img-error .img-skeleton-overlay {
      opacity: 1;
    }

    .img-skeleton-frame.is-img-loading .img-skeleton-shine,
    .img-skeleton-frame.is-img-error .img-skeleton-shine {
      animation: img-skeleton-ios-shine 1.35s linear infinite;
    }

    @keyframes img-skeleton-ios-shine {
      0% { transform: skewX(-18deg) translate3d(0%, 0, 0); }
      12% { transform: skewX(-18deg) translate3d(0%, 0, 0); }
      88% { transform: skewX(-18deg) translate3d(390%, 0, 0); }
      100% { transform: skewX(-18deg) translate3d(390%, 0, 0); }
    }

    @media (prefers-reduced-motion: reduce) {
      .img-skeleton-frame.is-img-loading .img-skeleton-shine,
      .img-skeleton-frame.is-img-error .img-skeleton-shine {
        animation: none;
      }
    }
  `;
  document.head.appendChild(style);
}

function ensureOverlay(frame) {
  let overlay = frame.querySelector(":scope > .img-skeleton-overlay");
  if (!overlay) {
    overlay = document.createElement("span");
    overlay.className = "img-skeleton-overlay";

    const shine = document.createElement("span");
    shine.className = "img-skeleton-shine";
    overlay.appendChild(shine);

    frame.appendChild(overlay);
  }
  return overlay;
}

function setFrameState(frame, state) {
  frame.classList.toggle("is-img-loading", state === "loading");
  frame.classList.toggle("is-img-error", state === "error");
}

function ensureFrameForImage(img) {
  if (!(img instanceof HTMLImageElement)) return null;

  const parent = img.parentElement;
  if (parent?.classList.contains("img-skeleton-frame")) return parent;

  const cs = getComputedStyle(img);
  const frame = document.createElement("span");
  frame.className = "img-skeleton-frame";

  const width = cs.width || `${img.width || 52}px`;
  const height = cs.height || `${img.height || 52}px`;
  const radius = cs.borderRadius || "12px";

  frame.style.width = width;
  frame.style.height = height;
  frame.style.borderRadius = radius;

  img.replaceWith(frame);
  frame.appendChild(img);

  ensureOverlay(frame);
  return frame;
}

function bindImage(img, timeoutMs) {
  if (!(img instanceof HTMLImageElement)) return () => {};
  if (img.dataset.skeletonBound === "1") return () => {};

  img.dataset.skeletonBound = "1";

  const frame = ensureFrameForImage(img);
  if (!(frame instanceof HTMLElement)) return () => {};

  let timeoutId = null;

  const clearTimer = () => {
    if (!timeoutId) return;
    clearTimeout(timeoutId);
    timeoutId = null;
  };

  const markReady = () => {
    clearTimer();
    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
      setFrameState(frame, "ready");
      img.style.opacity = "";
      img.removeAttribute("aria-hidden");
      return;
    }
    markError();
  };

  const markError = () => {
    clearTimer();
    setFrameState(frame, "error");
    img.style.opacity = "0";
    img.setAttribute("aria-hidden", "true");
  };

  const markLoading = () => {
    setFrameState(frame, "loading");
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

  const preloaderIcon = document.getElementById("app-preloader-icon");
  if (preloaderIcon) targets.push(preloaderIcon);

  // App icon options are intentionally excluded to avoid reload/skeleton flicker.

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

  const iconOptions = document.getElementById("app-icon-options");
  const mo = new MutationObserver(scan);
  if (iconOptions) {
    mo.observe(iconOptions, { childList: true, subtree: true });
  }

  return () => {
    mo.disconnect();
    unbinders.forEach((unbind) => unbind?.());
    unbinders.clear();
  };
}