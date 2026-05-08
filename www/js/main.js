// Файл: www/js/main.js

import { $, showToast } from "./utils.js?v=VERSION";
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

import { appProManager } from "./app-pro.js?v=VERSION";
import { adsManager } from "./ads.js?v=VERSION";
import { APP_EVENTS } from "./constants/events.js?v=VERSION";
import { APP_MONETIZATION_CONFIG } from "./app-monetization-config.js?v=VERSION";

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

function renderProBadgesFromConfig() {
  document
    .querySelectorAll("[data-pro-injected='1']")
    .forEach((el) => el.remove());

  if (!APP_MONETIZATION_CONFIG.pro.enabled) return;

  APP_MONETIZATION_CONFIG.proBadges.forEach(({ selector, feature }) => {
    const row = document.querySelector(selector);
    if (!row) return;

    const slot =
      row.querySelector("[data-pro-badge-slot]") ||
      row.querySelector(".flex.items-center.gap-2") ||
      row.lastElementChild;

    if (!slot) return;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "Pro";
    btn.dataset.proFeature = feature;
    btn.dataset.proInjected = "1";
    btn.className =
      "text-[10px] font-bold uppercase px-2 py-1 rounded-md border app-border app-text-sec active:scale-95";

    slot.prepend(btn);
  });
}

function initProStatusUi() {
  const statusEl = $("pro-status-badge");
  if (!statusEl) return;

  const sync = () => {
    statusEl.textContent = appProManager.purchased
      ? t("pro_status_active")
      : t("pro_status_free");
  };

  document.addEventListener(APP_EVENTS.PRO_STATUS_CHANGED, sync);
  document.addEventListener(APP_EVENTS.LANGUAGE_CHANGED, sync);
  sync();
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

  await appProManager.init();
  await applyMonetizationConfig();

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
    $,
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

  initProStatusUi();
  renderProBadgesFromConfig();

  document.addEventListener(APP_EVENTS.LANGUAGE_CHANGED, () => {
    renderProBadgesFromConfig();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      appProManager.revalidateOrReset().catch((err) => {
        console.error("[pro-revalidate] failed", err);
      });
    }
  });

  document.addEventListener(APP_EVENTS.PRO_PAYWALL_REQUESTED, (e) => {
    const feature = e?.detail?.feature || "pro";
    showToast(`Pro required: ${feature}`);
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
