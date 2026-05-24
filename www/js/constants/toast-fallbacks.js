// Файл: www/js/constants/toast-fallbacks.js

export const TOAST_FALLBACKS_BY_KEY = Object.freeze({
  pro_required: "Feature available in Pro",
  pro_sound_themes_locked: "Sound themes are available in Pro",
  pro_integrity_reset: "Pro data was reset after integrity check",
  pro_activated: "Pro activated",
  pro_deactivated: "Pro deactivated",
  disable_ads_pro: "Disable ads is available in Pro",
  share_failed: "Unable to share",
  share_file_failed: "Failed to share file",
  pro_already_active: "PRO is already active",
});

export function resolveI18nOrFallback(t, key, explicitFallback = "") {
  const value = t(key);
  if (value !== key) return value;
  if (explicitFallback) return explicitFallback;
  return TOAST_FALLBACKS_BY_KEY[key] || key;
}

export function resolveToastText(t, key, explicitFallback = "") {
  return resolveI18nOrFallback(t, key, explicitFallback);
}
