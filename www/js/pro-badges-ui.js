// Файл: www/js/pro-badges-ui.js

function tr(t, key, fallback = "") {
  const v = t(key);
  return v === key ? fallback || key : v;
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

    // accent/bg: top row inside section
    // sound/ads: row itself
    const titleRow =
      row.querySelector(":scope > .flex.items-center.justify-between") || row;

    if (!(titleRow instanceof HTMLElement)) return;

    // strict left label only, so badge never goes into custom-select
    const label =
      titleRow.querySelector(":scope > span[data-i18n]") ||
      titleRow.querySelector(":scope > label[data-i18n]") ||
      titleRow.querySelector(":scope > span.font-medium") ||
      titleRow.querySelector(":scope > label.font-medium");

    if (!(label instanceof HTMLElement)) return;

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

    // always near label
    inlineWrap.appendChild(btn);
  });
}