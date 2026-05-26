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
const ACTION_STOP = 2;
const POLL_MS = 700;

const CHANNEL = {
  id: "stopwatch_channel_silent_v2",
  name: "Stopwatch Pro",
  description: "Background stopwatch, timer and tabata controls",
  importance: 2,
};

const SMALL_ICON = "ic_stat_name";

let isInitialized = false;
let appIsActive = true;
let poller = null;
let lastSignature = "";
let isForegroundShown = false;

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

function buildSignature(state, payload) {
  return [
    state.mode,
    state.running ? "1" : "0",
    state.metaKey || "",
    payload.title,
    payload.body,
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

  fgDebug("button toggle", state);

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

async function handleNotificationStop() {
  const state = getCurrentForegroundState();
  if (!state) return;

  fgDebug("button stop", state);

  if (state.mode === "stopwatch") {
    if (sw.isRunning) sw.toggle();
    if (sw.elapsedTime > 0) sw.recordLapOrReset();
  } else if (state.mode === "timer") {
    await tm.reset(true);
  } else if (state.mode === "tabata") {
    tb.stop();
  }

  setTimeout(() => {
    syncNotification({ reason: "button_stop" });
  }, 80);
}

export async function syncNotification({ reason = "unknown" } = {}) {
  const plugins = getPlugins();
  if (!plugins) return;

  if (!shouldShowForegroundBanner()) {
    fgDebug("skip sync: banner disabled", { reason });
    await stopForeground();
    return;
  }

  const state = getCurrentForegroundState();
  if (!state) {
    fgDebug("skip sync: no active state", { reason });
    await stopForeground();
    return;
  }

  const granted = await ensurePermissionIfNeeded(false);
  if (!granted) {
    fgDebug("skip sync: permission denied", { reason });
    await stopForeground();
    return;
  }

  const payload = buildForegroundPayload({
    state,
    sw,
    tm,
    tb,
    showMs: uiSettingsManager.showMs,
    t,
    $,
    formatTime,
  });

  const signature = buildSignature(state, payload);
  if (signature === lastSignature) return;

  const toggleTitle = state.running ? "⏸" : "▶";
  const stopTitle = "■";

  const options = {
    id: FG_ID,
    title: payload.title,
    body: payload.body,
    smallIcon: SMALL_ICON,
    notificationChannelId: CHANNEL.id,
    silent: true,
    serviceType: "specialUse",
    buttons: [
      { id: ACTION_TOGGLE, title: toggleTitle },
      { id: ACTION_STOP, title: stopTitle },
    ],
  };

  fgDebug("sync notification", {
    reason,
    appIsActive,
    shown: isForegroundShown,
    mode: state.mode,
    running: state.running,
    title: options.title,
    body: options.body,
  });

  if (!isForegroundShown) {
    try {
      const res = await plugins.start?.(options);
      fgDebug("start result", res);
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
    .then((res) => {
      fgDebug("update result", res);
      lastSignature = signature;
    })
    .catch(async (err) => {
      console.warn("[fg] update failed, fallback to start", err);

      try {
        const res = await plugins.start?.(options);
        fgDebug("fallback start result", res);
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
  fgDebug("polling started");
}

function stopPolling() {
  if (!poller) return;
  clearInterval(poller);
  poller = null;
  fgDebug("polling stopped");
}

function bindDocumentEvents() {
  listeners.activeTimerChanged = () =>
    syncNotification({ reason: "active_timer_changed" });

  // Important: start protection immediately when timer/stopwatch/tabata starts.
  listeners.timerStarted = () =>
    syncNotification({ reason: "timer_started_event" });

  listeners.msChanged = () => syncNotification({ reason: "ms_changed" });
  listeners.languageChanged = () =>
    syncNotification({ reason: "lang_changed" });
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
    appIsActive = isActive;

    fgDebug("visibilitychange", { isActive });

    if (!isActive) {
      sm.unlock();
      requestWakeLock();
      await ensurePermissionIfNeeded(true);
      await syncNotification({ reason: "visibility_hidden" });
      startPolling();
      return;
    }

    stopPolling();
    await syncNotification({ reason: "visibility_visible" });
    releaseWakeLock();
  };

  document.addEventListener("visibilitychange", listeners.appVisibility);
}

export async function initForegroundService() {
  if (isInitialized) return;
  if (!isNative()) return;

  fgDebug("init start", { native: true });

  const plugins = getPlugins();
  fgDebug("plugins resolved", !!plugins);

  if (!plugins || !plugins.start || !plugins.stop) {
    console.warn("[fg] Foreground service plugin not available");
    return;
  }

  isInitialized = true;
  appIsActive = true;

  await plugins.FgService?.deleteNotificationChannel?.({
    id: "stopwatch_channel",
  }).catch(() => {});

  const permissionOk = await ensurePermissionIfNeeded(true);
  const channelOk = await ensureNotificationChannel(plugins.FgService, CHANNEL);
  fgDebug("init checks", { permissionOk, channelOk, hasApp: !!plugins.App });

  if (!permissionOk) {
    console.warn(
      "[fg] notification permission denied. Foreground notification disabled.",
    );
    return;
  }

  bindDocumentEvents();
  bindVisibilityFallback();

  if (plugins.App?.addListener) {
    listeners.appState = async ({ isActive }) => {
      appIsActive = isActive;
      fgDebug("appStateChange", { isActive });

      if (!isActive) {
        sm.unlock();
        requestWakeLock();
        await ensurePermissionIfNeeded(true);
        await syncNotification({ reason: "appstate_background" });
        startPolling();
        return;
      }

      stopPolling();
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
        return;
      }
      if (id === ACTION_STOP) {
        await handleNotificationStop();
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
  appIsActive = true;
  fgDebug("destroyed");
}
