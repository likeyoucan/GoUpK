// Файл: www/js/foreground/fg-platform.js

import {
  getCapacitorBridge,
  isNativeCapacitorPlatform,
  getCapacitorPluginsMap,
} from "../core/platform-bridge.js?v=VERSION";

/** @typedef {{
 * App: any,
 * FgService: any,
 * start?: (opts: any) => Promise<any>,
 * update?: (opts: any) => Promise<any>,
 * stop?: () => Promise<any>
 * }} ForegroundPluginFacade
 */

/** @type {ForegroundPluginFacade | null} */
let pluginsRef = null;
let handles = [];

function getCapacitor() {
  return getCapacitorBridge();
}

function isNativePlatform() {
  return isNativeCapacitorPlatform();
}

function getCapacitorPlugins() {
  return getCapacitorPluginsMap();
}

function debugLog(...args) {
  try {
    if (localStorage.getItem("fg-debug") === "true") {
      console.log("[fg-platform]", ...args);
    }
  } catch {}
}

function hasGrantedValue(statusObj) {
  if (!statusObj || typeof statusObj !== "object") return false;

  return Object.values(statusObj).some(
    (v) => String(v).toLowerCase() === "granted",
  );
}

export function isNative() {
  return isNativePlatform();
}

export function getPlugins() {
  if (pluginsRef) return pluginsRef;
  if (!isNative()) return null;

  const allPlugins = getCapacitorPlugins();
  const App = allPlugins.App || null;

  const FgService =
    allPlugins.CustomForegroundService ||
    allPlugins.ForegroundService ||
    allPlugins.AndroidForegroundService ||
    allPlugins.CapacitorAndroidForegroundService;

  if (!FgService) {
    debugLog("fg plugin missing", {
      hasApp: !!App,
      pluginKeys: Object.keys(allPlugins),
    });
    return null;
  }

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

  debugLog("plugins resolved", {
    hasApp: !!App,
    start: !!start,
    update: !!update,
    stop: !!stop,
    fgMethods: Object.keys(FgService || {}),
  });

  return pluginsRef;
}

export async function ensureNotificationPermission(FgService) {
  const allPlugins = getCapacitorPlugins();
  const LocalNotifications = allPlugins?.LocalNotifications || null;
  const PushNotifications = allPlugins?.PushNotifications || null;

  const providers = [
    {
      name: "ForegroundService",
      check: FgService?.checkPermissions?.bind(FgService),
      request: FgService?.requestPermissions?.bind(FgService),
    },
    {
      name: "LocalNotifications",
      check: LocalNotifications?.checkPermissions?.bind(LocalNotifications),
      request: LocalNotifications?.requestPermissions?.bind(LocalNotifications),
    },
    {
      name: "PushNotifications",
      check: PushNotifications?.checkPermissions?.bind(PushNotifications),
      request: PushNotifications?.requestPermissions?.bind(PushNotifications),
    },
  ].filter((p) => p.check && p.request);

  if (!providers.length) {
    debugLog("no notification permission providers found");
    return false;
  }

  for (const p of providers) {
    try {
      const checked = await p.check();
      debugLog(`${p.name}.checkPermissions`, checked);

      if (hasGrantedValue(checked)) return true;

      const requested = await p.request();
      debugLog(`${p.name}.requestPermissions`, requested);

      if (hasGrantedValue(requested)) return true;
    } catch (err) {
      console.warn(`[fg-platform] ${p.name} permission flow failed`, err);
    }
  }

  console.warn("[fg-platform] notifications permission is not granted");
  return false;
}

export async function ensureNotificationChannel(FgService, channel) {
  if (!FgService?.createNotificationChannel) {
    debugLog("createNotificationChannel not supported by plugin");
    return true;
  }

  try {
    await FgService.createNotificationChannel({
      id: channel.id,
      name: channel.name,
      description: channel.description,
      importance: channel.importance,
    });
    debugLog("notification channel ensured", channel.id);
    return true;
  } catch (err) {
    console.warn("[fg-platform] createNotificationChannel failed", err);
    return false;
  }
}

export function rememberHandle(handleOrPromise) {
  if (!handleOrPromise) return;

  if (typeof handleOrPromise.then === "function") {
    handleOrPromise
      .then((h) => {
        if (h && typeof h.remove === "function") {
          handles.push(h);
        }
      })
      .catch((err) => {
        console.warn("[fg-platform] listener handle rejected", err);
      });
    return;
  }

  if (typeof handleOrPromise.remove === "function") {
    handles.push(handleOrPromise);
    return;
  }

  console.warn("[fg-platform] unknown listener handle type", handleOrPromise);
}

export async function removeAllHandles() {
  await Promise.all(
    handles.map((h) =>
      Promise.resolve()
        .then(() => h?.remove?.())
        .catch(() => {}),
    ),
  );
  handles = [];
}

export function resetPlatformCache() {
  pluginsRef = null;
}
