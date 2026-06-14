// Файл: www/js/modal/modal-overlay.js

export function showBottomSheetOverlay(overlayEl) {
  if (!overlayEl) return;
  overlayEl.classList.remove("opacity-0");
  overlayEl.removeAttribute("aria-hidden");
}

export function hideBottomSheetOverlay(overlayEl) {
  if (!overlayEl) return;
  overlayEl.classList.add("opacity-0");
  overlayEl.setAttribute("aria-hidden", "true");
}

export function setMainInert(appEl, shouldBeInert) {
  if (!appEl) return;
  const mainContent = appEl.querySelector(".app-bg");
  if (mainContent) mainContent.inert = shouldBeInert;
}
