// www/js/foreground-service.js

import {
  $,
  formatTime,
  requestWakeLock,
  releaseWakeLock,
} from "./utils.js?v=VERSION";
import { sw } from "./stopwatch.js?v=VERSION";
import { tm } from "./timer.js?v=VERSION";
import { tb } from "./tabata.js?v=VERSION";
import { store } from "./store.js?v=VERSION";
import { navigation } from "./navigation.js?v=VERSION";
import { uiSettingsManager } from "./ui-settings.js?v=VERSION";
import { sm } from "./sound.js?v=VERSION";
import { t } from "./i18n.js?v=VERSION";

const FG_ID = 101;
const ACTION_TOGGLE = 1;
const POLL_MS = 500;
const CHANNEL_ID = "stopwatch_channel";
const SMALL_ICON = "ic_stat_name";

let isInitialized = false;
let appIsActive = true;
let poller = null;
let lastSignature = "";
let isForegroundShown = false;
let handles = [];
let pluginsRef = null;

const listeners = {
  appState: null,
  activeTimerChanged: null,
  timerStarted: null,
  msChanged: null,
  languageChanged: null,
  foregroundSettingChanged: null,
};

function isNative() {
  return !!(window.Capacitor && window.Capacitor.isNativePlatform());
}

function getPlugins() {
  if (pluginsRef) return pluginsRef;
  if (!isNative()) return null;

  const { App, CapacitorAndroidForegroundService: FgService } =
    window.Capacitor.Plugins || {};
  if (!App || !FgService) return null;

  const start =
    FgService.startForegroundService?.bind(FgService) ??
    FgService.start?.bind(FgService);

  const update =
    FgService.updateForegroundService?.bind(FgService) ??
    FgService.update?.bind(FgService) ??
    start;

  const stop =
    FgService.stopForegroundService?.bind(FgService) ??
    FgService.stop?.bind(FgService);

  pluginsRef = { App, FgService, start, update, stop };
  return pluginsRef;
}

async function ensureNotificationPermission(FgService) {
  if (!FgService?.checkPermissions || !FgService?.requestPermissions) return;
  const status = await FgService.checkPermissions().catch(() => null);
  if (status?.display !== "granted") {
    await FgService.requestPermissions().catch(() => {});
  }
}

async function ensureNotificationChannel(FgService) {
  if (!FgService?.createNotificationChannel) return;
  await FgService.createNotificationChannel({
    id: CHANNEL_ID,
    name: "Stopwatch Pro",
    description: "Background stopwatch, timer and tabata controls",
    importance: 3, // Importance.Default
  }).catch(() => {});
}

function rememberHandle(handlePromise) {
  handlePromise
    ?.then((h) => {
      if (h && typeof h.remove === "function") handles.push(h);
    })
    .catch(() => {});
}

function canResumeStopwatch() {
  return !sw.isRunning && sw.elapsedTime > 0;
}

function canResumeTimer() {
  return tm.isPaused && tm.getRemainingTime() > 0;
}

function canResumeTabata() {
  return tb.status !== "STOPPED" && tb.paused;
}

function isModeAvailable(mode) {
  if (mode === "stopwatch") return sw.isRunning || canResumeStopwatch();
  if (mode === "timer") return tm.isRunning || canResumeTimer();
  if (mode === "tabata") {
    return (tb.status !== "STOPPED" && !tb.paused) || canResumeTabata();
  }
  return false;
}

function getForegroundState() {
  if (sw.isRunning) return { mode: "stopwatch", running: true };
  if (tm.isRunning) return { mode: "timer", running: true };
  if (tb.status !== "STOPPED" && !tb.paused)
    return { mode: "tabata", running: true };

  if (isModeAvailable(navigation.activeView)) {
    return { mode: navigation.activeView, running: false };
  }

  if (canResumeStopwatch()) return { mode: "stopwatch", running: false };
  if (canResumeTimer()) return { mode: "timer", running: false };
  if (canResumeTabata()) return { mode: "tabata", running: false };

  return null;
}

function buildPayload(state) {
  const showMs = uiSettingsManager.showMs;
  const buttonIcon = state.running ? "■" : "▶";

  if (state.mode === "stopwatch") {
    return {
      title: t("stopwatch"),
      body: formatTime(sw.elapsedTime, {
        showMs,
        forceHours: sw.elapsedTime >= 3600000,
      }),
      buttonTitle: buttonIcon,
    };
  }

  if (state.mode === "timer") {
    const rem = tm.getRemainingTime();
    return {
      title: t("timer"),
      body: formatTime(rem, {
        showMs: false,
        forceHours: rem >= 3600000,
      }),
      buttonTitle: buttonIcon,
    };
  }

  const remTb = state.running
    ? Math.max(0, tb.phaseEndTime - performance.now())
    : Math.max(0, tb.remainingAtPause || 0);

  const phaseText = state.running
    ? tb.status === "WORK"
      ? t("work")
      : tb.status === "REST"
        ? t("rest")
        : t("get_ready")
    : t("pause");

  return {
    title: $("tb-activeName")?.textContent || t("tabata"),
    body: `${t("round")} ${tb.currentRound}/${tb.rounds} • ${phaseText}: ${formatTime(remTb, { showMs })}`,
    buttonTitle: buttonIcon,
  };
}

async function stopForeground() {
  const plugins = getPlugins();
  if (!plugins || !isForegroundShown) return;

  await plugins.stop?.().catch(() => {});
  isForegroundShown = false;
  lastSignature = "";
}

export async function syncNotification() {
  const plugins = getPlugins();
  if (!plugins || appIsActive) return;

  if (!uiSettingsManager.showForegroundBanner) {
    await stopForeground();
    return;
  }

  const state = getForegroundState();
  if (!state) {
    await stopForeground();
    return;
  }

  const payload = buildPayload(state);
  const signature = [
    state.mode,
    state.running ? "1" : "0",
    payload.title,
    payload.body,
    payload.buttonTitle,
    uiSettingsManager.showMs ? "ms1" : "ms0",
  ].join("|");

  if (signature === lastSignature) return;
  lastSignature = signature;

  const options = {
    id: FG_ID,
    title: payload.title,
    body: payload.body,
    smallIcon: SMALL_ICON,
    notificationChannelId: CHANNEL_ID,
    silent: true,
    buttons: [{ id: ACTION_TOGGLE, title: payload.buttonTitle }],
  };

  if (!isForegroundShown) {
    await plugins.start?.(options).catch(() => {});
    isForegroundShown = true;
    return;
  }

  await plugins.update?.(options).catch(async () => {
    await plugins.start?.(options).catch(() => {});
    isForegroundShown = true;
  });
}

function startPolling() {
  if (poller) return;
  poller = setInterval(syncNotification, POLL_MS);
}

function stopPolling() {
  if (!poller) return;
  clearInterval(poller);
  poller = null;
}

async function handleNotificationToggle() {
  const state = getForegroundState();
  if (!state) return;

  if (state.mode === "stopwatch") sw.toggle();
  else if (state.mode === "timer") tm.toggle();
  else if (state.mode === "tabata") tb.toggle();

  setTimeout(() => {
    syncNotification();
  }, 80);
}

function bindDocumentEvents() {
  listeners.activeTimerChanged = () => syncNotification();
  listeners.timerStarted = () => syncNotification();
  listeners.msChanged = () => syncNotification();
  listeners.languageChanged = () => syncNotification();
  listeners.foregroundSettingChanged = () => syncNotification();

  document.addEventListener("activeTimerChanged", listeners.activeTimerChanged);
  document.addEventListener("timerStarted", listeners.timerStarted);
  document.addEventListener("msChanged", listeners.msChanged);
  document.addEventListener("languageChanged", listeners.languageChanged);
  document.addEventListener(
    "foregroundNotificationSettingChanged",
    listeners.foregroundSettingChanged,
  );
}

function unbindDocumentEvents() {
  if (listeners.activeTimerChanged) {
    document.removeEventListener(
      "activeTimerChanged",
      listeners.activeTimerChanged,
    );
  }
  if (listeners.timerStarted) {
    document.removeEventListener("timerStarted", listeners.timerStarted);
  }
  if (listeners.msChanged) {
    document.removeEventListener("msChanged", listeners.msChanged);
  }
  if (listeners.languageChanged) {
    document.removeEventListener("languageChanged", listeners.languageChanged);
  }
  if (listeners.foregroundSettingChanged) {
    document.removeEventListener(
      "foregroundNotificationSettingChanged",
      listeners.foregroundSettingChanged,
    );
  }

  listeners.activeTimerChanged = null;
  listeners.timerStarted = null;
  listeners.msChanged = null;
  listeners.languageChanged = null;
  listeners.foregroundSettingChanged = null;
}

export async function initForegroundService() {
  if (isInitialized) return;
  if (!isNative()) return;

  const plugins = getPlugins();
  if (!plugins || !plugins.start || !plugins.stop) return;

  isInitialized = true;
  appIsActive = true;

  await ensureNotificationPermission(plugins.FgService);
  await ensureNotificationChannel(plugins.FgService);

  bindDocumentEvents();

  listeners.appState = async ({ isActive }) => {
    appIsActive = isActive;

    if (!isActive) {
      sm.unlock();
      requestWakeLock();
      await syncNotification();
      startPolling();
      return;
    }

    stopPolling();
    await stopForeground();
    releaseWakeLock();
  };

  rememberHandle(
    plugins.App.addListener?.("appStateChange", listeners.appState),
  );

  rememberHandle(
    plugins.FgService.addListener?.("buttonClicked", async ({ buttonId }) => {
      if (buttonId !== ACTION_TOGGLE) return;
      await handleNotificationToggle();
    }),
  );

  rememberHandle(
    plugins.FgService.addListener?.("notificationTapped", () => {
      plugins.FgService.moveToForeground?.().catch(() => {});
    }),
  );

  syncNotification();
}

export async function destroyForegroundService() {
  if (!isInitialized) return;

  stopPolling();
  unbindDocumentEvents();
  await stopForeground();

  await Promise.all(handles.map((h) => h.remove().catch(() => {})));
  handles = [];
  pluginsRef = null;
  isInitialized = false;
}
