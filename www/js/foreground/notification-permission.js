// Файл: www/js/foreground/notification-permission.js

import {
  isNativePlatform,
  getPlugins,
} from "../platform/capacitor-adapter.js?v=VERSION";

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

export function isNativeNotificationsRuntime() {
  return isNativePlatform();
}

export async function checkNotificationsGranted() {
  if (!isNativeNotificationsRuntime()) return false;

  const providers = getPermissionProviders();

  // Если нет доступного провайдера, не ломаем UX.
  // Считаем granted, чтобы не блокировать функционал на нестандартных сборках.
  if (!providers.length) return true;

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

export async function requestNotificationsPermission() {
  if (!isNativeNotificationsRuntime()) return false;

  const providers = getPermissionProviders();
  if (!providers.length) return true;

  for (const provider of providers) {
    try {
      const checkRes = await provider.check();
      if (normalizePermissionResult(checkRes)) return true;

      const reqRes = await provider.request();
      if (normalizePermissionResult(reqRes)) return true;
    } catch (err) {
      console.warn(
        `[notifications] ${provider.name}.requestPermissions failed`,
        err,
      );
    }
  }

  return false;
}
