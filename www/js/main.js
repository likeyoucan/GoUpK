// Файл: www/js/main.js

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

const ERUDA_CDN_MARKER = "cdn.jsdelivr.net/npm/eruda";

function isErudaNoiseFromErrorEvent(event) {
  const src = String(event?.filename || "");
  const msg = String(event?.message || "");
  return src.includes(ERUDA_CDN_MARKER) || msg.includes(ERUDA_CDN_MARKER);
}

function isErudaNoiseFromRejection(event) {
  const reasonText = String(event?.reason?.stack || event?.reason || "");
  return reasonText.includes(ERUDA_CDN_MARKER);
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
  panel.innerHTML = `
    <div class="max-w-3xl mx-auto space-y-3">
      <h2 class="text-lg font-bold">App Boot Failed</h2>
      <p>Application stopped before initialization. Check details below.</p>
      <pre class="whitespace-pre-wrap break-words bg-black/40 p-3 rounded-xl">${msg.replace(
        /[<>&]/g,
        (m) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[m],
      )}</pre>
      <button id="boot-reload-btn" class="px-4 py-2 rounded-lg bg-white text-black font-bold">Reload</button>
    </div>
  `;
  document.body.appendChild(panel);

  const reloadBtn = document.getElementById("boot-reload-btn");
  reloadBtn?.addEventListener("click", () => location.reload());
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
  adsManager.setEnabled(APP_MONETIZATION_CONFIG.ads.enabledByDefault);
}

async function bootstrap() {
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

  initErudaTapToggle();

  store.reconcileActiveTimer({ sw, tm, tb });
  await reconcileNativeTimerAlarm();

  await appProManager.init();
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

window.addEventListener("error", (e) => {
  if (isErudaNoiseFromErrorEvent(e)) return;
  console.error("[GLOBAL ERROR]", e.error || e.message);
});

window.addEventListener("unhandledrejection", (e) => {
  if (isErudaNoiseFromRejection(e)) return;
  console.error("[UNHANDLED PROMISE]", e.reason);
});

document.addEventListener("DOMContentLoaded", async () => {
  try {
    await bootstrap();
  } catch (error) {
    renderBootError(error);
  }
});
