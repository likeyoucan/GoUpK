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

  // Для accent/bg строка заголовка внутри блока
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

  // Для остальных строк (sound/ads) сам row и есть title row
  return row;
}

function resolveLeftLabel(titleRow) {
  if (!(titleRow instanceof HTMLElement)) return null;

  // Предпочитаем явный span с data-i18n
  const candidates = titleRow.querySelectorAll("span, label");
  for (const el of candidates) {
    if (!(el instanceof HTMLElement)) continue;
    if (isInsideCustomSelect(el)) continue;
    if (el.dataset?.i18n || el.classList.contains("font-medium")) {
      return el;
    }
  }

  // fallback: первый span/label вне custom-select
  for (const el of candidates) {
    if (!(el instanceof HTMLElement)) continue;
    if (isInsideCustomSelect(el)) continue;
    return el;
  }

  return null;
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
    btn.className = "pro-badge pro-animated-border active:scale-95";

    inlineWrap.appendChild(btn);
  });
}
