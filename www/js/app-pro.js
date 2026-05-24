// Файл: www/js/app-pro.js

import { safeGetLS, safeSetLS, showToast } from "./utils.js?v=VERSION";
import { t } from "./i18n.js?v=VERSION";
import { STORAGE_KEYS } from "./constants/storage-keys.js?v=VERSION";
import { APP_EVENTS } from "./constants/events.js?v=VERSION";
import { proSecurity } from "./app-pro-security.js?v=VERSION";
import { resolveToastText } from "./constants/toast-fallbacks.js?v=VERSION";

const DEFAULT_MODE = "subscription"; // subscription | lifetime | disabled
const DEFAULT_FEATURES = {
  custom_colors: true,
  accent_bg: true,
  remove_ads: true,
  sound_themes: true,
  app_icon: true,
};

function parseJson(raw, fallback) {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function dispatch(name, detail = {}) {
  document.dispatchEvent(new CustomEvent(name, { detail }));
}

export const appProManager = {
  mode: DEFAULT_MODE,
  purchased: false,
  features: { ...DEFAULT_FEATURES },
  updatedAt: 0,

  initialized: false,

  async init() {
    proSecurity.ensureInstallId();

    this.mode = safeGetLS(STORAGE_KEYS.APP_PRO_MODE) || DEFAULT_MODE;
    this.purchased = safeGetLS(STORAGE_KEYS.APP_PRO_PURCHASED) === "true";
    this.features = parseJson(safeGetLS(STORAGE_KEYS.APP_PRO_FEATURES), {
      ...DEFAULT_FEATURES,
    });
    this.updatedAt = Number(safeGetLS(STORAGE_KEYS.APP_PRO_UPDATED_AT)) || 0;

    const payload = proSecurity.buildPayload({
      mode: this.mode,
      purchased: this.purchased,
      features: this.features,
      updatedAt: this.updatedAt,
    });
    const signature = safeGetLS(STORAGE_KEYS.APP_PRO_SIGNATURE) || "";

    const ok = await proSecurity.verify(payload, signature);

    if (!signature) {
      if (this.purchased) {
        await this.resetToSafeState("missing_signature_with_purchased_true");
        this.initialized = true;
        return;
      }

      await this.persist();
      this.initialized = true;
      this.applyProIcon();
      dispatch(APP_EVENTS.PRO_STATUS_CHANGED, { purchased: this.purchased });
      return;
    }

    if (!ok) {
      await this.resetToSafeState("signature_mismatch");
      this.initialized = true;
      return;
    }

    this.initialized = true;
    this.applyProIcon();
    dispatch(APP_EVENTS.PRO_STATUS_CHANGED, { purchased: this.purchased });
  },

  async resetToSafeState(reason = "unknown") {
    this.mode = DEFAULT_MODE;
    this.purchased = false;
    this.features = { ...DEFAULT_FEATURES };
    this.updatedAt = Date.now();

    safeSetLS(STORAGE_KEYS.APP_PRO_MODE, this.mode);
    safeSetLS(STORAGE_KEYS.APP_PRO_PURCHASED, "false");
    safeSetLS(STORAGE_KEYS.APP_PRO_FEATURES, JSON.stringify(this.features));
    safeSetLS(STORAGE_KEYS.APP_PRO_UPDATED_AT, String(this.updatedAt));
    safeSetLS(STORAGE_KEYS.APP_PRO_SIGNATURE, "");

    await this.persist();
    this.applyProIcon();

    showToast(resolveToastText(t, "pro_integrity_reset"));
    dispatch(APP_EVENTS.PRO_TAMPER_DETECTED, { reason });
    dispatch(APP_EVENTS.PRO_STATUS_CHANGED, { purchased: false });
  },

  async persist() {
    this.updatedAt = Date.now();

    safeSetLS(STORAGE_KEYS.APP_PRO_MODE, this.mode);
    safeSetLS(STORAGE_KEYS.APP_PRO_PURCHASED, String(this.purchased));
    safeSetLS(STORAGE_KEYS.APP_PRO_FEATURES, JSON.stringify(this.features));
    safeSetLS(STORAGE_KEYS.APP_PRO_UPDATED_AT, String(this.updatedAt));

    const payload = proSecurity.buildPayload({
      mode: this.mode,
      purchased: this.purchased,
      features: this.features,
      updatedAt: this.updatedAt,
    });

    const signature = await proSecurity.sign(payload);
    safeSetLS(STORAGE_KEYS.APP_PRO_SIGNATURE, signature);

    dispatch(APP_EVENTS.PRO_STATUS_CHANGED, {
      purchased: this.purchased,
      mode: this.mode,
      features: this.features,
    });
  },

  async revalidateOrReset() {
    const payload = proSecurity.buildPayload({
      mode: this.mode,
      purchased: this.purchased,
      features: this.features,
      updatedAt: this.updatedAt,
    });
    const signature = safeGetLS(STORAGE_KEYS.APP_PRO_SIGNATURE) || "";
    const ok = await proSecurity.verify(payload, signature);

    if (!ok) {
      await this.resetToSafeState("runtime_revalidation_failed");
      return false;
    }
    return true;
  },

  canUse(featureKey) {
    if (this.mode === "disabled") return true;

    const isGated = !!this.features?.[featureKey];
    if (!isGated) return true;

    return this.purchased;
  },

  requirePro(featureKey, onBlocked) {
    const allowed = this.canUse(featureKey);
    if (allowed) return true;

    dispatch(APP_EVENTS.PRO_PAYWALL_REQUESTED, { feature: featureKey });
    if (typeof onBlocked === "function") onBlocked(featureKey);
    return false;
  },

  async purchase({ mode } = {}) {
    if (mode) this.mode = mode;
    this.purchased = true;
    await this.persist();
    this.applyProIcon();
    showToast(resolveToastText(t, "pro_activated"));
  },

  async revoke() {
    this.purchased = false;
    await this.persist();
    this.applyProIcon();
    showToast(resolveToastText(t, "pro_deactivated"));
  },

  async setMode(nextMode) {
    this.mode = nextMode || DEFAULT_MODE;
    await this.persist();
  },

  async setFeatureGate(featureKey, isGated) {
    this.features = {
      ...this.features,
      [featureKey]: !!isGated,
    };
    await this.persist();
  },

  applyProIcon() {
    const isPro = !!this.purchased;
    document.documentElement.classList.toggle("is-pro-user", isPro);

    const preferred = safeGetLS(STORAGE_KEYS.APP_ICON_NAME) || "default";
    const normalized = preferred === "pro" ? "pro" : "default";

    const canUseCustomIcon = this.canUse("app_icon");
    const finalIcon = canUseCustomIcon ? normalized : "default";

    if (!canUseCustomIcon && normalized !== "default") {
      safeSetLS(STORAGE_KEYS.APP_ICON_NAME, "default");
    }

    const iconPlugin = window.Capacitor?.Plugins?.AppIconSwitcher;
    if (iconPlugin?.setIconName) {
      iconPlugin.setIconName({ name: finalIcon }).catch(() => {});
    }
  },
};
