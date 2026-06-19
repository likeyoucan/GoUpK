// Файл: www/js/types/managers-contracts.js

/**
 * @typedef {"stopwatch" | "timer" | "tabata" | "settings"} AppView
 */

/**
 * @typedef {"bottom-sheet" | "alert"} ModalType
 */

/**
 * @typedef {Object} ModalConfig
 * @property {string} id
 * @property {ModalType} type
 * @property {string} [handlerId]
 * @property {string} [contentId]
 * @property {(data?: any) => void} [onOpen]
 * @property {() => void} [onClose]
 */

/**
 * @typedef {Object} ModalEntry
 * @property {string} id
 * @property {ModalType} type
 * @property {HTMLElement} el
 * @property {HTMLElement | null} content
 * @property {HTMLElement | null} handlerEl
 * @property {(data?: any) => void} [onOpen]
 * @property {() => void} [onClose]
 */

/**
 * @typedef {Object} ModalManagerContract
 * @property {(config: ModalConfig[]) => void} init
 * @property {() => void} destroy
 * @property {() => boolean} hasActiveModal
 * @property {(id: string, data?: any) => void} open
 * @property {(id: string) => void} close
 * @property {() => void} closeCurrent
 */

/**
 * @typedef {Object} NavigationManagerContract
 * @property {AppView} activeView
 * @property {boolean} isTransitioning
 * @property {() => void} init
 * @property {(viewId: AppView, options?: {source?: "tap" | "swipe"}) => boolean} switchView
 * @property {(viewId: AppView, options?: {instant?: boolean}) => void} updateDOM
 * @property {(activeId: AppView) => void} updateIcons
 * @property {() => void} initClock
 */

/**
 * @typedef {"system" | "light" | "dark"} ThemeMode
 */

/**
 * @typedef {Object} ThemeManagerContract
 * @property {ThemeMode} currentMode
 * @property {string} currentAccent
 * @property {string} currentBg
 * @property {() => void} init
 * @property {() => void} destroy
 * @property {() => void} resetSettings
 * @property {(mode: ThemeMode, useTransition?: boolean) => void} setMode
 * @property {(hex: string, doScroll?: boolean, options?: {recordHistory?: boolean, skipProCheck?: boolean}) => void} setColor
 * @property {(hex: string, doScroll?: boolean, options?: {recordHistory?: boolean, skipProCheck?: boolean}) => void} setBgColor
 * @property {() => "light" | "dark"} getCurrentTheme
 * @property {() => void} syncSliderUIs
 */

/**
 * @typedef {Object} UiSettingsManagerContract
 * @property {boolean} showMs
 * @property {boolean} showForegroundBanner
 * @property {boolean} isAdaptiveBg
 * @property {boolean} hasVignette
 * @property {boolean} isLiquidGlass
 * @property {boolean} hideNavLabels
 * @property {number} vignetteAlpha
 * @property {number} fontSize
 * @property {number} ringWidth
 * @property {boolean} swMinuteBeep
 * @property {boolean} adsEnabled
 * @property {string} adsProvider
 * @property {() => void} init
 * @property {() => void} destroy
 * @property {() => void} applySettings
 * @property {() => void} resetSettings
 * @property {() => void} syncSliderUIs
 */
