// Файл: www/js/ads.js

import { $, safeGetLS, safeSetLS } from "./utils.js?v=VERSION";
import { STORAGE_KEYS } from "./constants/storage-keys.js?v=VERSION";
import { APP_EVENTS } from "./constants/events.js?v=VERSION";
import { appProManager } from "./app-pro.js?v=VERSION";
import {
  isNativePlatform,
  getPlugin,
} from "./platform/capacitor-adapter.js?v=VERSION";
import { emitAppEvent } from "./events/app-events.js?v=VERSION";

const DEFAULT_COOLDOWN_MS = 5 * 60 * 1000;
const DEFAULT_PROVIDER = "yandex"; // yandex | admob | mediation
const PROVIDERS = new Set(["yandex", "admob", "mediation"]);

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

const DEFAULT_INTERSTITIAL_MIN_COOLDOWN_MS = 30_000;
const DESKTOP_FIXED_MIN_WIDTH = 1281;

function isNative() {
  return isNativePlatform();
}

function getAdsPlugin() {
  return getPlugin("AdsBridge");
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
  emitAppEvent(name, detail);
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

function normalizeTriggers(map) {
  return {
    ...DEFAULT_INTERSTITIAL_TRIGGERS,
    ...(map && typeof map === "object" ? map : {}),
  };
}

function isDesktopAdLayout() {
  return window.matchMedia(`(min-width: ${DESKTOP_FIXED_MIN_WIDTH}px)`).matches;
}

function shouldApplyMobileOffsetWhenAdsOff() {
  return window.matchMedia("(max-width: 767px) and (orientation: portrait)")
    .matches;
}

function updateMobileOffsetClass(isBannerVisible) {
  const app = $("app");
  const viewsContainer = $("viewsContainer");

  if (!app) return;

  viewsContainer?.classList.remove("ads-mobile-offset");

  const shouldOffset = !isBannerVisible && shouldApplyMobileOffsetWhenAdsOff();
  app.classList.toggle("ads-mobile-offset-var", shouldOffset);
}

export const adsManager = {
  enabled: true,
  provider: DEFAULT_PROVIDER,
  interstitialCooldownMs: DEFAULT_COOLDOWN_MS,

  bannerMode: DEFAULT_BANNER_MODE,
  interstitialTriggers: { ...DEFAULT_INTERSTITIAL_TRIGGERS },

  bannerMounted: false,
  initialized: false,
  _viewportListenerBound: false,

  _unbinds: [],
  _viewportHandler: null,

  init() {
    this._cleanupBindings();

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

    this._bindViewportListener();
    this.renderBanner();
  },

  _cleanupBindings() {
    this._unbinds.forEach((off) => {
      try {
        off?.();
      } catch (err) {
        console.error("[ads.cleanup]", err);
      }
    });
    this._unbinds = [];
    this._viewportListenerBound = false;
    this._viewportHandler = null;
  },

  _bindViewportListener() {
    if (this._viewportListenerBound) return;
    this._viewportListenerBound = true;

    this._viewportHandler = () => this.renderBanner();

    window.addEventListener("resize", this._viewportHandler, { passive: true });
    window.addEventListener("orientationchange", this._viewportHandler, {
      passive: true,
    });

    this._unbinds.push(() =>
      window.removeEventListener("resize", this._viewportHandler),
    );
    this._unbinds.push(() =>
      window.removeEventListener("orientationchange", this._viewportHandler),
    );
  },

  bindAutoRefresh() {
    const onAdsChanged = () => this.renderBanner();
    const onBannerModeChanged = () => this.renderBanner();
    const onProChanged = () => this.renderBanner();

    document.addEventListener(APP_EVENTS.ADS_SETTINGS_CHANGED, onAdsChanged);
    document.addEventListener(
      APP_EVENTS.ADS_BANNER_MODE_CHANGED,
      onBannerModeChanged,
    );
    document.addEventListener(APP_EVENTS.PRO_STATUS_CHANGED, onProChanged);

    this._unbinds.push(() =>
      document.removeEventListener(
        APP_EVENTS.ADS_SETTINGS_CHANGED,
        onAdsChanged,
      ),
    );
    this._unbinds.push(() =>
      document.removeEventListener(
        APP_EVENTS.ADS_BANNER_MODE_CHANGED,
        onBannerModeChanged,
      ),
    );
    this._unbinds.push(() =>
      document.removeEventListener(APP_EVENTS.PRO_STATUS_CHANGED, onProChanged),
    );
  },

  bindLifecycleMonetization() {
    const onTimerCompleted = () => {
      this.showInterstitialIfAllowed("timer_complete");
    };

    const onTabataCompleted = () => {
      this.showInterstitialIfAllowed("tabata_complete");
    };

    const onTimerStarted = (e) => {
      if (e?.detail === "timer") {
        this.showInterstitialIfAllowed("timer_start");
      }
    };

    document.addEventListener(APP_EVENTS.TIMER_COMPLETED, onTimerCompleted);
    document.addEventListener(APP_EVENTS.TABATA_COMPLETED, onTabataCompleted);
    document.addEventListener(APP_EVENTS.TIMER_STARTED, onTimerStarted);

    this._unbinds.push(() =>
      document.removeEventListener(
        APP_EVENTS.TIMER_COMPLETED,
        onTimerCompleted,
      ),
    );
    this._unbinds.push(() =>
      document.removeEventListener(
        APP_EVENTS.TABATA_COMPLETED,
        onTabataCompleted,
      ),
    );
    this._unbinds.push(() =>
      document.removeEventListener(APP_EVENTS.TIMER_STARTED, onTimerStarted),
    );
  },

  setEnabled(next) {
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
    this.renderBanner();
    dispatch(APP_EVENTS.ADS_BANNER_MODE_CHANGED, { mode: this.bannerMode });
  },

  setInterstitialTriggers(map = {}) {
    this.interstitialTriggers = normalizeTriggers(map);
    dispatch(APP_EVENTS.ADS_INTERSTITIAL_TRIGGERS_CHANGED, {
      triggers: { ...this.interstitialTriggers },
    });
  },

  setInterstitialCooldown(ms) {
    const value = Math.max(
      DEFAULT_INTERSTITIAL_MIN_COOLDOWN_MS,
      Number(ms) || DEFAULT_COOLDOWN_MS,
    );
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
      updateMobileOffsetClass(false);
      dispatch(APP_EVENTS.ADS_BANNER_VISIBILITY_CHANGED, { visible: false });
      return;
    }

    if (!visible) {
      this.bannerMounted = false;

      if (isNative()) {
        getAdsPlugin()
          ?.hideBanner?.()
          .catch(() => {});
      }

      slot.replaceChildren();
      slot.classList.add("hidden");

      updateMobileOffsetClass(false);

      dispatch(APP_EVENTS.ADS_BANNER_VISIBILITY_CHANGED, { visible: false });
      return;
    }

    slot.classList.remove("hidden");
    this.bannerMounted = true;
    slot.replaceChildren();

    if (!isNative()) {
      slot.appendChild(createWebPlaceholder(this.provider));
    } else {
      getAdsPlugin()
        ?.showBanner?.({
          placement: isDesktopAdLayout()
            ? "fixed_top_banner"
            : "inline_top_banner",
          provider: this.provider,
        })
        .catch(() => {});
    }

    updateMobileOffsetClass(true);

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
