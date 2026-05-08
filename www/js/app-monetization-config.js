// Файл: www/js/app-monetization-config.js

export const APP_MONETIZATION_CONFIG = {
  pro: {
    enabled: true,
    forcePurchased: true, // null | true | false
    mode: "subscription", // subscription | lifetime | disabled
    features: {
      custom_colors: true,
      accent_bg: true,
      remove_ads: true,
      sound_themes: true,
      app_icon: true,
    },
  },

  ads: {
    enabledByDefault: true,
    defaultProvider: "yandex", // yandex | admob | mediation
    aggregator: "mediation",
    strategy: "banner+interstitial",
    interstitialCooldownMs: 5 * 60 * 1000,
  },

  // Один бейдж на строку настройки
  proBadges: [
    { selector: "#setting-row-accent", feature: "accent_bg" },
    { selector: "#setting-row-bg", feature: "accent_bg" },
    { selector: "#setting-row-sound-theme", feature: "sound_themes" },
    { selector: "#setting-row-ads", feature: "remove_ads" },
  ],
};
