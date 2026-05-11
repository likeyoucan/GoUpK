// Файл: www/js/pro-ui.js

import { APP_EVENTS } from "./constants/events.js?v=VERSION";
import { renderProBadgesFromConfig } from "./pro-badges-ui.js?v=VERSION";

function tr(t, key, fallback = "") {
  const v = t(key);
  return v === key ? fallback || key : v;
}

function hasProUiNodes() {
  return !!(
    document.getElementById("view-settings") &&
    document.getElementById("pro-status-badge") &&
    document.getElementById("btn-buy-pro") &&
    document.getElementById("pro-confirm-buy")
  );
}

function getPricingState(config) {
  const p = config?.pro?.pricing || {};
  const amount = Math.max(0, Number(p.amount) || 0);
  const discountEnabled = !!p.discountEnabled;
  const discountPercent = Math.max(
    0,
    Math.min(99, Number(p.discountPercent) || 0),
  );
  const currency = String(p.currency || "RUB");
  const currencySymbol = String(p.currencySymbol || "RUB");
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

function formatMoney(value, pricing, langManager) {
  const locale = langManager?.current === "ru" ? "ru-RU" : "en-US";
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

// FIX: langManager explicitly passed in params
function formatPriceWithPeriod(pricing, t, langManager) {
  const base = formatMoney(pricing.current, pricing, langManager);
  if (!pricing.period) return base;

  const periodText =
    pricing.period === "month"
      ? tr(t, "pro_period_month", "/ month")
      : tr(t, "pro_period_year", "/ year");

  return `${base} ${periodText}`;
}

function updateProStatusBadge(t, appProManager) {
  const statusEl = document.getElementById("pro-status-badge");
  if (!statusEl) return;

  const isPurchased = !!appProManager.purchased;
  const mode = appProManager.mode;

  statusEl.className = "text-xs font-bold app-text-sec";

  if (!isPurchased) {
    statusEl.textContent = tr(t, "pro_status_free", "Free");
    return;
  }

  if (mode === "lifetime") {
    statusEl.textContent = tr(
      t,
      "pro_status_lifetime_active",
      "Pro version active",
    );
  } else {
    statusEl.textContent = tr(
      t,
      "pro_status_subscription_active",
      "Subscription active",
    );
  }
}

function renderPaywallPrice(config, t, langManager) {
  const box = document.getElementById("pro-paywall-price");
  if (!box) return;

  const pricing = getPricingState(config);
  const label = tr(t, "pro_price_from", "Price");
  const currentText = formatPriceWithPeriod(pricing, t, langManager);

  if (!pricing.hasDiscount) {
    box.innerHTML = `
      <span class="pro-meta">${label}</span>
      <span class="pro-current">${currentText}</span>
    `;
    return;
  }

  const oldText = formatMoney(pricing.amount, pricing, langManager);
  const saveText = formatMoney(
    pricing.amount - pricing.current,
    pricing,
    langManager,
  );

  box.innerHTML = `
    <span class="pro-meta">${label}</span>
    <span class="pro-current">${currentText}</span>
    <span class="pro-old">${oldText}</span>
    <span class="pro-meta">${tr(t, "pro_discount", "Discount")}: -${pricing.discountPercent}%</span>
    <span class="pro-meta">${tr(t, "pro_you_save", "You save")}: ${saveText}</span>
  `;
}

function renderProPurchaseUI(config, t, langManager, appProManager) {
  const buyBtn = document.getElementById("btn-buy-pro");
  const confirmBtn = document.getElementById("pro-confirm-buy");
  if (!buyBtn || !confirmBtn) return;

  const isPurchased = !!appProManager.purchased;
  const mode = appProManager.mode;
  const isLifetime = mode === "lifetime";
  const isSubscription = mode === "subscription";
  const pricing = getPricingState(config);

  renderPaywallPrice(config, t, langManager);

  if (isPurchased && isLifetime) {
    buyBtn.classList.add("hidden");
    buyBtn.dataset.proAction = "hidden";
  } else if (isPurchased && isSubscription) {
    buyBtn.classList.remove("hidden", "pro-animated-border", "pro-cta-buy");
    buyBtn.classList.add("pro-cta", "pro-cta-cancel");
    buyBtn.dataset.proAction = "cancel-subscription";
    buyBtn.textContent = tr(t, "cancel_subscription", "Cancel Subscription");
  } else {
    buyBtn.classList.remove("hidden", "pro-cta-cancel");
    buyBtn.classList.add("pro-cta", "pro-cta-buy", "pro-animated-border");
    buyBtn.dataset.proAction = "open-paywall";

    const label = isLifetime
      ? tr(t, "buy_pro", "Buy Pro")
      : tr(t, "buy_subscription", "Buy Subscription");

    buyBtn.innerHTML = `
      <span>${label}</span>
      <span class="pro-cta-price">${formatPriceWithPeriod(pricing, t, langManager)}</span>
    `;
  }

  confirmBtn.classList.remove("pro-cta-cancel");
  confirmBtn.classList.add("pro-cta", "pro-cta-buy", "pro-animated-border");
  confirmBtn.textContent = isLifetime
    ? tr(t, "buy_pro", "Buy Pro")
    : tr(t, "buy_subscription", "Buy Subscription");
}

function bindProPaywallToasts(t, showToast) {
  const featureNameByKey = {
    custom_colors: () =>
      tr(t, "pro_feature_name_custom_colors", "Custom colors"),
    accent_bg: () =>
      tr(t, "pro_feature_name_accent_bg", "Accent and background"),
    remove_ads: () => tr(t, "pro_feature_name_remove_ads", "Disable ads"),
    sound_themes: () => tr(t, "pro_feature_name_sound_themes", "Sound themes"),
    app_icon: () => tr(t, "pro_feature_name_app_icon", "Pro icon"),
  };

  document.addEventListener(APP_EVENTS.PRO_PAYWALL_REQUESTED, (e) => {
    const feature = e?.detail?.feature || "";
    const label = featureNameByKey[feature]?.();

    if (label) {
      showToast(
        `${label}: ${tr(t, "pro_required", "Feature available in Pro")}`,
      );
    } else {
      showToast(tr(t, "pro_required", "Feature available in Pro"));
    }
  });
}

export function initProUi({
  t,
  langManager,
  appProManager,
  config,
  showToast,
}) {
  const sync = () => {
    if (!hasProUiNodes()) return;
    renderProBadgesFromConfig(config, t);
    updateProStatusBadge(t, appProManager);
    renderProPurchaseUI(config, t, langManager, appProManager);
  };

  document.addEventListener(APP_EVENTS.PRO_STATUS_CHANGED, sync);
  document.addEventListener(APP_EVENTS.LANGUAGE_CHANGED, sync);

  bindProPaywallToasts(t, showToast);
  sync();
}
