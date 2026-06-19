// Файл: www/js/theme/theme-controller.js

import { hexToHSL, hexToRGB, getLuminance } from "../utils.js?v=VERSION";
import { uiSettingsManager } from "../ui-settings.js?v=VERSION";
import { colorManager } from "../color-manager.js?v=VERSION";
import { appProManager } from "../app-pro.js?v=VERSION";
import { APP_EVENTS } from "../constants/events.js?v=VERSION";
import { t } from "../i18n.js?v=VERSION";
import { emitAppEvent } from "../events/app-events.js?v=VERSION";

import {
    applyModeToDocument,
    bindSystemThemeListener,
} from "./theme-mode.js?v=VERSION";
import { createColorHistory } from "./theme-color-history.js?v=VERSION";
import {
    applyAccentVars,
    applyBgTheme as applyBgThemeVars,
} from "./theme-colors.js?v=VERSION";
import {
    loadThemeSettings,
    saveThemeMode,
    saveThemeAccent,
    saveThemeBg,
    resetThemeSettings,
} from "./theme-repository.js?v=VERSION";
import { notifyProBlocked } from "./theme-guards.js?v=VERSION";
import { buildColorSet } from "./theme-history.js?v=VERSION";
import { createThemeModeSelectController } from "./theme-select.js?v=VERSION";
import { bindThemeEvents } from "./theme-events.js?v=VERSION";

const modeSelect = createThemeModeSelectController();

/**
 * @typedef {"system" | "light" | "dark"} ThemeMode
 */

/**
 * @typedef {Object} ThemeColorSetOptions
 * @property {boolean} [recordHistory=true]
 * @property {boolean} [skipProCheck=false]
 */

export const themeManager = {
    currentMode: "system",
    currentAccent: "default",
    currentBg: "default",

    _unbindSystemThemeListener: null,
    _history: createColorHistory(20),
    _unbindEvents: null,
    _isInitialized: false,

    init() {
        if (this._isInitialized) return;

        uiSettingsManager.init();
        colorManager.init();

        this.applySettings();

        modeSelect.init({
            currentMode: this.currentMode,
            onSelectMode: (value) => this.setMode(value),
        });
        modeSelect.syncValue(this.currentMode);

        this._unbindEvents = bindThemeEvents(this);
        this._isInitialized = true;
    },

    destroy() {
        if (!this._isInitialized) return;

        if (this._unbindEvents) {
            this._unbindEvents();
            this._unbindEvents = null;
        }

        if (this._unbindSystemThemeListener) {
            this._unbindSystemThemeListener();
            this._unbindSystemThemeListener = null;
        }

        modeSelect.destroy();
        this._isInitialized = false;
    },

    onSystemThemeChanged() {
        if (this._unbindSystemThemeListener) {
            this._unbindSystemThemeListener();
            this._unbindSystemThemeListener = null;
        }

        this._unbindSystemThemeListener = bindSystemThemeListener(() => {
            if (this.currentMode === "system") this.setMode("system");
        });

        return () => {
            if (this._unbindSystemThemeListener) {
                this._unbindSystemThemeListener();
                this._unbindSystemThemeListener = null;
            }
        };
    },

    refreshThemeSelectTexts() {
        modeSelect.refreshTexts(this.currentMode);
    },

    syncThemeSelectValue() {
        modeSelect.syncValue(this.currentMode);
    },

    applySettings() {
        this._history.reset();

        const stored = loadThemeSettings();
        this.currentMode = stored.mode;
        this.currentAccent = stored.accent;
        this.currentBg = stored.bg;

        if (appProManager.initialized && !appProManager.canUse("accent_bg")) {
            if (this.currentAccent !== "default" || this.currentBg !== "default") {
                this.currentAccent = "default";
                this.currentBg = "default";
                saveThemeAccent("default");
                saveThemeBg("default");
            }
        }

        colorManager.syncPickers(this.currentAccent, this.currentBg);
        this.setMode(this.currentMode, false);
    },

    resetSettings() {
        resetThemeSettings();

        this._history.reset();
        uiSettingsManager.resetSettings();

        this.applySettings();
        this.syncThemeSelectValue();
    },

    getCurrentTheme() {
        return document.documentElement.classList.contains("dark")
            ? "dark"
            : "light";
    },

    /**
     * @param {ThemeMode} mode
     * @param {boolean} [useTransition=true]
     */
    setMode(mode, useTransition = true) {
        if (useTransition) document.body.classList.add("is-updating-theme");

        this.currentMode = mode;
        saveThemeMode(mode);

        applyModeToDocument(mode);
        this.syncThemeSelectValue();

        this.applyBgTheme(this.currentBg);

        this.setColor(this.currentAccent, false, {
            recordHistory: false,
            skipProCheck: true,
        });

        colorManager.updateSelectionUI("bg", this.currentBg, false);
        this.applyMetaThemeColor();

        if (useTransition) {
            requestAnimationFrame(() =>
                document.body.classList.remove("is-updating-theme"),
            );
        }
    },

    getAvailableColorSet(type) {
        return buildColorSet(type, colorManager);
    },

    getLastValidColor(type) {
        return this._history.getLastValid(type, this.getAvailableColorSet(type));
    },

    /**
     * @param {string} hex
     * @param {boolean} [doScroll=true]
     * @param {ThemeColorSetOptions} [options]
     */
    setColor(hex, doScroll = true, options = {}) {
        const { recordHistory = true, skipProCheck = false } = options;

        if (
            !skipProCheck &&
            hex !== "default" &&
            !appProManager.canUse("accent_bg")
        ) {
            notifyProBlocked(t, "accent_bg");
            colorManager.updateSelectionUI("accent", this.currentAccent, false);
            colorManager.syncPickers(this.currentAccent, this.currentBg);
            return;
        }

        if (recordHistory) {
            this._history.remember("accent", this.currentAccent, hex);
        }

        this.currentAccent = hex;
        saveThemeAccent(hex);

        applyAccentVars({
            hex,
            rootEl: document.documentElement,
            hexToHSL,
        });

        emitAppEvent(APP_EVENTS.ACCENT_COLOR_CHANGED);

        colorManager.updateSelectionUI("accent", hex, doScroll);
        colorManager.syncPickers(this.currentAccent, this.currentBg);
    },

    /**
     * @param {string} hex
     * @param {boolean} [doScroll=true]
     * @param {ThemeColorSetOptions} [options]
     */
    setBgColor(hex, doScroll = true, options = {}) {
        const { recordHistory = true, skipProCheck = false } = options;

        if (
            !skipProCheck &&
            hex !== "default" &&
            !appProManager.canUse("accent_bg")
        ) {
            notifyProBlocked(t, "accent_bg");
            colorManager.updateSelectionUI("bg", this.currentBg, false);
            colorManager.syncPickers(this.currentAccent, this.currentBg);
            return;
        }

        if (recordHistory) {
            this._history.remember("bg", this.currentBg, hex);
        }

        this.currentBg = hex;
        saveThemeBg(hex);

        this.applyBgTheme(hex);

        this.setColor(this.currentAccent, false, {
            recordHistory: false,
            skipProCheck: true,
        });

        colorManager.updateSelectionUI("bg", hex, doScroll);
        colorManager.syncPickers(this.currentAccent, this.currentBg);
    },

    applyBgTheme(hex) {
        applyBgThemeVars({
            hex,
            uiSettingsManager,
            hexToRGB,
            hexToHSL,
            getLuminance,
        });

        this.applyMetaThemeColor();
    },

    applyMetaThemeColor() {
        const root = document.documentElement;
        const cssBg = getComputedStyle(root).getPropertyValue("--bg-color").trim();
        const fallback = root.classList.contains("dark") ? "#000000" : "#f3f4f6";
        const color = cssBg || fallback;

        document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
            meta.setAttribute("content", color);
        });
    },

    syncSliderUIs() {
        uiSettingsManager.syncSliderUIs();
    },
};