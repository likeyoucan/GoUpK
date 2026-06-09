// Файл: www/js/app-icon-selector.js

import { safeGetLS, safeSetLS, showToast } from "./utils.js?v=VERSION";
import { STORAGE_KEYS } from "./constants/storage-keys.js?v=VERSION";
import { APP_EVENTS } from "./constants/events.js?v=VERSION";
import { APP_MONETIZATION_CONFIG } from "./app-monetization-config.js?v=VERSION";
import { resolveToastText } from "./constants/toast-fallbacks.js?v=VERSION";

const ICON_CFG = APP_MONETIZATION_CONFIG.ui?.appIcons || {};
const ICON_OPTIONS = Array.isArray(ICON_CFG.options) ? ICON_CFG.options : [];
const FALLBACK_IMAGE = ICON_CFG.fallbackImage || "img/app_img.png";
const PRELOAD_TIMEOUT_MS = Number(ICON_CFG.preloadTimeoutMs) || 3000;

// Cache resolved preview state per icon id to avoid visual reload on rerender.
const ICON_PREVIEW_CACHE = new Map();

function getNativePlugin() {
  return window.Capacitor?.Plugins?.AppIconSwitcher || null;
}

async function applyNativeIcon(nativeName) {
  const plugin = getNativePlugin();
  if (!plugin?.setIconName) return;
  try {
    await plugin.setIconName({ name: nativeName });
  } catch (e) {
    console.warn("[app-icon] failed to set native icon", e);
  }
}

function tr(t, key, fallback) {
  const v = t(key);
  return v === key ? fallback : v;
}

function getOptionById(id) {
  return ICON_OPTIONS.find((x) => x.id === id) || ICON_OPTIONS[0];
}

function getCurrentLang() {
  const lang = (document.documentElement.lang || "en").toLowerCase();
  return lang.startsWith("ru") ? "ru" : "en";
}

function resolveOptionLabel(option, t) {
  const lang = getCurrentLang();
  if (
    option?.labels &&
    typeof option.labels === "object" &&
    option.labels[lang]
  ) {
    return option.labels[lang];
  }
  return tr(t, option?.labelKey, option?.id || "icon");
}

function canUseOption(option, appProManager) {
  if (!option) return false;
  if (!option.proRequired) return true;
  return !!appProManager?.canUse?.("app_icon");
}

function loadImageWithFallback(src, fallbackSrc, timeoutMs) {
  return new Promise((resolve) => {
    let done = false;

    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      resolve(fallbackSrc);
    }, timeoutMs);

    const img = new Image();
    img.onload = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(src);
    };
    img.onerror = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(fallbackSrc);
    };
    img.src = src;
  });
}

async function resolvePreviewForOption(option) {
  const desiredSrc = option?.image || FALLBACK_IMAGE;

  if (!option?.image) {
    return { src: FALLBACK_IMAGE, missing: true };
  }

  const readySrc = await loadImageWithFallback(
    desiredSrc,
    FALLBACK_IMAGE,
    PRELOAD_TIMEOUT_MS,
  );

  const missing = readySrc === FALLBACK_IMAGE && desiredSrc !== FALLBACK_IMAGE;
  return { src: readySrc, missing };
}

export function getResolvedAppIconId(appProManager) {
  const preferred =
    safeGetLS(STORAGE_KEYS.APP_ICON_NAME) || ICON_OPTIONS[0]?.id;
  const option = getOptionById(preferred);

  if (canUseOption(option, appProManager)) return option.id;

  const fallback = ICON_OPTIONS.find((x) => !x.proRequired) || ICON_OPTIONS[0];
  return fallback.id;
}

export function getResolvedAppIconMeta(t, appProManager) {
  const id = getResolvedAppIconId(appProManager);
  const option = getOptionById(id);

  return {
    id,
    src: option.image || FALLBACK_IMAGE,
    nativeName: option.nativeName || option.id,
    label: resolveOptionLabel(option, t),
    labelKey: option.labelKey || "",
    proRequired: !!option.proRequired,
  };
}

function dispatchIconChanged(t, appProManager) {
  const meta = getResolvedAppIconMeta(t, appProManager);

  document.dispatchEvent(
    new CustomEvent(APP_EVENTS.APP_ICON_CHANGED, {
      detail: {
        id: meta.id,
        src: meta.src,
        label: meta.label,
        labelKey: meta.labelKey,
        proRequired: meta.proRequired,
      },
    }),
  );
}

export function initAppIconSelector({ t, appProManager }) {
  const container = document.getElementById("app-icon-options");
  if (!container) return;

  let current = safeGetLS(STORAGE_KEYS.APP_ICON_NAME) || ICON_OPTIONS[0]?.id;
  if (!ICON_OPTIONS.find((x) => x.id === current)) {
    current = ICON_OPTIONS[0]?.id;
  }

  const saveAndApply = async (id, { dispatch = true } = {}) => {
    const option = getOptionById(id);

    current = option.id;
    safeSetLS(STORAGE_KEYS.APP_ICON_NAME, current);
    await applyNativeIcon(option.nativeName || option.id);

    if (dispatch) dispatchIconChanged(t, appProManager);
  };

  const render = () => {
    container.replaceChildren();

    ICON_OPTIONS.forEach((opt) => {
      const locked = !!opt.proRequired && !appProManager.canUse("app_icon");

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "app-icon-option";
      if (current === opt.id) btn.classList.add("is-selected");
      if (locked) btn.classList.add("is-locked");

      const optionLabel = resolveOptionLabel(opt, t);
      btn.setAttribute("aria-label", optionLabel);

      const previewWrap = document.createElement("span");
      previewWrap.className = "app-icon-preview-wrap";

      const img = document.createElement("img");
      img.alt = optionLabel;
      img.className = "app-icon-preview";
      img.decoding = "async";

      const missingOverlay = document.createElement("span");
      missingOverlay.className = "app-icon-missing";

      const setMissing = (flag) => {
        btn.classList.toggle("is-img-missing", !!flag);
      };

      const cached = ICON_PREVIEW_CACHE.get(opt.id);
      if (cached) {
        img.src = cached.src;
        setMissing(!!cached.missing);
      } else {
        img.src = opt.image || FALLBACK_IMAGE;
        setMissing(false);

        resolvePreviewForOption(opt)
          .then((resolved) => {
            ICON_PREVIEW_CACHE.set(opt.id, resolved);
            if (!img.isConnected) return;
            img.src = resolved.src;
            setMissing(!!resolved.missing);
          })
          .catch(() => {
            const fallbackState = { src: FALLBACK_IMAGE, missing: true };
            ICON_PREVIEW_CACHE.set(opt.id, fallbackState);
            if (!img.isConnected) return;
            img.src = FALLBACK_IMAGE;
            setMissing(true);
          });
      }

      img.addEventListener(
        "error",
        () => {
          setMissing(true);
          img.src = FALLBACK_IMAGE;
        },
        { once: true },
      );

      previewWrap.append(img, missingOverlay);

      const label = document.createElement("span");
      label.className = "app-icon-label app-text-sec";
      label.textContent = optionLabel;

      btn.append(previewWrap, label);

      btn.addEventListener("click", async () => {
        if (locked) {
          showToast(resolveToastText(t, "pro_required"));
          document.dispatchEvent(
            new CustomEvent(APP_EVENTS.PRO_PAYWALL_REQUESTED, {
              detail: { feature: "app_icon" },
            }),
          );
          return;
        }

        await saveAndApply(opt.id);
        render();
      });

      container.appendChild(btn);
    });
  };

  const syncByProState = async () => {
    const option = getOptionById(current);

    if (!canUseOption(option, appProManager)) {
      const fallback =
        ICON_OPTIONS.find((x) => !x.proRequired) || ICON_OPTIONS[0];
      await saveAndApply(fallback.id, { dispatch: false });
    } else {
      await applyNativeIcon(option.nativeName || option.id);
    }

    render();
    dispatchIconChanged(t, appProManager);
  };

  document.addEventListener(APP_EVENTS.PRO_STATUS_CHANGED, () => {
    syncByProState();
  });

  document.addEventListener(APP_EVENTS.LANGUAGE_CHANGED, () => {
    render();
    dispatchIconChanged(t, appProManager);
  });

  syncByProState();
}
