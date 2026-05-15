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

function hasGrantedValue(statusObj) {
  if (!statusObj || typeof statusObj !== "object") return false;

  return Object.values(statusObj).some(
    (v) => String(v).toLowerCase() === "granted",
  );
}

export function isNative() {
  return !!(window.Capacitor && window.Capacitor.isNativePlatform());
}

export function getPlugins() {
  if (pluginsRef) return pluginsRef;
  if (!isNative()) return null;

  const allPlugins = window.Capacitor?.Plugins || {};
  const App = allPlugins.App || null;

  // Important: plugin key may differ across versions/builds.
  const FgService =
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
  if (!FgService) {
    debugLog("permission check skipped: no FgService");
    return false;
  }

  if (!FgService.checkPermissions || !FgService.requestPermissions) {
    debugLog(
      "permission API unavailable on plugin, continue without explicit request",
    );
    return true;
  }

  let status = null;
  try {
    status = await FgService.checkPermissions();
    debugLog("checkPermissions result", status);
  } catch (err) {
    console.warn("[fg-platform] checkPermissions failed", err);
    return false;
  }

  let granted = hasGrantedValue(status);
  if (granted) return true;

  try {
    const requested = await FgService.requestPermissions();
    debugLog("requestPermissions result", requested);
    granted = hasGrantedValue(requested);
  } catch (err) {
    console.warn("[fg-platform] requestPermissions failed", err);
    return false;
  }

  if (!granted) {
    console.warn("[fg-platform] notifications permission is not granted");
  }

  return granted;
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

export function rememberHandle(handlePromise) {
  handlePromise
    ?.then((h) => {
      if (h && typeof h.remove === "function") {
        handles.push(h);
      }
    })
    .catch((err) => {
      console.warn("[fg-platform] listener handle rejected", err);
    });
}

export async function removeAllHandles() {
  await Promise.all(handles.map((h) => h.remove().catch(() => {})));
  handles = [];
}

export function resetPlatformCache() {
  pluginsRef = null;
}
