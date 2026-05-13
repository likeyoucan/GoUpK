// Файл: www/js/custom-select/positioning.js

const SELECT_MAX_VIEWPORT_K = 0.6;
const SELECT_MIN_HEIGHT_PX = 120;
const EDGE_GAP = 8;

function getViewportSize() {
  const vw = window.innerWidth || document.documentElement.clientWidth || 0;
  const vh = window.innerHeight || document.documentElement.clientHeight || 0;
  return { vw, vh };
}

function getRootRect(portalRoot) {
  const { vw, vh } = getViewportSize();

  if (
    !portalRoot ||
    portalRoot === document.body ||
    portalRoot === document.documentElement ||
    !(portalRoot instanceof HTMLElement)
  ) {
    return {
      left: 0,
      top: 0,
      right: vw,
      bottom: vh,
      width: vw,
      height: vh,
      isViewport: true,
    };
  }

  const rect = portalRoot.getBoundingClientRect();
  return {
    left: rect.left,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    width: rect.width,
    height: rect.height,
    isViewport: false,
  };
}

export function decidePlacement(triggerEl, portalRoot = document.body) {
  const rect = triggerEl.getBoundingClientRect();
  const rootRect = getRootRect(portalRoot);
  const gap = EDGE_GAP;

  const spaceBelow = Math.max(
    0,
    rootRect.bottom - rect.bottom - gap - EDGE_GAP,
  );
  const spaceAbove = Math.max(0, rect.top - rootRect.top - gap - EDGE_GAP);

  // Prefer opening down only when there is enough visible space inside current app/root.
  if (spaceBelow >= 140) return "bottom";
  if (spaceAbove >= 140) return "top";

  return spaceBelow >= spaceAbove ? "bottom" : "top";
}

export function positionPanel({ triggerEl, panelEl, portalRoot, placement }) {
  const rect = triggerEl.getBoundingClientRect();
  const rootRect = getRootRect(portalRoot);
  const gap = EDGE_GAP;

  const { vw, vh } = getViewportSize();

  // Keep panel width aligned with trigger but constrained by root bounds.
  const panelWidth = Math.max(120, Math.round(rect.width));
  const maxPanelWidth = Math.max(
    120,
    Math.floor(rootRect.width - EDGE_GAP * 2),
  );
  const width = Math.min(panelWidth, maxPanelWidth);

  let left = Math.round(rect.left);
  const minLeft = Math.round(rootRect.left + EDGE_GAP);
  const maxLeft = Math.round(rootRect.right - EDGE_GAP - width);
  left = Math.max(minLeft, Math.min(left, maxLeft));

  const spaceBelow = Math.max(
    0,
    rootRect.bottom - rect.bottom - gap - EDGE_GAP,
  );
  const spaceAbove = Math.max(0, rect.top - rootRect.top - gap - EDGE_GAP);

  const rootHeightCap = Math.floor(rootRect.height * SELECT_MAX_VIEWPORT_K);
  const viewportCap = Math.floor(vh * SELECT_MAX_VIEWPORT_K);
  const cap = Math.max(56, Math.min(rootHeightCap, viewportCap));

  const availableSpace = placement === "top" ? spaceAbove : spaceBelow;
  const maxHeight = Math.max(
    56,
    Math.min(
      cap,
      Math.max(0, Math.floor(availableSpace || SELECT_MIN_HEIGHT_PX)),
    ),
  );

  panelEl.style.maxHeight = `${maxHeight}px`;
  panelEl.style.overflowY = "auto";
  panelEl.style.overscrollBehavior = "contain";

  let top;
  if (placement === "top") {
    const panelHeight = Math.min(maxHeight, panelEl.scrollHeight || maxHeight);
    top = Math.round(rect.top - gap - panelHeight);
    const minTop = Math.round(rootRect.top + EDGE_GAP);
    if (top < minTop) top = minTop;
  } else {
    top = Math.round(rect.bottom + gap);
    const minTop = Math.round(rootRect.top + EDGE_GAP);
    const maxTop = Math.round(
      rootRect.bottom - EDGE_GAP - Math.min(maxHeight, 120),
    );
    top = Math.max(minTop, Math.min(top, maxTop));
  }

  const isFixedToBody =
    !portalRoot ||
    portalRoot === document.body ||
    portalRoot === document.documentElement ||
    !(portalRoot instanceof HTMLElement);

  const localLeft = isFixedToBody ? left : left - rootRect.left;
  const localTop = isFixedToBody ? top : top - rootRect.top;

  panelEl.style.left = `${Math.round(localLeft)}px`;
  panelEl.style.top = `${Math.round(localTop)}px`;
  panelEl.style.width = `${Math.round(width)}px`;
  panelEl.style.zIndex = "1000";
}
