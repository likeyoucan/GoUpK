// Файл www/js/platform/capacitor-adapter.js

import {
  getCapacitorBridge,
  isNativeCapacitorPlatform,
  getCapacitorPluginsMap,
  getCapacitorPluginByName,
} from "../core/platform-bridge.js?v=VERSION";

export function getCapacitor() {
  return getCapacitorBridge();
}

export function isNativePlatform() {
  return isNativeCapacitorPlatform();
}

export function getPlugins() {
  return getCapacitorPluginsMap();
}

export function getPlugin(name) {
  return getCapacitorPluginByName(name);
}

export function getTimerAlarmBridge() {
  return getPlugin("TimerAlarmBridge");
}
