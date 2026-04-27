// Файл: www/js/theme/theme-mode.js

export function isSystemDark() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function applyModeToDocument(mode) {
  const isDark = mode === "dark" || (mode === "system" && isSystemDark());

  document.documentElement.classList.toggle("dark", isDark);
  document.documentElement.style.colorScheme = isDark ? "dark" : "light";

  return isDark ? "dark" : "light";
}

export function syncModeButtons($, mode) {
  document.querySelectorAll("[data-theme-mode]").forEach((btn) => {
    btn.classList.remove("app-surface", "shadow-sm", "app-text");
    btn.classList.add("app-text-sec");
  });

  const activeBtn = $(`theme-${mode}`);
  if (activeBtn) {
    activeBtn.classList.remove("app-text-sec");
    activeBtn.classList.add("app-surface", "shadow-sm", "app-text");
  }
}

export function bindSystemThemeListener(handler) {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", handler);

  return () => {
    media.removeEventListener("change", handler);
  };
}