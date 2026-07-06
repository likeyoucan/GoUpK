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
import { store } from "./store.js?v=VERSION";
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

let lastHandledActionAt = 0;

let pendingReadInFlight = false;
let pendingRerunRequested = false;
let lastPendingEventAt = 0;

let runtimePullInFlight = false;
let runtimePullQueued = false;

// Serialized notification sync queue.
let syncInFlight = false;
let syncQueued = false;
let lastSyncAt = 0;
const MIN_SYNC_GAP_MS = 120;

// Extra dedupe for repeated reasons in short bursts.
let lastSyncReason = "";
let lastSyncReasonAt = 0;
const SAME_REASON_GAP_MS = 80;

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

function getTimerRemainingMs() {
  if (tm.isRunning) return Math.max(0, (tm.targetEpochMs || 0) - Date.now());
  return Math.max(0, tm.remainingAtPause || tm.timeRemainingMs || 0);
}

function getTabataRemainingMs() {
  if (tb.status === "STOPPED") return 0;
  if (tb.paused) return Math.max(0, tb.remainingAtPause || 0);
  return Math.max(0, (tb.phaseEndTime || 0) - Date.now());
}

function getCurrentForegroundState() {
  return getForegroundState({
    sw,
    tm,
    tb,
    activeView: navigation.activeView,
  });
}

function getFallbackForegroundState() {
  if (sw.isRunning) return { mode: "stopwatch", running: true, metaKey: "" };
  if (!sw.isRunning && sw.elapsedTime > 0) {
    return { mode: "stopwatch", running: false, metaKey: "" };
  }

  if (tm.isRunning) {
    const rem = getTimerRemainingMs();
    const total = tm.initialDurationMs || tm.totalDuration || 0;
    return {
      mode: "timer",
      running: true,
      metaKey: `${total}|${Math.floor(rem / 1000)}|r`,
    };
  }

  if (tm.isPaused) {
    const rem = getTimerRemainingMs();
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
    const rem = getTabataRemainingMs();
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

function buildRuntimeStateFromJs(payload, state, theme, accent) {
  return {
    mode: state?.mode || "none",
    running: !!state?.running,
    updatedAt: Date.now(),

    swElapsedMs: Math.max(0, sw.elapsedTime || 0),

    tmRemainingMs: getTimerRemainingMs(),
    tmTotalMs: tm.initialDurationMs || tm.totalDuration || 0,

    tbStatus: tb.status || "STOPPED",
    tbRound: tb.currentRound || 1,
    tbRounds: tb.rounds || 1,
    tbWorkoutName:
      $("tb-runningWorkoutName")?.textContent?.trim() ||
      $("tb-activeName")?.textContent?.trim() ||
      t("tabata"),
    tbRemainingMs: getTabataRemainingMs(),

    notifTitle: payload?.title || "Stopwatch",
    notifBody: payload?.body || "00:00",

    channelId: CHANNEL.id,
    isDarkTheme: !!theme?.isDarkTheme,
    accentColor: accent?.accentColor || "#3399ff",
    onAccentColor: accent?.onAccentColor || "#ffffff",
  };
}

async function pushRuntimeStateToNative(reason = "unknown") {
  const plugins = getPlugins();
  const api = plugins?.FgService?.setRuntimeState;
  if (typeof api !== "function") return;

  if (document.visibilityState !== "visible") return;

  const state = getResolvedForegroundState();
  if (!state) return;

  const payload = buildForegroundPayload({
    state,
    sw,
    tm,
    tb,
    t,
    $,
    formatTime,
  });

  const theme = getThemeSnapshot();
  const accent = getAccentSnapshot();

  const runtimeState = buildRuntimeStateFromJs(payload, state, theme, accent);

  try {
    await api({ runtimeState });
    fgDebug("setRuntimeState ok", { reason, runtimeState });
  } catch (err) {
    console.warn("[fg] setRuntimeState failed", err);
  }
}

function applyStopwatchRuntimeToJs(nativeState) {
  const elapsed = Math.max(0, Number(nativeState.swElapsedMs) || 0);

  sw.elapsedTime = elapsed;
  sw.startEpochMs = Date.now() - elapsed;
  sw.pauseTime = Date.now();

  if (nativeState.running) {
    sw.stopwatchEngine?.start?.(elapsed);
    sw.isRunning = true;
    sw.els.status?.classList.add("hidden");
    sw.els.display?.classList.remove("is-go");
    sw.els.lapBtn?.classList.remove("hidden");
    if (sw.els.lapBtn) {
      sw.els.lapBtn.classList.remove("main_btn_red");
      sw.els.lapBtn.classList.add("main_btn");
      sw.els.lapBtn.textContent = t("lap");
    }

    requestWakeLock();
    sw.bgWorker?.postMessage?.({ command: "start" });
    sw.lastRender = 0;
    sw.tick?.();
  } else {
    sw.stopwatchEngine?.setElapsed?.(elapsed);
    sw.stopwatchEngine?.pause?.();
    sw.isRunning = false;

    if (sw.rAF) {
      cancelAnimationFrame(sw.rAF);
      sw.rAF = null;
    }

    sw.bgWorker?.postMessage?.({ command: "stop" });
    releaseWakeLock();

    sw.els.status?.classList.remove("hidden");
    if (sw.els.lapBtn) {
      sw.els.lapBtn.classList.remove("main_btn");
      sw.els.lapBtn.classList.add("main_btn_red");
      sw.els.lapBtn.classList.remove("hidden");
      sw.els.lapBtn.textContent = t("reset");
    }
    sw.updateDisplay?.();
  }

  sw.updateSaveButtonVisibility?.();
}

function applyTimerRuntimeToJs(nativeState) {
  const rem = Math.max(0, Number(nativeState.tmRemainingMs) || 0);
  const total = Math.max(0, Number(nativeState.tmTotalMs) || 0);

  tm.totalDuration = total;
  tm.initialDurationMs = total;
  tm.timeRemainingMs = rem;
  tm.remainingAtPause = rem;
  tm.targetEpochMs = 0;

  if (nativeState.running && rem > 0) {
    const snap = tm.countdownEngine?.start?.(Math.max(1, rem));
    if (snap?.targetEpochMs) tm.targetEpochMs = snap.targetEpochMs;

    tm.isRunning = true;
    tm.isPaused = false;
    tm.isFinished = false;
    tm.lastUiRem = rem;
    tm._lastUiPaintTs = 0;

    requestWakeLock();
    tm.bgWorker?.postMessage?.({ command: "start", time: rem });
    tm.startUiLoop?.();
  } else {
    tm.countdownEngine?.setPausedRemaining?.(rem);

    tm.isRunning = false;
    tm.isPaused = rem > 0;
    tm.isFinished = rem <= 0;

    tm.stopUiLoop?.();
    tm.bgWorker?.postMessage?.({ command: "stop" });
    releaseWakeLock();
  }

  tm.updateDisplay?.(rem);
  tm.updateAdjustButtons?.();
  tm.updateUIState?.();
}

function applyTabataRuntimeToJs(nativeState) {
  const rem = Math.max(0, Number(nativeState.tbRemainingMs) || 0);

  tb.status = nativeState.tbStatus || "STOPPED";
  tb.currentRound = Math.max(1, Number(nativeState.tbRound) || 1);
  tb.rounds = Math.max(1, Number(nativeState.tbRounds) || tb.rounds || 1);
  tb.phaseDuration = Math.max(0, rem);

  if (nativeState.running && tb.status !== "STOPPED") {
    tb.paused = false;
    tb.completionHandled = false;
    tb.remainingAtPause = 0;
    tb.phaseEndTime = Date.now() + rem;
    tb.lastRender = 0;

    requestWakeLock();
    tb.bgWorker?.postMessage?.({ command: "start" });

    tb.updatePhaseStyles?.();
    tb.tick?.();
  } else {
    tb.paused = tb.status !== "STOPPED";
    tb.remainingAtPause = rem;
    tb.phaseEndTime = 0;

    if (tb.rAF) {
      cancelAnimationFrame(tb.rAF);
      tb.rAF = null;
    }

    tb.bgWorker?.postMessage?.({ command: "stop" });
    releaseWakeLock();

    tb.updatePhaseStyles?.();
    if (tb.status !== "STOPPED") {
      tb.render?.(rem);
    }
  }
}

async function pullRuntimeStateIntoJs(reason = "unknown") {
  const plugins = getPlugins();
  const api = plugins?.FgService?.getRuntimeState;
  if (typeof api !== "function") return false;

  if (runtimePullInFlight) {
    runtimePullQueued = true;
    return false;
  }

  runtimePullInFlight = true;
  try {
    do {
      runtimePullQueued = false;

      let nativeState;
      try {
        nativeState = await api();
      } catch (err) {
        console.warn("[fg] getRuntimeState failed", err);
        return false;
      }

      if (!nativeState || typeof nativeState !== "object") return false;

      const mode = String(nativeState.mode || "none");
      const running = !!nativeState.running;

      fgDebug("pull runtime state", { reason, mode, running, nativeState });

      if (mode === "stopwatch") {
        applyStopwatchRuntimeToJs(nativeState);
        store.setActiveTimer("stopwatch");
      } else if (mode === "timer") {
        applyTimerRuntimeToJs(nativeState);
        store.setActiveTimer("timer");
      } else if (mode === "tabata") {
        applyTabataRuntimeToJs(nativeState);
        store.setActiveTimer("tabata");
      } else {
        store.clearActiveTimer();
      }
    } while (runtimePullQueued);

    return true;
  } finally {
    runtimePullInFlight = false;
  }
}

async function processButtonAction(
  buttonId,
  eventAt = Date.now(),
  source = "unknown",
) {
  const id = Number(buttonId);
  const ts = Number(eventAt) || Date.now();

  if (!id) return;
  if (ts <= lastHandledActionAt) {
    fgDebug("skip duplicated action", { id, ts, source, lastHandledActionAt });
    return;
  }

  lastHandledActionAt = ts;
  fgDebug("process action", { id, ts, source });

  if (id === ACTION_TOGGLE) {
    // Основной путь: native already toggled. JS only pulls runtime.
    await pullRuntimeStateIntoJs(`button:${source}`);
    await syncNotification({
      reason: "button_toggle_synced_from_native",
      force: true,
    });
  }
}

async function drainPendingButtonActions(reason = "unknown") {
  const plugins = getPlugins();
  const api = plugins?.FgService?.readAndClearPendingButton;
  if (typeof api !== "function") return;

  if (pendingReadInFlight) {
    pendingRerunRequested = true;
    fgDebug("pending read already in flight; rerun requested", { reason });
    return;
  }

  pendingReadInFlight = true;
  try {
    do {
      pendingRerunRequested = false;

      let pending = null;
      try {
        pending = await api();
      } catch (err) {
        console.warn("[fg] readAndClearPendingButton failed", err);
        break;
      }

      if (!pending?.hasPending) continue;

      const eventAt = Number(pending.eventAt) || 0;
      if (eventAt > 0 && eventAt <= lastPendingEventAt) {
        fgDebug("skip stale pending action", {
          reason,
          eventAt,
          lastPendingEventAt,
        });
        continue;
      }

      if (eventAt > 0) {
        lastPendingEventAt = eventAt;
      }

      await processButtonAction(
        pending.buttonId,
        pending.eventAt,
        `pending:${reason}`,
      );
    } while (pendingRerunRequested);
  } finally {
    pendingReadInFlight = false;
  }
}

async function syncNotificationInternal({
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
  const { accentColor, onAccentColor, accentToken } = getAccentSnapshot();

  const signature = buildSignature(state, payload, { themeToken, accentToken });
  if (!force && signature === lastSignature) return;

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
    onAccentColor,
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

export async function syncNotification({
  reason = "unknown",
  force = false,
} = {}) {
  if (syncInFlight) {
    syncQueued = true;
    return;
  }

  syncInFlight = true;
  try {
    do {
      syncQueued = false;

      const now = Date.now();

      if (
        !force &&
        reason === lastSyncReason &&
        now - lastSyncReasonAt < SAME_REASON_GAP_MS
      ) {
        continue;
      }

      if (!force && now - lastSyncAt < MIN_SYNC_GAP_MS) {
        continue;
      }

      lastSyncAt = now;
      lastSyncReason = reason;
      lastSyncReasonAt = now;

      await syncNotificationInternal({ reason, force });
    } while (syncQueued);
  } finally {
    syncInFlight = false;
  }
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
    onAppEvent(APP_EVENTS.ACTIVE_TIMER_CHANGED, async () => {
      await pushRuntimeStateToNative("active_timer_changed");
      await syncNotification({ reason: "active_timer_changed" });
    }),
  );

  listeners.unsubs.push(
    onAppEvent(APP_EVENTS.TIMER_STARTED, async () => {
      await pushRuntimeStateToNative("timer_started_event");
      await syncNotification({ reason: "timer_started_event" });
    }),
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

async function handleAppBecameForeground(reason) {
  stopPolling();

  await pullRuntimeStateIntoJs(`${reason}:pull_runtime`);
  await drainPendingButtonActions(`${reason}:pending`);

  scheduleForegroundStop();
  await syncNotification({ reason, force: true });
  releaseWakeLock();
}

async function handleAppBecameBackground(reason) {
  cancelPendingStop();
  sm.unlock();
  requestWakeLock();
  await ensurePermissionIfNeeded(true);
  await syncNotification({ reason });
  startPolling();
}

function bindVisibilityFallback() {
  if (listeners.appVisibility) return;

  listeners.appVisibility = async () => {
    const isActive = document.visibilityState === "visible";

    if (!isActive) {
      await handleAppBecameBackground("visibility_hidden");
      return;
    }

    await handleAppBecameForeground("visibility_visible");
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
        await handleAppBecameBackground("appstate_background");
        return;
      }

      await handleAppBecameForeground("appstate_foreground");
    };

    rememberHandle(
      plugins.App.addListener("appStateChange", listeners.appState),
    );
  }

  rememberHandle(
    plugins.FgService.addListener?.("buttonClicked", async (payload) => {
      const raw = payload?.buttonId ?? payload?.id ?? payload?.actionId;
      const eventAt = payload?.eventAt ?? Date.now();
      await processButtonAction(raw, eventAt, "live");
    }),
  );

  rememberHandle(
    plugins.FgService.addListener?.("notificationTapped", () => {
      plugins.FgService.moveToForeground?.().catch(() => {});
    }),
  );

  await pullRuntimeStateIntoJs("init:pull_runtime");
  await drainPendingButtonActions("init:pending");
  await pushRuntimeStateToNative("init");
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
  lastHandledActionAt = 0;

  pendingReadInFlight = false;
  pendingRerunRequested = false;
  lastPendingEventAt = 0;

  runtimePullInFlight = false;
  runtimePullQueued = false;

  syncInFlight = false;
  syncQueued = false;
  lastSyncAt = 0;
  lastSyncReason = "";
  lastSyncReasonAt = 0;

  isInitialized = false;
}
