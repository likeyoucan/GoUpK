// Файл: www/js/pro-badges-ui.js

function tr(t, key, fallback = "") {
  const v = t(key);
  return v === key ? fallback || key : v;
}

function isInsideCustomSelect(el) {
  return !!el.closest(
    ".custom-select-container, .custom-select-trigger, .custom-select-options",
  );
}

function resolveTitleRow(row) {
  if (!(row instanceof HTMLElement)) return null;

  if (row.id === "setting-row-accent" || row.id === "setting-row-bg") {
    const candidates = row.querySelectorAll("div");
    for (const c of candidates) {
      if (
        c.classList.contains("flex") &&
        c.classList.contains("items-center") &&
        c.classList.contains("justify-between")
      ) {
        return c;
      }
    }
  }

  return row;
}

function resolveLeftLabel(titleRow) {
  if (!(titleRow instanceof HTMLElement)) return null;

  const candidates = titleRow.querySelectorAll("span, label");
  for (const el of candidates) {
    if (!(el instanceof HTMLElement)) continue;
    if (isInsideCustomSelect(el)) continue;
    if (el.dataset?.i18n || el.classList.contains("font-medium")) {
      return el;
    }
  }

  for (const el of candidates) {
    if (!(el instanceof HTMLElement)) continue;
    if (isInsideCustomSelect(el)) continue;
    return el;
  }

  return null;
}

function parseRgbString(color) {
  const nums = String(color).match(/\d+(\.\d+)?/g) || [];
  if (nums.length < 3) return null;

  return {
    r: Math.max(0, Math.min(255, Number(nums[0]))),
    g: Math.max(0, Math.min(255, Number(nums[1]))),
    b: Math.max(0, Math.min(255, Number(nums[2]))),
  };
}

function relativeLuminance({ r, g, b }) {
  const normalized = [r, g, b].map((v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });

  return (
    normalized[0] * 0.2126 + normalized[1] * 0.7152 + normalized[2] * 0.0722
  );
}

function blendRgb(base, target, mix) {
  const k = Math.max(0, Math.min(1, mix));
  const inv = 1 - k;

  return {
    r: Math.round(base.r * inv + target.r * k),
    g: Math.round(base.g * inv + target.g * k),
    b: Math.round(base.b * inv + target.b * k),
  };
}

function rgbToCss({ r, g, b }) {
  return `rgb(${r} ${g} ${b})`;
}

function applyProBadgeAdaptiveColors(badgeEl) {
  if (!(badgeEl instanceof HTMLElement)) return;

  const bgColor = getComputedStyle(badgeEl).backgroundColor;
  const rgb = parseRgbString(bgColor);
  if (!rgb) return;

  const isDark = document.documentElement.classList.contains("dark");
  const lum = relativeLuminance(rgb);

  // Текст:
  // - dark: всегда белый
  // - light: адаптивный под фон
  const fg = isDark ? "#ffffff" : lum > 0.58 ? "#052e16" : "#ffffff";

  // Рамка: адаптивная от цвета самого бейджа.
  const borderRgb = isDark
    ? blendRgb(rgb, { r: 255, g: 255, b: 255 }, 0.28)
    : blendRgb(rgb, { r: 15, g: 23, b: 42 }, 0.24);

  badgeEl.style.setProperty("--pro-badge-fg", fg);
  badgeEl.style.setProperty("--pro-badge-border", rgbToCss(borderRgb));
}

function refreshInjectedBadges() {
  document
    .querySelectorAll("[data-pro-injected='1']")
    .forEach((el) => applyProBadgeAdaptiveColors(el));
}

let themeObserverStarted = false;
function ensureThemeObserver() {
  if (themeObserverStarted) return;
  themeObserverStarted = true;

  const root = document.documentElement;
  if (!root) return;

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === "attributes" && m.attributeName === "class") {
        refreshInjectedBadges();
        break;
      }
    }
  });

  observer.observe(root, { attributes: true, attributeFilter: ["class"] });
}

export function renderProBadgesFromConfig(config, t) {
  const settingsRoot = document.getElementById("view-settings");
  if (!settingsRoot) return;

  settingsRoot
    .querySelectorAll("[data-pro-injected='1']")
    .forEach((el) => el.remove());

  if (!config?.pro?.enabled) return;

  (config.proBadges || []).forEach(({ selector, feature }) => {
    const row = document.querySelector(selector);
    if (!row) return;

    const titleRow = resolveTitleRow(row);
    if (!titleRow) return;

    const label = resolveLeftLabel(titleRow);
    if (!label) return;

    let inlineWrap = label.parentElement;
    if (
      !(inlineWrap instanceof HTMLElement) ||
      inlineWrap.dataset.proInlineWrap !== "1"
    ) {
      inlineWrap = document.createElement("span");
      inlineWrap.dataset.proInlineWrap = "1";
      inlineWrap.className = "pro-inline-wrap";
      label.replaceWith(inlineWrap);
      inlineWrap.appendChild(label);
    }

    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = tr(t, "pro", "Pro");
    btn.dataset.proFeature = feature;
    btn.dataset.proInjected = "1";
    btn.className = "pro-badge active:scale-95";

    inlineWrap.appendChild(btn);

    // Применяем адаптивные цвета после вставки в DOM.
    requestAnimationFrame(() => applyProBadgeAdaptiveColors(btn));
  });

  ensureThemeObserver();
}
