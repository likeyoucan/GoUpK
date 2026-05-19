// Файл: www/js/ads.js

import { $, safeGetLS, safeSetLS } from "./utils.js?v=VERSION";
import { STORAGE_KEYS } from "./constants/storage-keys.js?v=VERSION";
import { APP_EVENTS } from "./constants/events.js?v=VERSION";
import { store } from "./store.js?v=VERSION";
import { appProManager } from "./app-pro.js?v=VERSION";

const DEFAULT_COOLDOWN_MS = 5 * 60 * 1000;
const DEFAULT_PROVIDER = "yandex"; // yandex | admob | mediation
const PROVIDERS = new Set(["yandex", "admob", "mediation"]);
const KNOWN_TIMER_IDS = new Set(["stopwatch", "timer", "tabata"]);

function isNative() {
  return !!(window.Capacitor && window.Capacitor.isNativePlatform());
}

function getAdsPlugin() {
  // Optional native bridge plugin:
  // window.Capacitor.Plugins.AdsBridge
  return window.Capacitor?.Plugins?.AdsBridge || null;
}

function readBool(key, fallback = true) {
  const raw = safeGetLS(key);
  if (raw === null) return fallback;
  return raw !== "false";
}

function readNumber(key, fallback) {
  const raw = Number(safeGetLS(key));
  return Number.isFinite(raw) ? raw : fallback;
}

function nowMs() {
  return Date.now();
}

function dispatch(name, detail = {}) {
  document.dispatchEvent(new CustomEvent(name, { detail }));
}

export const adsManager = {
  enabled: true,
  provider: DEFAULT_PROVIDER,
  interstitialCooldownMs: DEFAULT_COOLDOWN_MS,
  bannerMounted: false,
  initialized: false,

  reconcileActiveTimerState(runtime = null) {
    const active = store.getActiveTimer?.();
    if (!active) return null;

    // Defensive cleanup for corrupted values.
    if (!KNOWN_TIMER_IDS.has(active)) {
      store.clearActiveTimer?.();
      return null;
    }

    // Optional deep check with runtime modules.
    if (runtime) {
      const hasRunningStopwatch = !!runtime?.sw?.isRunning;
      const hasRunningTimer = !!runtime?.tm?.isRunning;
      const hasRunningTabata =
        !!runtime?.tb?.status &&
        runtime.tb.status !== "STOPPED" &&
        !runtime?.tb?.paused;

      const hasRealActive =
        hasRunningStopwatch || hasRunningTimer || hasRunningTabata;

      if (!hasRealActive) {
        store.clearActiveTimer?.();
        return null;
      }
    }

    return store.getActiveTimer?.() || null;
  },

  init() {
    this.enabled = readBool(STORAGE_KEYS.APP_ADS_ENABLED, true);

    const p = safeGetLS(STORAGE_KEYS.APP_ADS_PROVIDER) || DEFAULT_PROVIDER;
    this.provider = PROVIDERS.has(p) ? p : DEFAULT_PROVIDER;

    this.interstitialCooldownMs = readNumber(
      STORAGE_KEYS.APP_ADS_INTERSTITIAL_COOLDOWN_MS,
      DEFAULT_COOLDOWN_MS,
    );

    this.initialized = true;

    if (isNative()) {
      const plugin = getAdsPlugin();
      plugin
        ?.initAds?.({
          provider: this.provider,
          testMode: false,
        })
        .catch(() => {});
    }

    this.renderBanner();
  },

  bindAutoRefresh() {
    document.addEventListener(APP_EVENTS.ACTIVE_TIMER_CHANGED, () =>
      this.renderBanner(),
    );
    document.addEventListener(APP_EVENTS.ADS_SETTINGS_CHANGED, () =>
      this.renderBanner(),
    );
    document.addEventListener(APP_EVENTS.PRO_STATUS_CHANGED, () =>
      this.renderBanner(),
    );
  },

  bindLifecycleMonetization() {
    // Interstitial after timer/tabata completion (guarded by cooldown and active timer state)
    document.addEventListener(APP_EVENTS.TIMER_COMPLETED, () => {
      this.showInterstitialIfAllowed("timer_complete");
    });

    document.addEventListener(APP_EVENTS.TABATA_COMPLETED, () => {
      this.showInterstitialIfAllowed("tabata_complete");
    });
  },

  setEnabled(next) {
    // remove_ads is a Pro feature.
    const canDisableAds = appProManager.canUse("remove_ads");
    const finalValue = canDisableAds ? !!next : true;

    this.enabled = finalValue;
    safeSetLS(STORAGE_KEYS.APP_ADS_ENABLED, String(finalValue));

    if (isNative()) {
      getAdsPlugin()
        ?.setAdsEnabled?.({ enabled: finalValue })
        .catch(() => {});
    }

    this.renderBanner();
    dispatch(APP_EVENTS.ADS_SETTINGS_CHANGED, { enabled: finalValue });
  },

  setProvider(next) {
    const provider = PROVIDERS.has(next) ? next : DEFAULT_PROVIDER;
    this.provider = provider;
    safeSetLS(STORAGE_KEYS.APP_ADS_PROVIDER, provider);

    if (isNative()) {
      getAdsPlugin()
        ?.setProvider?.({ provider })
        .catch(() => {});
    }

    dispatch(APP_EVENTS.ADS_SETTINGS_CHANGED, { provider });
  },

  setInterstitialCooldown(ms) {
    const value = Math.max(30_000, Number(ms) || DEFAULT_COOLDOWN_MS);
    this.interstitialCooldownMs = value;
    safeSetLS(STORAGE_KEYS.APP_ADS_INTERSTITIAL_COOLDOWN_MS, String(value));
  },

shouldShowAds() {
  // Показываем рекламу строго по настройке enabled.
  // Pro только дает право выключать рекламу, но не принудительно скрывает ее.
  return !!this.enabled;
}

  shouldShowBanner() {
    if (!this.shouldShowAds()) return false;

    // Don't show banner while an active timer/stopwatch/tabata session is running.
    const active = this.reconcileActiveTimerState();
    if (active) return false;

    return true;
  },

  renderBanner() {
    const slot = $("app-ad-slot");
    const visible = this.shouldShowBanner();

    if (!slot) {
      dispatch(APP_EVENTS.ADS_BANNER_VISIBILITY_CHANGED, { visible: false });
      return;
    }

    if (!visible) {
      slot.classList.add("hidden");
      slot.innerHTML = "";
      this.bannerMounted = false;

      if (isNative()) {
        getAdsPlugin()
          ?.hideBanner?.()
          .catch(() => {});
      }

      dispatch(APP_EVENTS.ADS_BANNER_VISIBILITY_CHANGED, { visible: false });
      return;
    }

    slot.classList.remove("hidden");
    this.bannerMounted = true;

    if (!isNative()) {
      // Web placeholder for github pages/dev.
      slot.innerHTML = `
        <div class="w-full text-center text-[10px] app-text-sec py-2 border-t app-border">
          Ad banner placeholder (${this.provider})
        </div>
      `;
    } else {
      getAdsPlugin()
        ?.showBanner?.({
          placement: "main_bottom_banner",
          provider: this.provider,
        })
        .catch(() => {});
    }

    dispatch(APP_EVENTS.ADS_BANNER_VISIBILITY_CHANGED, { visible: true });
  },

  canShowInterstitial() {
    if (!this.shouldShowAds()) return false;

    // Never show interstitial while timer is active.
    const active = this.reconcileActiveTimerState();
    if (active) return false;

    const lastAt = readNumber(STORAGE_KEYS.APP_ADS_LAST_INTERSTITIAL_AT, 0);
    return nowMs() - lastAt >= this.interstitialCooldownMs;
  },

  markInterstitialShown() {
    safeSetLS(STORAGE_KEYS.APP_ADS_LAST_INTERSTITIAL_AT, String(nowMs()));
  },

  showInterstitialIfAllowed(context = "generic") {
    if (!this.canShowInterstitial()) return false;
    this.markInterstitialShown();

    if (!isNative()) {
      console.info("[ads] interstitial mock:", context);
      return true;
    }

    getAdsPlugin()
      ?.showInterstitial?.({
        placement: `interstitial_${context}`,
        provider: this.provider,
      })
      .catch(() => {});

    return true;
  },
};
