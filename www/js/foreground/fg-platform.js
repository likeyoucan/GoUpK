// Файл: www/js/foreground/fg-platform.js

let pluginsRef = null;
let handles = [];

function debugLog(...args) {
  try {
    if (localStorage.getItem("fg-debug") === "true") {
      console.log("[fg-platform]", ...args);
    }
  } catch {}
}

export function isNative() {
  return !!(window.Capacitor && window.Capacitor.isNativePlatform());
}

export function getPlugins() {
  if (pluginsRef) return pluginsRef;
  if (!isNative()) return null;

  const allPlugins = window.Capacitor?.Plugins || {};
  const { App } = allPlugins;

  // Important: plugin key may differ across versions/builds.
  const FgService =
    allPlugins.ForegroundService ||
    allPlugins.AndroidForegroundService ||
    allPlugins.CapacitorAndroidForegroundService;

  if (!App || !FgService) {
    debugLog("plugins missing", {
      hasApp: !!App,
      hasFgService: !!FgService,
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
    start: !!start,
    update: !!update,
    stop: !!stop,
  });

  return pluginsRef;
}

export async function ensureNotificationPermission(FgService) {
  if (!FgService?.checkPermissions || !FgService?.requestPermissions) return;

  const status = await FgService.checkPermissions().catch(() => null);
  if (status?.display !== "granted") {
    await FgService.requestPermissions().catch(() => {});
  }
}

export async function ensureNotificationChannel(FgService, channel) {
  if (!FgService?.createNotificationChannel) return;

  await FgService.createNotificationChannel({
    id: channel.id,
    name: channel.name,
    description: channel.description,
    importance: channel.importance,
  }).catch(() => {});
}

export function rememberHandle(handlePromise) {
  handlePromise
    ?.then((h) => {
      if (h && typeof h.remove === "function") handles.push(h);
    })
    .catch(() => {});
}

export async function removeAllHandles() {
  await Promise.all(handles.map((h) => h.remove().catch(() => {})));
  handles = [];
}

export function resetPlatformCache() {
  pluginsRef = null;
}
