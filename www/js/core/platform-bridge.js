// Файл: www/js/core/platform-bridge.js

export function getCapacitorBridge() {
  return window.Capacitor || null;
}

export function isNativeCapacitorPlatform() {
  const c = getCapacitorBridge();
  return !!(
    c &&
    typeof c.isNativePlatform === "function" &&
    c.isNativePlatform()
  );
}

export function getCapacitorPluginsMap() {
  return getCapacitorBridge()?.Plugins || {};
}

export function getCapacitorPluginByName(name) {
  if (!name) return null;
  return getCapacitorPluginsMap()[name] || null;
}
