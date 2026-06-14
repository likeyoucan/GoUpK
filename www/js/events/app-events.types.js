// Файл: www/js/events/app-events.types.js

/**
 * @typedef {"stopwatch" | "timer" | "tabata" | "settings"} AppView
 */

/**
 * @typedef {Object} ActiveTimerChangedDetail
 * @property {string | null} activeTimer
 */

/**
 * @typedef {Object} TimerCompletedDetail
 * @property {number} at
 * @property {number} duration
 */

/**
 * @typedef {Object} TabataCompletedDetail
 * @property {number} at
 * @property {number} rounds
 * @property {number | null} workoutId
 */

/**
 * @typedef {Object} ProStatusChangedDetail
 * @property {boolean} purchased
 * @property {string} [mode]
 * @property {Record<string, boolean>} [features]
 */

/**
 * @typedef {Object} ProPaywallRequestedDetail
 * @property {string} feature
 */

/**
 * @typedef {Object} ColorSelectedDetail
 * @property {"accent" | "bg"} type
 * @property {string} color
 * @property {boolean} fromPicker
 */

/**
 * @typedef {Object} ColorDeletedDetail
 * @property {"accent" | "bg"} type
 * @property {string} color
 */

/**
 * @typedef {Object} AppIconChangedDetail
 * @property {string} id
 * @property {string} src
 * @property {string} label
 * @property {string} labelKey
 * @property {boolean} proRequired
 */

/**
 * @typedef {Object} AdsSettingsChangedDetail
 * @property {boolean} [enabled]
 * @property {string} [provider]
 */

/**
 * @typedef {Object} VibroToggledDetail
 * @property {boolean} enabled
 */

/**
 * @typedef {Object} AppEventDetailMap
 * @property {string} timerStarted
 * @property {ActiveTimerChangedDetail} activeTimerChanged
 * @property {TimerCompletedDetail} timerCompleted
 * @property {TabataCompletedDetail} tabataCompleted
 * @property {undefined} msChanged
 * @property {undefined} languageChanged
 * @property {undefined} foregroundNotificationSettingChanged
 * @property {VibroToggledDetail} vibroToggled
 * @property {undefined} adaptiveBgChanged
 * @property {ColorSelectedDetail} colorSelected
 * @property {ColorDeletedDetail} colorDeleted
 * @property {undefined} accentColorChanged
 * @property {AdsSettingsChangedDetail} adsSettingsChanged
 * @property {{visible: boolean}} adsBannerVisibilityChanged
 * @property {{mode: string}} adsBannerModeChanged
 * @property {{triggers: Record<string, boolean>}} adsInterstitialTriggersChanged
 * @property {AppIconChangedDetail} appIconChanged
 * @property {ProStatusChangedDetail} proStatusChanged
 * @property {ProPaywallRequestedDetail} proPaywallRequested
 * @property {{reason: string}} proTamperDetected
 */

export {};
