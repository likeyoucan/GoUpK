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
import { onAppEvent } from "./events/app-events.js?v=VERSION";

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

import {
  getThemeSnapshot,
  getAccentSnapshot,
  buildSignature,
  buildForegroundOptions,
} from "./foreground/fg-notification.js?v=VERSION";

const FG_ID = 101;
const ACTION_TOGGLE = 1;
const POLL_MS = 400;
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
  unsubs: [],
};

function fgDebug(...args) {
  try {
    if (localStorage.getItem("fg-debug") === "true") {
      console.log("[fg]", ...args);
    }
  } catch {}
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

async function stopForeground() {
  stopPolling();

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

  cancelPendingStop();

  if (state.mode === "stopwatch") {
    sw.toggle();
    await syncNotification({ reason: "button_toggle_stopwatch" });
    return;
  }

  if (state.mode === "timer") {
    // Optimistic update first, then final update after toggle promise resolves.
    const p = tm.toggle();
    await syncNotification({ reason: "button_toggle_timer_optimistic" });
    await p;
    await syncNotification({ reason: "button_toggle_timer_final" });
    return;
  }

  if (state.mode === "tabata") {
    tb.toggle();
    await syncNotification({ reason: "button_toggle_tabata" });
  }
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

  // Keep polling active while any foreground state exists.
  startPolling();

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
  const { accentColor, onAccentColor, accentToken } = getAccentSnapshot();

  const signature = buildSignature(state, payload, {
    themeToken,
    accentToken,
  });

  if (signature === lastSignature) return;

  const toggleTitle = state.running ? "⏸" : "▶";
  const options = buildForegroundOptions({
    fgId: FG_ID,
    channelId: CHANNEL.id,
    smallIcon: SMALL_ICON,
    payload,
    isDarkTheme,
    toggleTitle,
    accentColor,
    onAccentColor,
  });

  fgDebug("sync notification", {
    reason,
    mode: state.mode,
    running: state.running,
    payload,
    isDarkTheme,
    accentColor,
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

function bindDocumentEvents() {
  listeners.unsubs.push(
    onAppEvent(APP_EVENTS.ACTIVE_TIMER_CHANGED, () =>
      syncNotification({ reason: "active_timer_changed" }),
    ),
  );

  listeners.unsubs.push(
    onAppEvent(APP_EVENTS.TIMER_STARTED, () =>
      syncNotification({ reason: "timer_started_event" }),
    ),
  );

  listeners.unsubs.push(
    onAppEvent(APP_EVENTS.MS_CHANGED, () =>
      syncNotification({ reason: "ms_changed" }),
    ),
  );

  listeners.unsubs.push(
    onAppEvent(APP_EVENTS.LANGUAGE_CHANGED, () =>
      syncNotification({ reason: "language_changed" }),
    ),
  );

  listeners.unsubs.push(
    onAppEvent(APP_EVENTS.FOREGROUND_NOTIFICATION_SETTING_CHANGED, () =>
      syncNotification({ reason: "foreground_setting_changed" }),
    ),
  );

  listeners.unsubs.push(
    onAppEvent(APP_EVENTS.ACCENT_COLOR_CHANGED, () =>
      syncNotification({ reason: "accent_changed" }),
    ),
  );

  listeners.unsubs.push(
    onAppEvent(APP_EVENTS.ADAPTIVE_BG_CHANGED, () =>
      syncNotification({ reason: "adaptive_bg_changed" }),
    ),
  );
}

function unbindDocumentEvents() {
  listeners.unsubs.forEach((off) => {
    try {
      off?.();
    } catch (err) {
      console.error("[fg.unbind]", err);
    }
  });
  listeners.unsubs = [];
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

    scheduleForegroundStop();
    await syncNotification({ reason: "visibility_visible" });
    releaseWakeLock();
    startPolling();
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

  const forceResyncBurst = () => {
    // Fast burst for devices that delay JS timers right after wake.
    syncNotification({ reason: "wake_from_notif_button_0" });
    setTimeout(
      () => syncNotification({ reason: "wake_from_notif_button_1" }),
      80,
    );
    setTimeout(
      () => syncNotification({ reason: "wake_from_notif_button_2" }),
      220,
    );
  };

  const onWindowFocus = () => {
    forceResyncBurst();
  };

  const onVisibilityResync = () => {
    if (document.visibilityState === "visible") {
      forceResyncBurst();
    }
  };

  window.addEventListener("focus", onWindowFocus, { passive: true });
  document.addEventListener("visibilitychange", onVisibilityResync);

  listeners.unsubs.push(() =>
    window.removeEventListener("focus", onWindowFocus),
  );
  listeners.unsubs.push(() =>
    document.removeEventListener("visibilitychange", onVisibilityResync),
  );

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

      scheduleForegroundStop();
      await syncNotification({ reason: "appstate_foreground" });
      releaseWakeLock();
      startPolling();
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
        // Extra resync after action to avoid stale banner state.
        syncNotification({ reason: "button_clicked_post_toggle_0" });
        setTimeout(
          () => syncNotification({ reason: "button_clicked_post_toggle_1" }),
          90,
        );
      }
    }),
  );

  rememberHandle(
    plugins.FgService.addListener?.("notificationTapped", () => {
      plugins.FgService.moveToForeground?.().catch(() => {});
    }),
  );

  await syncNotification({ reason: "init" });
  startPolling();
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
