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
import { initErudaTapToggle } from "./debug-eruda-toggle.js?v=VERSION";

import { appProManager } from "./app-pro.js?v=VERSION";
import { adsManager } from "./ads.js?v=VERSION";
import { store } from "./store.js?v=VERSION";
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

function tr(key, fallback = "") {
  const v = t(key);
  return v === key ? fallback || key : v;
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

function getPricingState() {
  const p = APP_MONETIZATION_CONFIG?.pro?.pricing || {};
  const amount = Math.max(0, Number(p.amount) || 0);
  const discountEnabled = !!p.discountEnabled;
  const discountPercent = Math.max(
    0,
    Math.min(99, Number(p.discountPercent) || 0),
  );
  const currency = String(p.currency || "RUB");
  const currencySymbol = String(p.currencySymbol || "₽");
  const period = p.period === "month" || p.period === "year" ? p.period : null;

  const current = discountEnabled
    ? Math.max(0, Math.round(amount * (1 - discountPercent / 100)))
    : amount;

  return {
    amount,
    current,
    currency,
    currencySymbol,
    period,
    discountEnabled,
    discountPercent,
    hasDiscount: discountEnabled && discountPercent > 0 && current < amount,
  };
}

function formatMoney(value, pricing) {
  const locale = langManager.current === "ru" ? "ru-RU" : "en-US";
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: pricing.currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${value} ${pricing.currencySymbol}`;
  }
}

function formatPriceWithPeriod(pricing) {
  const base = formatMoney(pricing.current, pricing);
  if (!pricing.period) return base;
  const periodText =
    pricing.period === "month"
      ? tr("pro_period_month", "/ month")
      : tr("pro_period_year", "/ year");
  return `${base} ${periodText}`;
}

function renderProBadgesFromConfig() {
  document
    .querySelectorAll("[data-pro-injected='1']")
    .forEach((el) => el.remove());

  if (!APP_MONETIZATION_CONFIG.pro.enabled) return;

  APP_MONETIZATION_CONFIG.proBadges.forEach(({ selector, feature }) => {
    const row = document.querySelector(selector);
    if (!row) return;

    // For accent/bg sections we need the internal title row.
    // For sound/ads rows selector already points to the actual row.
    const titleRow =
      row.querySelector(".flex.items-center.justify-between") || row;

    let right = titleRow.lastElementChild;
    if (!right) return;

    if (!(right instanceof HTMLElement) || !right.classList.contains("flex")) {
      const wrap = document.createElement("div");
      wrap.className = "flex items-center gap-2";
      titleRow.appendChild(wrap);
      right = wrap;
    }

    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = tr("pro", "Pro");
    btn.dataset.proFeature = feature;
    btn.dataset.proInjected = "1";
    btn.className = "pro-badge pro-animated-border active:scale-95";

    right.prepend(btn);
  });
}

function updateProStatusBadge() {
  const statusEl = $("pro-status-badge");
  if (!statusEl) return;

  const isPurchased = !!appProManager.purchased;
  const mode = appProManager.mode;

  // Requested: plain text status, no highlighted pill.
  statusEl.className = "text-xs font-bold app-text-sec";

  if (!isPurchased) {
    statusEl.textContent = tr("pro_status_free", "Free");
    return;
  }

  if (mode === "lifetime") {
    statusEl.textContent = tr("pro_status_lifetime_active", "Pro version active");
  } else {
    statusEl.textContent = tr(
      "pro_status_subscription_active",
      "Subscription active",
    );
  }
}

function renderPaywallPrice() {
  const box = $("pro-paywall-price");
  if (!box) return;

  const pricing = getPricingState();
  const label = tr("pro_price_from", "Price");
  const currentText = formatPriceWithPeriod(pricing);

  if (!pricing.hasDiscount) {
    box.innerHTML = `
      <span class="pro-meta">${label}</span>
      <span class="pro-current">${currentText}</span>
    `;
    return;
  }

  const oldText = formatMoney(pricing.amount, pricing);
  const saveText = formatMoney(pricing.amount - pricing.current, pricing);

  box.innerHTML = `
    <span class="pro-meta">${label}</span>
    <span class="pro-current">${currentText}</span>
    <span class="pro-old">${oldText}</span>
    <span class="pro-meta">${tr("pro_discount", "Discount")}: -${pricing.discountPercent}%</span>
    <span class="pro-meta">${tr("pro_you_save", "You save")}: ${saveText}</span>
  `;
}

function renderProPurchaseUI() {
  const buyBtn = $("btn-buy-pro");
  const confirmBtn = $("pro-confirm-buy");
  if (!buyBtn || !confirmBtn) return;

  const isPurchased = !!appProManager.purchased;
  const mode = appProManager.mode;
  const isLifetime = mode === "lifetime";
  const isSubscription = mode === "subscription";
  const pricing = getPricingState();

  renderPaywallPrice();

  if (isPurchased && isLifetime) {
    buyBtn.classList.add("hidden");
    buyBtn.dataset.proAction = "hidden";
  } else if (isPurchased && isSubscription) {
    buyBtn.classList.remove("hidden", "pro-animated-border", "pro-cta-buy");
    buyBtn.classList.add("pro-cta", "pro-cta-cancel");
    buyBtn.dataset.proAction = "cancel-subscription";
    buyBtn.textContent = tr("cancel_subscription", "Cancel Subscription");
  } else {
    buyBtn.classList.remove("hidden", "pro-cta-cancel");
    buyBtn.classList.add("pro-cta", "pro-cta-buy", "pro-animated-border");
    buyBtn.dataset.proAction = "open-paywall";

    const label = isLifetime
      ? tr("buy_pro", "Buy Pro")
      : tr("buy_subscription", "Buy Subscription");

    buyBtn.innerHTML = `
      <span>${label}</span>
      <span class="pro-cta-price">${formatPriceWithPeriod(pricing)}</span>
    `;
  }

  confirmBtn.classList.remove("pro-cta-cancel");
  confirmBtn.classList.add("pro-cta", "pro-cta-buy", "pro-animated-border");
  confirmBtn.textContent = isLifetime
    ? tr("buy_pro", "Buy Pro")
    : tr("buy_subscription", "Buy Subscription");
}

function bindProUiSync() {
  const sync = () => {
    renderProBadgesFromConfig();
    updateProStatusBadge();
    renderProPurchaseUI();
  };

  document.addEventListener(APP_EVENTS.PRO_STATUS_CHANGED, sync);
  document.addEventListener(APP_EVENTS.LANGUAGE_CHANGED, sync);
  sync();
}

function bindProPaywallToasts() {
  const featureNameByKey = {
    custom_colors: () => tr("pro_feature_name_custom_colors", "Custom colors"),
    accent_bg: () => tr("pro_feature_name_accent_bg", "Accent and background"),
    remove_ads: () => tr("pro_feature_name_remove_ads", "Disable ads"),
    sound_themes: () => tr("pro_feature_name_sound_themes", "Sound themes"),
    app_icon: () => tr("pro_feature_name_app_icon", "Pro icon"),
  };

  document.addEventListener(APP_EVENTS.PRO_PAYWALL_REQUESTED, (e) => {
    const feature = e?.detail?.feature || "";
    const label = featureNameByKey[feature]?.();

    if (label) {
      showToast(`${label}: ${tr("pro_required", "Feature available in Pro")}`);
    } else {
      showToast(tr("pro_required", "Feature available in Pro"));
    }
  });
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

  bindProUiSync();
  bindProPaywallToasts();

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