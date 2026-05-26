// Файл: www/js/foreground-service.js

import {
  $,
  formatTime,
  requestWakeLock,
  releaseWakeLock,
} from "./utils.js?v=VERSION";
import { sw } from "./stopwatch.js?v=VERSION";
import { tm } from "./timer.js?v=VERSION";
import { tb } from "./tabata.js?v=VERSION";
import { navigation } from "./navigation.js?v=VERSION";
import { uiSettingsManager } from "./ui-settings.js?v=VERSION";
import { sm } from "./sound.js?v=VERSION";
import { t } from "./i18n.js?v=VERSION";
import { APP_EVENTS } from "./constants/events.js?v=VERSION";

import {
  isNative,
  getPlugins,
  ensureNotificationPermission,
  ensureNotificationChannel,
  rememberHandle,
  removeAllHandles,
  resetPlatformCache,
} from "./foreground/fg-platform.js?v=VERSION";

import {
  getForegroundState,
  buildForegroundPayload,
} from "./foreground/fg-state.js?v=VERSION";

const FG_ID = 101;
const ACTION_TOGGLE = 1;
const POLL_MS = 700;
const FOREGROUND_STOP_DEBOUNCE_MS = 1200;

const CHANNEL = {
  id: "stopwatch_channel_silent_v2",
  name: "Stopwatch Pro",
  description: "Background stopwatch, timer and tabata controls",
  importance: 2,
};

const SMALL_ICON = "ic_stat_name";

let isInitialized = false;
let poller = null;
let lastSignature = "";
let isForegroundShown = false;
let pendingStopTimer = null;

let permissionGranted = null;
let permissionCheckedAt = 0;
const PERMISSION_CHECK_TTL_MS = 15000;

const listeners = {
  appState: null,
  appVisibility: null,
  activeTimerChanged: null,
  timerStarted: null,
  msChanged: null,
  languageChanged: null,
  foregroundSettingChanged: null,
};

function fgDebug(...args) {
  try {
    if (localStorage.getItem("fg-debug") === "true") {
      console.log("[fg]", ...args);
    }
  } catch {}
}

function getThemeSnapshot() {
  const isDarkTheme = document.documentElement.classList.contains("dark");
  return {
    isDarkTheme,
    themeToken: isDarkTheme ? "dark" : "light",
  };
}

function buildSignature(state, payload, themeToken) {
  return [
    state.mode,
    state.running ? "1" : "0",
    state.metaKey || "",
    payload.title,
    payload.body,
    themeToken,
  ].join("|");
}

function getCurrentForegroundState() {
  return getForegroundState({
    sw,
    tm,
    tb,
    activeView: navigation.activeView,
  });
}

function shouldShowForegroundBanner() {
  return !!uiSettingsManager.showForegroundBanner;
}

function cancelPendingStop() {
  if (!pendingStopTimer) return;
  clearTimeout(pendingStopTimer);
  pendingStopTimer = null;
  fgDebug("pending stop canceled");
}

function scheduleForegroundStop(delay = FOREGROUND_STOP_DEBOUNCE_MS) {
  cancelPendingStop();

  pendingStopTimer = setTimeout(async () => {
    pendingStopTimer = null;

    const state = getCurrentForegroundState();
    if (!state) {
      await stopForeground();
      return;
    }

    await syncNotification({ reason: "stop_debounce_state_active" });
  }, delay);

  fgDebug("pending stop scheduled", { delay });
}

async function ensurePermissionIfNeeded(force = false) {
  const plugins = getPlugins();
  if (!plugins) return false;

  const now = Date.now();
  if (
    !force &&
    permissionGranted !== null &&
    now - permissionCheckedAt < PERMISSION_CHECK_TTL_MS
  ) {
    return permissionGranted;
  }

  const granted = await ensureNotificationPermission(plugins.FgService);
  permissionGranted = !!granted;
  permissionCheckedAt = now;

  fgDebug("permission state", { granted: permissionGranted, force });
  return permissionGranted;
}

async function stopForeground() {
  const plugins = getPlugins();
  if (!plugins || !isForegroundShown) return;

  await plugins.stop?.().catch((err) => {
    console.warn("[fg] stop failed", err);
  });

  isForegroundShown = false;
  lastSignature = "";
  fgDebug("foreground stopped");
}

async function handleNotificationToggle() {
  const state = getCurrentForegroundState();
  if (!state) return;

  if (state.mode === "stopwatch") {
    sw.toggle();
  } else if (state.mode === "timer") {
    await tm.toggle();
  } else if (state.mode === "tabata") {
    tb.toggle();
  }

  setTimeout(() => {
    syncNotification({ reason: "button_toggle" });
  }, 80);
}

export async function syncNotification({ reason = "unknown" } = {}) {
  const plugins = getPlugins();
  if (!plugins) return;

  if (!shouldShowForegroundBanner()) {
    await stopForeground();
    return;
  }

  const state = getCurrentForegroundState();
  if (!state) {
    await stopForeground();
    return;
  }

  const granted = await ensurePermissionIfNeeded(false);
  if (!granted) {
    await stopForeground();
    return;
  }

  const payload = buildForegroundPayload({
    state,
    sw,
    tm,
    tb,
    t,
    $,
    formatTime,
  });

  const { isDarkTheme, themeToken } = getThemeSnapshot();
  const signature = buildSignature(state, payload, themeToken);
  if (signature === lastSignature) return;

  const toggleTitle = state.running ? "⏸" : "▶";

  const options = {
    id: FG_ID,
    title: payload.title,
    body: payload.body,
    smallIcon: SMALL_ICON,
    notificationChannelId: CHANNEL.id,
    silent: true,
    serviceType: "specialUse",
    buttons: [{ id: ACTION_TOGGLE, title: toggleTitle }],
    isDarkTheme,
  };

  fgDebug("sync notification", {
    reason,
    mode: state.mode,
    running: state.running,
    payload,
    isDarkTheme,
  });

  if (!isForegroundShown) {
    try {
      await plugins.start?.(options);
      isForegroundShown = true;
      lastSignature = signature;
      return;
    } catch (err) {
      console.warn("[fg] start failed", err);
      isForegroundShown = false;
      return;
    }
  }

  await plugins
    .update?.(options)
    .then(() => {
      lastSignature = signature;
    })
    .catch(async (err) => {
      console.warn("[fg] update failed, fallback to start", err);

      try {
        await plugins.start?.(options);
        isForegroundShown = true;
        lastSignature = signature;
      } catch (startErr) {
        console.warn("[fg] fallback start failed", startErr);
        isForegroundShown = false;
      }
    });
}

function startPolling() {
  if (poller) return;
  poller = setInterval(() => {
    syncNotification({ reason: "poll" });
  }, POLL_MS);
}

function stopPolling() {
  if (!poller) return;
  clearInterval(poller);
  poller = null;
}

function bindDocumentEvents() {
  listeners.activeTimerChanged = () =>
    syncNotification({ reason: "active_timer_changed" });

  listeners.timerStarted = () =>
    syncNotification({ reason: "timer_started_event" });

  listeners.msChanged = () => syncNotification({ reason: "ms_changed" });
  listeners.languageChanged = () =>
    syncNotification({ reason: "language_changed" });
  listeners.foregroundSettingChanged = () =>
    syncNotification({ reason: "foreground_setting_changed" });

  document.addEventListener(
    APP_EVENTS.ACTIVE_TIMER_CHANGED,
    listeners.activeTimerChanged,
  );
  document.addEventListener(APP_EVENTS.TIMER_STARTED, listeners.timerStarted);
  document.addEventListener(APP_EVENTS.MS_CHANGED, listeners.msChanged);
  document.addEventListener(
    APP_EVENTS.LANGUAGE_CHANGED,
    listeners.languageChanged,
  );
  document.addEventListener(
    APP_EVENTS.FOREGROUND_NOTIFICATION_SETTING_CHANGED,
    listeners.foregroundSettingChanged,
  );
}

function unbindDocumentEvents() {
  if (listeners.activeTimerChanged) {
    document.removeEventListener(
      APP_EVENTS.ACTIVE_TIMER_CHANGED,
      listeners.activeTimerChanged,
    );
  }
  if (listeners.timerStarted) {
    document.removeEventListener(
      APP_EVENTS.TIMER_STARTED,
      listeners.timerStarted,
    );
  }
  if (listeners.msChanged) {
    document.removeEventListener(APP_EVENTS.MS_CHANGED, listeners.msChanged);
  }
  if (listeners.languageChanged) {
    document.removeEventListener(
      APP_EVENTS.LANGUAGE_CHANGED,
      listeners.languageChanged,
    );
  }
  if (listeners.foregroundSettingChanged) {
    document.removeEventListener(
      APP_EVENTS.FOREGROUND_NOTIFICATION_SETTING_CHANGED,
      listeners.foregroundSettingChanged,
    );
  }

  listeners.activeTimerChanged = null;
  listeners.timerStarted = null;
  listeners.msChanged = null;
  listeners.languageChanged = null;
  listeners.foregroundSettingChanged = null;
}

function bindVisibilityFallback() {
  if (listeners.appVisibility) return;

  listeners.appVisibility = async () => {
    const isActive = document.visibilityState === "visible";

    if (!isActive) {
      cancelPendingStop();
      sm.unlock();
      requestWakeLock();
      await ensurePermissionIfNeeded(true);
      await syncNotification({ reason: "visibility_hidden" });
      startPolling();
      return;
    }

    stopPolling();
    scheduleForegroundStop();
    await syncNotification({ reason: "visibility_visible" });
    releaseWakeLock();
  };

  document.addEventListener("visibilitychange", listeners.appVisibility);
}

export async function initForegroundService() {
  if (isInitialized) return;
  if (!isNative()) return;

  const plugins = getPlugins();
  if (!plugins || !plugins.start || !plugins.stop) {
    console.warn("[fg] Foreground service plugin not available");
    return;
  }

  isInitialized = true;

  await plugins.FgService?.deleteNotificationChannel?.({
    id: "stopwatch_channel",
  }).catch(() => {});

  const permissionOk = await ensurePermissionIfNeeded(true);
  await ensureNotificationChannel(plugins.FgService, CHANNEL);

  if (!permissionOk) {
    console.warn("[fg] notification permission denied. Foreground disabled.");
    return;
  }

  bindDocumentEvents();
  bindVisibilityFallback();

  if (plugins.App?.addListener) {
    listeners.appState = async ({ isActive }) => {
      if (!isActive) {
        cancelPendingStop();
        sm.unlock();
        requestWakeLock();
        await ensurePermissionIfNeeded(true);
        await syncNotification({ reason: "appstate_background" });
        startPolling();
        return;
      }

      stopPolling();
      scheduleForegroundStop();
      await syncNotification({ reason: "appstate_foreground" });
      releaseWakeLock();
    };

    rememberHandle(
      plugins.App.addListener("appStateChange", listeners.appState),
    );
  }

  rememberHandle(
    plugins.FgService.addListener?.("buttonClicked", async ({ buttonId }) => {
      const id = Number(buttonId);
      if (id === ACTION_TOGGLE) {
        await handleNotificationToggle();
      }
    }),
  );

  rememberHandle(
    plugins.FgService.addListener?.("notificationTapped", () => {
      plugins.FgService.moveToForeground?.().catch(() => {});
    }),
  );

  await syncNotification({ reason: "init" });
}

export async function destroyForegroundService() {
  if (!isInitialized) return;

  cancelPendingStop();
  stopPolling();
  unbindDocumentEvents();
  await stopForeground();

  if (listeners.appVisibility) {
    document.removeEventListener("visibilitychange", listeners.appVisibility);
    listeners.appVisibility = null;
  }

  await removeAllHandles();
  resetPlatformCache();

  permissionGranted = null;
  permissionCheckedAt = 0;

  isInitialized = false;
}
