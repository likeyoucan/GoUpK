// Файл: www/js/foreground/notification-permission.js

import {
  isNativePlatform,
  getPlugins,
} from "../platform/capacitor-adapter.js?v=VERSION";

let permissionRequestInFlight = null;

function normalizePermissionResult(result) {
  if (!result || typeof result !== "object") return false;

  const values = Object.values(result).map((v) => String(v).toLowerCase());
  return values.some((v) => v === "granted");
}

function getPermissionProviders() {
  const plugins = getPlugins() || {};

  const fg = plugins.CustomForegroundService || null;
  const local = plugins.LocalNotifications || null;
  const push = plugins.PushNotifications || null;

  const providers = [];

  if (fg?.checkPermissions && fg?.requestPermissions) {
    providers.push({
      name: "CustomForegroundService",
      check: fg.checkPermissions.bind(fg),
      request: fg.requestPermissions.bind(fg),
    });
  }

  if (local?.checkPermissions && local?.requestPermissions) {
    providers.push({
      name: "LocalNotifications",
      check: local.checkPermissions.bind(local),
      request: local.requestPermissions.bind(local),
    });
  }

  if (push?.checkPermissions && push?.requestPermissions) {
    providers.push({
      name: "PushNotifications",
      check: push.checkPermissions.bind(push),
      request: push.requestPermissions.bind(push),
    });
  }

  return providers;
}

function getPreferredRequestProvider(providers) {
  if (!Array.isArray(providers) || providers.length === 0) return null;

  // Один источник request -> нет дублей системного диалога.
  return (
    providers.find((p) => p.name === "CustomForegroundService") ||
    providers.find((p) => p.name === "LocalNotifications") ||
    providers.find((p) => p.name === "PushNotifications") ||
    providers[0]
  );
}

async function checkWithProviders(providers) {
  for (const provider of providers) {
    try {
      const res = await provider.check();
      if (normalizePermissionResult(res)) return true;
    } catch (err) {
      console.warn(
        `[notifications] ${provider.name}.checkPermissions failed`,
        err,
      );
    }
  }
  return false;
}

export function isNativeNotificationsRuntime() {
  return isNativePlatform();
}

export async function checkNotificationsGranted() {
  if (!isNativeNotificationsRuntime()) return false;

  const providers = getPermissionProviders();

  // Если нет провайдеров, не блокируем UI.
  if (!providers.length) return true;

  return checkWithProviders(providers);
}

export async function requestNotificationsPermission() {
  if (!isNativeNotificationsRuntime()) return false;

  // Дедупликация параллельных запросов.
  if (permissionRequestInFlight) return permissionRequestInFlight;

  permissionRequestInFlight = (async () => {
    const providers = getPermissionProviders();
    if (!providers.length) return true;

    // Быстрый путь: уже есть разрешение.
    if (await checkWithProviders(providers)) return true;

    // Запрос только через один провайдер.
    const requestProvider = getPreferredRequestProvider(providers);
    if (!requestProvider) return false;

    try {
      const reqRes = await requestProvider.request();
      if (normalizePermissionResult(reqRes)) return true;
    } catch (err) {
      console.warn(
        `[notifications] ${requestProvider.name}.requestPermissions failed`,
        err,
      );
    }

    // Финальная проверка после request.
    return checkWithProviders(providers);
  })();

  try {
    return await permissionRequestInFlight;
  } finally {
    permissionRequestInFlight = null;
  }
}
