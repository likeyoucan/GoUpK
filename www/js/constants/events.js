// Файл: www/js/constants/events.js

export const APP_EVENTS = {
  TIMER_STARTED: "timerStarted",
  ACTIVE_TIMER_CHANGED: "activeTimerChanged",

  // Completion events for monetization hooks
  TIMER_COMPLETED: "timerCompleted",
  TABATA_COMPLETED: "tabataCompleted",

  MS_CHANGED: "msChanged",
  LANGUAGE_CHANGED: "languageChanged",

  FOREGROUND_NOTIFICATION_SETTING_CHANGED:
    "foregroundNotificationSettingChanged",

  VIBRO_TOGGLED: "vibroToggled",
  ADAPTIVE_BG_CHANGED: "adaptiveBgChanged",

  COLOR_SELECTED: "colorSelected",
  COLOR_DELETED: "colorDeleted",
  ACCENT_COLOR_CHANGED: "accentColorChanged",

  // Ads
  ADS_SETTINGS_CHANGED: "adsSettingsChanged",
  ADS_BANNER_VISIBILITY_CHANGED: "adsBannerVisibilityChanged",

  // App Pro
  PRO_STATUS_CHANGED: "proStatusChanged",
  PRO_PAYWALL_REQUESTED: "proPaywallRequested",
  PRO_TAMPER_DETECTED: "proTamperDetected",
};
