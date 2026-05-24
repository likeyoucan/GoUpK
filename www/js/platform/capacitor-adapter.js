// Файл www/js/platform/capacitor-adapter.js

export function getCapacitor() {
  return window.Capacitor || null;
}

export function isNativePlatform() {
  const c = getCapacitor();
  return !!(
    c &&
    typeof c.isNativePlatform === "function" &&
    c.isNativePlatform()
  );
}

export function getPlugins() {
  return getCapacitor()?.Plugins || {};
}

export function getPlugin(name) {
  if (!name) return null;
  return getPlugins()[name] || null;
}

export function getTimerAlarmBridge() {
  return getPlugin("TimerAlarmBridge");
}
