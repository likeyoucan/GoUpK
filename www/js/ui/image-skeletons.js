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
      will-change: background-position;

      --sk-period: 240px;
      --sk-angle: 128deg;
      --sk-base: color-mix(in srgb, var(--bg-color) 90%, transparent);
      --sk-mid: color-mix(in srgb, var(--bg-color) 78%, var(--text-color) 22%);

      background-image:
        repeating-linear-gradient(
          var(--sk-angle),
          var(--sk-base) 0px,
          var(--sk-base) 72px,
          var(--sk-mid) 108px,
          var(--sk-base) 144px,
          var(--sk-base) var(--sk-period)
        );
      background-size: var(--sk-period) var(--sk-period);
      background-position: 0 0;
    }

    .img-skeleton-frame.is-img-loading .img-skeleton-overlay,
    .img-skeleton-frame.is-img-error .img-skeleton-overlay {
      opacity: 1;
      animation: img-skeleton-shimmer-ios 1.25s linear infinite;
    }

    @keyframes img-skeleton-shimmer-ios {
      from { background-position: 0 0; }
      to { background-position: var(--sk-period) var(--sk-period); }
    }

    @media (prefers-reduced-motion: reduce) {
      .img-skeleton-frame.is-img-loading .img-skeleton-overlay,
      .img-skeleton-frame.is-img-error .img-skeleton-overlay {
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
    if (img.naturalWidth > 0 && img.naturalHeight > 0) markReady();
    else markLoading();
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

  document
    .querySelectorAll("#app-icon-options img.app-icon-preview")
    .forEach((img) => targets.push(img));

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
