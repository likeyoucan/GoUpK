// Файл: www/js/foreground/fg-platform.js

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
  return window.Capacitor || null;
}

function isNativePlatform() {
  const c = getCapacitor();
  return !!(
    c &&
    typeof c.isNativePlatform === "function" &&
    c.isNativePlatform()
  );
}

function getCapacitorPlugins() {
  return getCapacitor()?.Plugins || {};
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

  // Priority:
  // 1) Custom native plugin (Variant B)
  // 2) Capawesome plugin fallbacks (legacy compatibility)
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
