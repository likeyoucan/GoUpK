// Файл: www/js/bootstrap/monetization-bootstrap.js

import { safeGetLS, safeSetLS } from "../utils.js?v=VERSION";
import { APP_EVENTS } from "../constants/events.js?v=VERSION";
import { STORAGE_KEYS } from "../constants/storage-keys.js?v=VERSION";

import { appProManager } from "../app-pro.js?v=VERSION";
import { adsManager } from "../ads.js?v=VERSION";
import { initProUi } from "../pro-ui.js?v=VERSION";
import {
  initAppIconSelector,
  getResolvedAppIconMeta,
} from "../app-icon-selector.js?v=VERSION";

import {
  validateMonetizationConfig,
  reportMonetizationConfigIssues,
} from "./config-validator.js?v=VERSION";

const ADS_AUTO_DISABLE_MARKER = "app_ads_auto_disabled_after_pro";

function syncAdsToggleUi(checked) {
  const toggleAds = document.getElementById("toggle-ads");
  if (toggleAds) toggleAds.checked = !!checked;
}

function shouldAutoDisableAdsOnPro(config) {
  return !!config?.ads?.autoDisableOnProPurchase;
}

function maybeAutoDisableAdsForPro(config, isPurchased) {
  if (!isPurchased) return;
  if (!shouldAutoDisableAdsOnPro(config)) return;

  const marker = safeGetLS(ADS_AUTO_DISABLE_MARKER) === "true";
  if (marker) return;

  adsManager.setEnabled(false);
  syncAdsToggleUi(false);
  safeSetLS(ADS_AUTO_DISABLE_MARKER, "true");
}

function bindProAdsAutomation(config) {
  document.addEventListener(APP_EVENTS.PRO_STATUS_CHANGED, (e) => {
    const purchased = !!e?.detail?.purchased;
    maybeAutoDisableAdsForPro(config, purchased);
  });

  maybeAutoDisableAdsForPro(config, !!appProManager.purchased);
}

function syncPreloaderIconMeta({ preload, t, config }) {
  const iconMeta = getResolvedAppIconMeta(t, appProManager);
  const preloadCfg = config?.ui?.preload || {};

  let label = "";
  const showIconLabel = preloadCfg.showIconLabel !== false;
  const onlyForProPurchase = preloadCfg.showLabelOnlyForProPurchase !== false;
  const labelMode = preloadCfg.proPurchasedLabelMode || "pro_word";

  if (showIconLabel) {
    if (!onlyForProPurchase || appProManager.purchased) {
      if (labelMode === "pro_word" && appProManager.purchased) {
        label = t("pro");
      } else {
        label = iconMeta.label || "";
      }
    }
  }

  preload.setIconMeta({
    src: iconMeta.src,
    label,
  });
}

async function applyMonetizationConfig(config) {
  if (!config.pro.enabled) {
    await appProManager.setMode("disabled");
  } else {
    await appProManager.setMode(config.pro.mode);

    const entries = Object.entries(config.pro.features || {});
    for (const [featureKey, isGated] of entries) {
      await appProManager.setFeatureGate(featureKey, !!isGated);
    }

    if (config.pro.forcePurchased === true) {
      await appProManager.purchase();
    } else if (config.pro.forcePurchased === false) {
      await appProManager.revoke();
    }
  }

  adsManager.setProvider(config.ads.defaultProvider);
  adsManager.setInterstitialCooldown(config.ads.interstitialCooldownMs);
  adsManager.setBannerMode(config.ads.bannerMode || "always");
  adsManager.setInterstitialTriggers(config.ads.interstitialTriggers || {});

  const storedAdsEnabled = safeGetLS(STORAGE_KEYS.APP_ADS_ENABLED);
  if (storedAdsEnabled === null) {
    adsManager.setEnabled(config.ads.enabledByDefault);
  } else {
    adsManager.setEnabled(storedAdsEnabled !== "false");
  }
}

function createLazyAppIconInit({ t, appProManager }) {
  let initialized = false;
  let fallbackTimer = 0;

  const initOnce = () => {
    if (initialized) return;
    initialized = true;

    if (fallbackTimer) {
      clearTimeout(fallbackTimer);
      fallbackTimer = 0;
    }

    initAppIconSelector({ t, appProManager });
  };

  const onSettingsNavClick = (e) => {
    const btn = e.target?.closest?.('[data-nav="settings"]');
    if (!btn) return;
    initOnce();
  };

  // Init only when user actually goes to settings.
  document.addEventListener("click", onSettingsNavClick, true);

  // Safety fallback: very late idle init so it doesn't hit first interactions.
  fallbackTimer = window.setTimeout(() => {
    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(() => initOnce(), { timeout: 2000 });
    } else {
      setTimeout(() => initOnce(), 0);
    }
  }, 8000);

  return initOnce;
}

export async function initMonetizationBootstrap({
  preload,
  t,
  langManager,
  showToast,
  config,
}) {
  const { config: validatedConfig, issues } =
    validateMonetizationConfig(config);
  reportMonetizationConfigIssues(issues);

  await appProManager.init();

  syncPreloaderIconMeta({ preload, t, config: validatedConfig });
  await applyMonetizationConfig(validatedConfig);

  adsManager.init();
  adsManager.bindAutoRefresh();
  adsManager.bindLifecycleMonetization();
  adsManager.showInterstitialIfAllowed("app_start");

  bindProAdsAutomation(validatedConfig);

  initProUi({
    t,
    langManager,
    appProManager,
    config: validatedConfig,
    showToast,
  });

  const initAppIconsIfNeeded = createLazyAppIconInit({ t, appProManager });

  document.addEventListener(APP_EVENTS.APP_ICON_CHANGED, () => {
    syncPreloaderIconMeta({ preload, t, config: validatedConfig });
  });

  // If Pro state changes and selector is already initialized later, no issue.
  // If not initialized yet, preloader meta still stays correct via resolved icon.
  document.addEventListener(APP_EVENTS.PRO_STATUS_CHANGED, () => {
    // Keep this no-op guard for potential future proactive init.
    void initAppIconsIfNeeded;
  });

  return { config: validatedConfig };
}
