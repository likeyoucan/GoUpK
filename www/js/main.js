// Файл: www/js/main.js

import { showToast } from "./utils.js?v=VERSION";
import { langManager, t } from "./i18n.js?v=VERSION";
import { themeManager } from "./theme.js?v=VERSION";
import { navigation } from "./navigation.js?v=VERSION";
import { sw } from "./stopwatch.js?v=VERSION";
import { tm } from "./timer.js?v=VERSION";
import { tb } from "./tabata.js?v=VERSION";
import { sm } from "./sound.js?v=VERSION";
import { modalManager } from "./modal.js?v=VERSION";
import { initTouchRanges } from "./touch-range.js?v=VERSION";
import { preload } from "./preload.js?v=VERSION";
import {
  initForegroundService,
  destroyForegroundService,
} from "./foreground-service.js?v=VERSION";
import { adsManager } from "./ads.js?v=VERSION";

import { initRingSvg } from "./bootstrap/ring-svg-injector.js?v=VERSION";
import { applyPerformanceProfile } from "./bootstrap/performance-profile.js?v=VERSION";
import { initRuntimeBootstrap } from "./bootstrap/runtime-bootstrap.js?v=VERSION";
import { initMonetizationBootstrap } from "./bootstrap/monetization-bootstrap.js?v=VERSION";
import { bindLayoutOverlay } from "./bootstrap/layout-overlay.js?v=VERSION";
import { createDisposerBag } from "./bootstrap/disposer-bag.js?v=VERSION";
import { initErudaTapToggle } from "./debug-eruda-toggle.js?v=VERSION";
import { initImageSkeletons } from "./ui/image-skeletons.js?v=VERSION";

import { appProManager } from "./app-pro.js?v=VERSION";
import { store } from "./store.js?v=VERSION";
import { APP_MONETIZATION_CONFIG } from "./app-monetization-config.js?v=VERSION";
import { getTimerAlarmBridge } from "./platform/capacitor-adapter.js?v=VERSION";

const ERUDA_CDN_MARKER = "cdn.jsdelivr.net/npm/eruda";
const OPTIONAL_RESOURCE_MARKERS = [ERUDA_CDN_MARKER, "/js/eruda.js"];

function isErudaNoiseFromErrorEvent(event) {
  const src = String(event?.filename || "");
  const msg = String(event?.message || "");
  return src.includes(ERUDA_CDN_MARKER) || msg.includes(ERUDA_CDN_MARKER);
}

function isErudaNoiseFromRejection(event) {
  const reasonText = String(event?.reason?.stack || event?.reason || "");
  return reasonText.includes(ERUDA_CDN_MARKER);
}

function isOptionalResourceUrl(url) {
  const normalized = String(url || "");
  return OPTIONAL_RESOURCE_MARKERS.some((marker) =>
    normalized.includes(marker),
  );
}

function createTextEl(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text != null) el.textContent = String(text);
  return el;
}

function renderBootError(error) {
  const msg = (error && (error.stack || error.message)) || String(error);
  console.error("[BOOT ERROR]", error);

  preload.hide();
  document.body.classList.remove("preload");

  const existing = document.getElementById("boot-error-panel");
  if (existing) existing.remove();

  const panel = document.createElement("div");
  panel.id = "boot-error-panel";
  panel.className =
    "fixed inset-0 z-[300] bg-black/80 text-white p-4 overflow-auto text-xs font-mono";

  const wrap = document.createElement("div");
  wrap.className = "max-w-3xl mx-auto space-y-3";

  const title = createTextEl("h2", "text-lg font-bold", "App Boot Failed");
  const desc = createTextEl(
    "p",
    "",
    "Application stopped before initialization. Check details below.",
  );
  const pre = createTextEl(
    "pre",
    "whitespace-pre-wrap break-words bg-black/40 p-3 rounded-xl",
    msg,
  );

  const reloadBtn = createTextEl(
    "button",
    "px-4 py-2 rounded-lg bg-white text-black font-bold",
    "Reload",
  );
  reloadBtn.id = "boot-reload-btn";
  reloadBtn.addEventListener("click", () => location.reload());

  wrap.append(title, desc, pre, reloadBtn);
  panel.appendChild(wrap);
  document.body.appendChild(panel);
}

async function reconcileNativeTimerAlarm() {
  const bridge = getTimerAlarmBridge();
  if (!bridge?.readAndClearFiredFlag) return;

  try {
    const result = await bridge.readAndClearFiredFlag();
    if (!result?.fired) return;

    store.clearActiveTimer();

    if (tm.isRunning || tm.isPaused) {
      tm.finishAsCompleted();
    } else {
      showToast(t("timer_finished"));
    }
  } catch (e) {
    console.warn("[timer-alarm] read flag failed", e);
  }
}

const appBag = createDisposerBag();

let bootStarted = false;
let bootPromise = null;
let bootDispose = null;

let runtimeDestroyed = false;
let destroyStarted = false;

function installGlobalErrorHandlers() {
  const onGlobalError = (e) => {
    if (isErudaNoiseFromErrorEvent(e)) return;
    console.error("[GLOBAL ERROR]", e.error || e.message);
  };

  const onUnhandledRejection = (e) => {
    if (isErudaNoiseFromRejection(e)) return;
    console.error("[UNHANDLED PROMISE]", e.reason);
  };

  const onResourceError = (e) => {
    const target = e.target;
    if (
      target instanceof HTMLScriptElement ||
      target instanceof HTMLLinkElement ||
      target instanceof HTMLImageElement
    ) {
      const url =
        target.src ||
        target.href ||
        target.currentSrc ||
        target.getAttribute("src") ||
        target.getAttribute("href") ||
        "";

      if (isOptionalResourceUrl(url)) {
        console.warn("[RESOURCE OPTIONAL FAILED]", url);
        return;
      }

      console.error("[RESOURCE LOAD ERROR]", url || target);
    }
  };

  window.addEventListener("error", onGlobalError);
  window.addEventListener("unhandledrejection", onUnhandledRejection);
  window.addEventListener("error", onResourceError, true);

  appBag.add(() => window.removeEventListener("error", onGlobalError));
  appBag.add(() =>
    window.removeEventListener("unhandledrejection", onUnhandledRejection),
  );
  appBag.add(() => window.removeEventListener("error", onResourceError, true));
}

async function bootstrap() {
  if (bootStarted) return;
  bootStarted = true;

  installGlobalErrorHandlers();
  initErudaTapToggle();

  store.reconcileActiveTimer({ sw, tm, tb });
  await reconcileNativeTimerAlarm();

  await initMonetizationBootstrap({
    preload,
    t,
    langManager,
    showToast,
    config: APP_MONETIZATION_CONFIG,
  });

  bootDispose = initRuntimeBootstrap({
    applyPerformanceProfile,
    initRingSvg,
    langManager,
    initTouchRanges,
    themeManager,
    sm,
    sw,
    tm,
    tb,
    navigation,
    modalManager,
    preload,
    initForegroundService,
    destroyForegroundService,
    adsManager,
    showToast,
    t,
    getById: (id) => document.getElementById(id),
  });

  appBag.add(() => {
    if (typeof bootDispose === "function") {
      bootDispose();
      bootDispose = null;
    }
  });

  let skeletonRaf = requestAnimationFrame(() => {
    skeletonRaf = 0;
    const disposeSkeletons = initImageSkeletons({ timeoutMs: 3000 });
    appBag.add(disposeSkeletons);
  });

  appBag.add(() => {
    if (skeletonRaf) {
      cancelAnimationFrame(skeletonRaf);
      skeletonRaf = 0;
    }
  });

  const unbindLayoutOverlay = bindLayoutOverlay({
    minDeltaPx: 18,
    settleDelayMs: 220,
    holdMs: 100,
  });
  appBag.add(unbindLayoutOverlay);

  const onVisibilityRevalidate = () => {
    if (document.visibilityState === "visible") {
      appProManager.revalidateOrReset().catch((err) => {
        console.error("[pro-revalidate] failed", err);
      });
    }
  };

  document.addEventListener("visibilitychange", onVisibilityRevalidate);
  appBag.add(() =>
    document.removeEventListener("visibilitychange", onVisibilityRevalidate),
  );
}

function destroyAppRuntime() {
  if (destroyStarted || runtimeDestroyed) return;
  destroyStarted = true;

  try {
    appBag.run();
  } catch (err) {
    console.error("[destroy-runtime]", err);
  } finally {
    runtimeDestroyed = true;
  }
}

const onPageHide = () => destroyAppRuntime();
const onBeforeUnload = () => destroyAppRuntime();

window.addEventListener("pagehide", onPageHide, { once: true });
window.addEventListener("beforeunload", onBeforeUnload, { once: true });

appBag.add(() => window.removeEventListener("pagehide", onPageHide));
appBag.add(() => window.removeEventListener("beforeunload", onBeforeUnload));

async function startBoot() {
  if (bootPromise) return bootPromise;

  bootPromise = (async () => {
    try {
      await bootstrap();
    } catch (error) {
      renderBootError(error);
      // Allow explicit retry path if needed.
      bootStarted = false;
    }
  })();

  return bootPromise;
}

if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    () => {
      void startBoot();
    },
    { once: true },
  );
} else {
  void startBoot();
}
