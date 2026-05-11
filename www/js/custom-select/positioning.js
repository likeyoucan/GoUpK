// Файл: www/js/custom-select/positioning.js

const SELECT_MAX_VIEWPORT_K = 0.6;
const SELECT_MIN_HEIGHT_PX = 120;

export function decidePlacement(triggerEl) {
  const rect = triggerEl.getBoundingClientRect();
  const vh = window.innerHeight || document.documentElement.clientHeight || 0;
  const gap = 8;

  const spaceBelow = Math.max(0, vh - rect.bottom - gap - 8);
  const spaceAbove = Math.max(0, rect.top - gap - 8);

  return spaceBelow >= 140 || spaceBelow >= spaceAbove ? "bottom" : "top";
}

export function positionPanel({ triggerEl, panelEl, portalRoot, placement }) {
  const rect = triggerEl.getBoundingClientRect();
  const portalRect = portalRoot.getBoundingClientRect();
  const gap = 8;

  const vw = window.innerWidth || document.documentElement.clientWidth || 0;
  const vh = window.innerHeight || document.documentElement.clientHeight || 0;

  const panelWidth = Math.max(120, Math.round(rect.width));
  const maxPanelWidth = Math.max(120, vw - 16);
  const width = Math.min(panelWidth, maxPanelWidth);

  let left = Math.round(rect.left);
  if (left + width > vw - 8) left = Math.max(8, vw - width - 8);
  if (left < 8) left = 8;

  const spaceBelow = Math.max(0, vh - rect.bottom - gap - 8);
  const spaceAbove = Math.max(0, rect.top - gap - 8);
  const viewportCap = Math.floor(vh * SELECT_MAX_VIEWPORT_K);
  const availableSpace = placement === "top" ? spaceAbove : spaceBelow;

  const maxHeight = Math.max(
    SELECT_MIN_HEIGHT_PX,
    Math.min(viewportCap, Math.floor(availableSpace)),
  );

  panelEl.style.maxHeight = `${maxHeight}px`;
  panelEl.style.overflowY = "auto";
  panelEl.style.overscrollBehavior = "contain";

  let top;
  if (placement === "top") {
    const panelHeight = Math.min(maxHeight, panelEl.scrollHeight || maxHeight);
    top = Math.round(rect.top - gap - panelHeight);
    if (top < 8) top = 8;
  } else {
    top = Math.round(rect.bottom + gap);
    const maxTop = vh - 8 - Math.min(maxHeight, 120);
    if (top > maxTop) top = Math.max(8, maxTop);
  }

  const isFixedToBody = portalRoot === document.body;
  const localLeft = isFixedToBody ? left : left - portalRect.left;
  const localTop = isFixedToBody ? top : top - portalRect.top;

  panelEl.style.left = `${localLeft}px`;
  panelEl.style.top = `${localTop}px`;
  panelEl.style.width = `${width}px`;
  panelEl.style.zIndex = "1000";
}
