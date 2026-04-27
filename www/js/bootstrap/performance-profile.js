// Файл: www/js/bootstrap/performance-profile.js

export function applyPerformanceProfile() {
  const root = document.documentElement;

  const mem = Number(navigator.deviceMemory || 4);
  const cores = Number(navigator.hardwareConcurrency || 4);
  const saveData = navigator.connection?.saveData === true;

  const isLowEnd = mem <= 4 || cores <= 4 || saveData;
  root.classList.toggle("glass-lite", isLowEnd);
}