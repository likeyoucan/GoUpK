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
  buildSignature,
  buildForegroundOptions,
} from "./foreground/fg-notification.js?v=VERSION";

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

let toggleInFlight = false;

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

function resolveToggleModeFallback() {
  if (sw.isRunning || sw.elapsedTime > 0) return "stopwatch";

  if (
    tm.isRunning ||
    tm.isPaused ||
    (typeof tm.getRemainingTime === "function" && tm.getRemainingTime() > 0)
  ) {
    return "timer";
  }

  if (tb.status !== "STOPPED") return "tabata";

  return null;
}

// Fallback state for cases where primary selector returns null after deep sleep/throttle.
function getFallbackForegroundState() {
  if (sw.isRunning) return { mode: "stopwatch", running: true, metaKey: "" };
  if (!sw.isRunning && sw.elapsedTime > 0) {
    return { mode: "stopwatch", running: false, metaKey: "" };
  }

  if (tm.isRunning) {
    const rem =
      typeof tm.getRemainingTime === "function" ? tm.getRemainingTime() : 0;
    const total = tm.initialDurationMs || tm.totalDuration || 0;
    return {
      mode: "timer",
      running: true,
      metaKey: `${total}|${Math.floor(rem / 1000)}|r`,
    };
  }

  if (tm.isPaused) {
    const rem =
      typeof tm.getRemainingTime === "function" ? tm.getRemainingTime() : 0;
    const total = tm.initialDurationMs || tm.totalDuration || 0;
    if (rem > 0) {
      return {
        mode: "timer",
        running: false,
        metaKey: `${total}|${Math.floor(rem / 1000)}|p`,
      };
    }
  }

  if (tb.status !== "STOPPED") {
    const rem =
      tb.status !== "STOPPED"
        ? Math.max(
            0,
            (tb.paused ? tb.remainingAtPause : tb.phaseEndTime - Date.now()) ||
              0,
          )
        : 0;

    return {
      mode: "tabata",
      running: !tb.paused,
      metaKey: `${tb.selectedId || "na"}|${tb.currentRound || 0}|${tb.rounds || 0}|${tb.status || "STOPPED"}|${Math.floor(rem / 1000)}`,
    };
  }

  return null;
}

function getResolvedForegroundState() {
  return getCurrentForegroundState() || getFallbackForegroundState();
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

    const state = getResolvedForegroundState();
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
  if (toggleInFlight) return;
  toggleInFlight = true;

  try {
    const state = getResolvedForegroundState();
    const mode = state?.mode || resolveToggleModeFallback();

    if (!mode) {
      await syncNotification({
        reason: "button_toggle_no_mode",
        force: true,
      });
      return;
    }

    if (mode === "stopwatch") {
      sw.toggle();
    } else if (mode === "timer") {
      await tm.toggle();
    } else if (mode === "tabata") {
      tb.toggle();
    }

    // Без recreate, чтобы не мигало. Просто форсируем update несколько раз.
    await syncNotification({
      reason: "button_toggle_immediate",
      force: true,
    });

    setTimeout(() => {
      syncNotification({
        reason: "button_toggle_settle_1",
        force: true,
      });
    }, 180);

    setTimeout(() => {
      syncNotification({
        reason: "button_toggle_settle_2",
        force: true,
      });
    }, 700);
  } finally {
    toggleInFlight = false;
  }
}

export async function syncNotification({
  reason = "unknown",
  force = false,
} = {}) {
  const plugins = getPlugins();
  if (!plugins) return;

  if (!shouldShowForegroundBanner()) {
    await stopForeground();
    return;
  }

  const state = getResolvedForegroundState();
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

  if (!force && signature === lastSignature) return;

  const toggleTitle = state.running ? "⏸" : "▶";
  const options = buildForegroundOptions({
    fgId: FG_ID,
    channelId: CHANNEL.id,
    smallIcon: SMALL_ICON,
    payload,
    isDarkTheme,
    toggleTitle,
  });

  fgDebug("sync notification", {
    reason,
    mode: state.mode,
    running: state.running,
    payload,
    isDarkTheme,
    force,
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
      // Если update у плагина нестабилен в deep sleep — мягкий fallback на restart.
      console.warn("[fg] update failed, fallback to restart", err);

      await plugins.stop?.().catch(() => {});
      isForegroundShown = false;

      try {
        await plugins.start?.(options);
        isForegroundShown = true;
        lastSignature = signature;
      } catch (startErr) {
        console.warn("[fg] restart start failed", startErr);
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

    stopPolling();
    scheduleForegroundStop();
    await syncNotification({ reason: "visibility_visible", force: true });
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
      await syncNotification({ reason: "appstate_foreground", force: true });
      releaseWakeLock();
    };

    rememberHandle(
      plugins.App.addListener("appStateChange", listeners.appState),
    );
  }

  rememberHandle(
    plugins.FgService.addListener?.("buttonClicked", async (payload) => {
      const raw = payload?.buttonId ?? payload?.id ?? payload?.actionId;
      const id = Number(raw);

      if (id === ACTION_TOGGLE || String(raw) === String(ACTION_TOGGLE)) {
        await handleNotificationToggle();
      }
    }),
  );

  rememberHandle(
    plugins.FgService.addListener?.("notificationTapped", () => {
      plugins.FgService.moveToForeground?.().catch(() => {});
    }),
  );

  await syncNotification({ reason: "init", force: true });
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
  toggleInFlight = false;

  isInitialized = false;
}
