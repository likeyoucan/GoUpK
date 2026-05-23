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

const DEFAULT_BANNER_MODE = "always"; // always | off
const DEFAULT_INTERSTITIAL_TRIGGERS = {
  app_start: true,
  app_close: false,
  share: false,
  save_result: false,
  timer_start: false,
  timer_complete: true,
  tabata_complete: true,
};

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

function createWebPlaceholder(provider) {
  const wrap = document.createElement("div");
  wrap.className = "ad-placeholder";
  wrap.textContent = `Ad banner placeholder (${provider})`;
  return wrap;
}

function normalizeBannerMode(mode) {
  return mode === "off" ? "off" : DEFAULT_BANNER_MODE;
}

function parseInterstitialTriggers(raw) {
  if (!raw) return { ...DEFAULT_INTERSTITIAL_TRIGGERS };
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return { ...DEFAULT_INTERSTITIAL_TRIGGERS };
    }
    return {
      ...DEFAULT_INTERSTITIAL_TRIGGERS,
      ...parsed,
    };
  } catch {
    return { ...DEFAULT_INTERSTITIAL_TRIGGERS };
  }
}

function persistInterstitialTriggers(map) {
  safeSetLS(STORAGE_KEYS.APP_ADS_INTERSTITIAL_TRIGGERS, JSON.stringify(map));
}

export const adsManager = {
  enabled: true,
  provider: DEFAULT_PROVIDER,
  interstitialCooldownMs: DEFAULT_COOLDOWN_MS,

  // New settings
  bannerMode: DEFAULT_BANNER_MODE,
  interstitialTriggers: { ...DEFAULT_INTERSTITIAL_TRIGGERS },

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

    this.bannerMode = normalizeBannerMode(
      safeGetLS(STORAGE_KEYS.APP_ADS_BANNER_MODE) || DEFAULT_BANNER_MODE,
    );

    this.interstitialTriggers = parseInterstitialTriggers(
      safeGetLS(STORAGE_KEYS.APP_ADS_INTERSTITIAL_TRIGGERS),
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
    document.addEventListener(APP_EVENTS.ADS_SETTINGS_CHANGED, () =>
      this.renderBanner(),
    );
    document.addEventListener(APP_EVENTS.ADS_BANNER_MODE_CHANGED, () =>
      this.renderBanner(),
    );
    document.addEventListener(APP_EVENTS.PRO_STATUS_CHANGED, () =>
      this.renderBanner(),
    );
  },

  bindLifecycleMonetization() {
    // Completion hooks
    document.addEventListener(APP_EVENTS.TIMER_COMPLETED, () => {
      this.showInterstitialIfAllowed("timer_complete");
    });

    document.addEventListener(APP_EVENTS.TABATA_COMPLETED, () => {
      this.showInterstitialIfAllowed("tabata_complete");
    });

    // Timer start hook
    document.addEventListener(APP_EVENTS.TIMER_STARTED, (e) => {
      if (e?.detail === "timer") {
        this.showInterstitialIfAllowed("timer_start");
      }
    });
  },

  setEnabled(next) {
    // remove_ads is a Pro feature
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

    this.renderBanner();
    dispatch(APP_EVENTS.ADS_SETTINGS_CHANGED, { provider });
  },

  setBannerMode(mode) {
    this.bannerMode = normalizeBannerMode(mode);
    safeSetLS(STORAGE_KEYS.APP_ADS_BANNER_MODE, this.bannerMode);

    this.renderBanner();
    dispatch(APP_EVENTS.ADS_BANNER_MODE_CHANGED, { mode: this.bannerMode });
  },

  setInterstitialTriggers(map = {}) {
    this.interstitialTriggers = {
      ...DEFAULT_INTERSTITIAL_TRIGGERS,
      ...(map && typeof map === "object" ? map : {}),
    };

    persistInterstitialTriggers(this.interstitialTriggers);

    dispatch(APP_EVENTS.ADS_INTERSTITIAL_TRIGGERS_CHANGED, {
      triggers: { ...this.interstitialTriggers },
    });
  },

  setInterstitialCooldown(ms) {
    const value = Math.max(30_000, Number(ms) || DEFAULT_COOLDOWN_MS);
    this.interstitialCooldownMs = value;
    safeSetLS(STORAGE_KEYS.APP_ADS_INTERSTITIAL_COOLDOWN_MS, String(value));
  },

  shouldShowAds() {
    return !!this.enabled;
  },

  shouldShowBanner() {
    if (!this.shouldShowAds()) return false;
    if (this.bannerMode === "off") return false;
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
      slot.replaceChildren();
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
    slot.replaceChildren();

    if (!isNative()) {
      // Web placeholder for github pages/dev
      slot.appendChild(createWebPlaceholder(this.provider));
    } else {
      // Banner is now part of app layout (inline top slot)
      getAdsPlugin()
        ?.showBanner?.({
          placement: "inline_top_banner",
          provider: this.provider,
        })
        .catch(() => {});
    }

    dispatch(APP_EVENTS.ADS_BANNER_VISIBILITY_CHANGED, { visible: true });
  },

  isInterstitialTriggerEnabled(context) {
    const key = String(context || "").trim();
    if (!key) return false;
    return !!this.interstitialTriggers?.[key];
  },

  canShowInterstitial(context = "generic") {
    if (!this.shouldShowAds()) return false;
    if (!this.isInterstitialTriggerEnabled(context)) return false;

    const lastAt = readNumber(STORAGE_KEYS.APP_ADS_LAST_INTERSTITIAL_AT, 0);
    return nowMs() - lastAt >= this.interstitialCooldownMs;
  },

  markInterstitialShown() {
    safeSetLS(STORAGE_KEYS.APP_ADS_LAST_INTERSTITIAL_AT, String(nowMs()));
  },

  showInterstitialIfAllowed(context = "generic") {
    if (!this.canShowInterstitial(context)) return false;
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
