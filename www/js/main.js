// Файл: www/js/main.js

import { showToast, safeGetLS, safeSetLS } from "./utils.js?v=VERSION";
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

import { initRingSvg } from "./bootstrap/ring-svg-injector.js?v=VERSION";
import { applyPerformanceProfile } from "./bootstrap/performance-profile.js?v=VERSION";
import { bindAppLifecycle } from "./bootstrap/app-lifecycle.js?v=VERSION";
import { initializeApp } from "./bootstrap/app-init.js?v=VERSION";
import { bindUiInteractions } from "./bootstrap/ui-interactions.js?v=VERSION";
import { initErudaTapToggle } from "./debug-eruda-toggle.js?v=VERSION";

import { appProManager } from "./app-pro.js?v=VERSION";
import { adsManager } from "./ads.js?v=VERSION";
import { store } from "./store.js?v=VERSION";
import { APP_MONETIZATION_CONFIG } from "./app-monetization-config.js?v=VERSION";
import { initProUi } from "./pro-ui.js?v=VERSION";
import { APP_EVENTS } from "./constants/events.js?v=VERSION";
import { STORAGE_KEYS } from "./constants/storage-keys.js?v=VERSION";

const ERUDA_CDN_MARKER = "cdn.jsdelivr.net/npm/eruda";
const OPTIONAL_RESOURCE_MARKERS = [ERUDA_CDN_MARKER, "/js/eruda.js"];
const ADS_AUTO_DISABLE_MARKER = "app_ads_auto_disabled_after_pro";

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
  const bridge = window.Capacitor?.Plugins?.TimerAlarmBridge;
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

async function applyMonetizationConfig() {
  if (!APP_MONETIZATION_CONFIG.pro.enabled) {
    await appProManager.setMode("disabled");
  } else {
    await appProManager.setMode(APP_MONETIZATION_CONFIG.pro.mode);

    const entries = Object.entries(APP_MONETIZATION_CONFIG.pro.features || {});
    for (const [featureKey, isGated] of entries) {
      await appProManager.setFeatureGate(featureKey, !!isGated);
    }

    if (APP_MONETIZATION_CONFIG.pro.forcePurchased === true) {
      await appProManager.purchase();
    } else if (APP_MONETIZATION_CONFIG.pro.forcePurchased === false) {
      await appProManager.revoke();
    }
  }

  adsManager.setProvider(APP_MONETIZATION_CONFIG.ads.defaultProvider);
  adsManager.setInterstitialCooldown(
    APP_MONETIZATION_CONFIG.ads.interstitialCooldownMs,
  );

  const storedAdsEnabled = safeGetLS(STORAGE_KEYS.APP_ADS_ENABLED);
  if (storedAdsEnabled === null) {
    adsManager.setEnabled(APP_MONETIZATION_CONFIG.ads.enabledByDefault);
  } else {
    adsManager.setEnabled(storedAdsEnabled !== "false");
  }
}

function syncAdsToggleUi(checked) {
  const toggleAds = document.getElementById("toggle-ads");
  if (toggleAds) toggleAds.checked = !!checked;
}

function shouldAutoDisableAdsOnPro() {
  return !!APP_MONETIZATION_CONFIG.ads?.autoDisableOnProPurchase;
}

function maybeAutoDisableAdsForPro(isPurchased) {
  if (!isPurchased) return;
  if (!shouldAutoDisableAdsOnPro()) return;

  const marker = safeGetLS(ADS_AUTO_DISABLE_MARKER) === "true";
  if (marker) return;

  adsManager.setEnabled(false);
  syncAdsToggleUi(false);
  safeSetLS(ADS_AUTO_DISABLE_MARKER, "true");
}

function bindProAdsAutomation() {
  document.addEventListener(APP_EVENTS.PRO_STATUS_CHANGED, (e) => {
    const purchased = !!e?.detail?.purchased;
    maybeAutoDisableAdsForPro(purchased);
  });

  maybeAutoDisableAdsForPro(!!appProManager.purchased);
}

let bootStarted = false;

async function bootstrap() {
  if (bootStarted) return;
  bootStarted = true;

  initErudaTapToggle();

  store.reconcileActiveTimer({ sw, tm, tb });
  await reconcileNativeTimerAlarm();

  await appProManager.init();

  initializeApp({
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
  });

  bindProAdsAutomation();
  await applyMonetizationConfig();

  adsManager.reconcileActiveTimerState({ sw, tm, tb });
  adsManager.init();
  adsManager.bindAutoRefresh();
  adsManager.bindLifecycleMonetization();

  bindAppLifecycle({
    preload,
    initForegroundService,
    destroyForegroundService,
    modalManager,
    navigation,
  });

  bindUiInteractions({
    $: (id) => document.getElementById(id),
    showToast,
    t,
    modalManager,
    themeManager,
    sm,
    langManager,
    sw,
    tm,
    tb,
    navigation,
  });

  initProUi({
    t,
    langManager,
    appProManager,
    config: APP_MONETIZATION_CONFIG,
    showToast,
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      appProManager.revalidateOrReset().catch((err) => {
        console.error("[pro-revalidate] failed", err);
      });
    }
  });
}

// Runtime JS errors (logic)
window.addEventListener("error", (e) => {
  if (isErudaNoiseFromErrorEvent(e)) return;
  console.error("[GLOBAL ERROR]", e.error || e.message);
});

// Runtime promise rejections
window.addEventListener("unhandledrejection", (e) => {
  if (isErudaNoiseFromRejection(e)) return;
  console.error("[UNHANDLED PROMISE]", e.reason);
});

// Resource loading errors (scripts/styles/img), incl. 503
window.addEventListener(
  "error",
  (e) => {
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
  },
  true,
);

document.addEventListener("DOMContentLoaded", async () => {
  try {
    await bootstrap();
  } catch (error) {
    renderBootError(error);
  }
});
