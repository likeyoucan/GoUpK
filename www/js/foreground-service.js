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
const POLL_MS = 500;
const CHANNEL = {
  id: "stopwatch_channel",
  name: "Stopwatch Pro",
  description: "Background stopwatch, timer and tabata controls",
  importance: 3,
};
const SMALL_ICON = "ic_stat_name";

let isInitialized = false;
let appIsActive = true;
let poller = null;
let lastSignature = "";
let isForegroundShown = false;

const listeners = {
  appState: null,
  activeTimerChanged: null,
  timerStarted: null,
  msChanged: null,
  languageChanged: null,
  foregroundSettingChanged: null,
};

function buildSignature(state, payload) {
  return [
    state.mode,
    state.running ? "1" : "0",
    payload.title,
    payload.body,
    payload.buttonTitle,
    uiSettingsManager.showMs ? "ms1" : "ms0",
  ].join("|");
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

  const state = getForegroundState({
    sw,
    tm,
    tb,
    activeView: navigation.activeView,
  });

  if (!state) {
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
  lastSignature = signature;

  const options = {
    id: FG_ID,
    title: payload.title,
    body: payload.body,
    smallIcon: SMALL_ICON,
    notificationChannelId: CHANNEL.id,
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
  const state = getForegroundState({
    sw,
    tm,
    tb,
    activeView: navigation.activeView,
  });
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

export async function initForegroundService() {
  if (isInitialized) return;
  if (!isNative()) return;

  const plugins = getPlugins();
  if (!plugins || !plugins.start || !plugins.stop) return;

  isInitialized = true;
  appIsActive = true;

  await ensureNotificationPermission(plugins.FgService);
  await ensureNotificationChannel(plugins.FgService, CHANNEL);

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

  await removeAllHandles();
  resetPlatformCache();

  isInitialized = false;
  appIsActive = true;
}
