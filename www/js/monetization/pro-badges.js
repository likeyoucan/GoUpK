// Файл: www/js/monetization/pro-badges.js

export function renderProBadges(config) {
  if (!config?.pro?.enabled) return;

  // Чистим старые инжектированные бейджи
  document
    .querySelectorAll("[data-pro-injected='1']")
    .forEach((el) => el.remove());

  const makeBadge = (feature) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "Pro";
    btn.dataset.proFeature = feature;
    btn.dataset.proInjected = "1";
    btn.className =
      "text-[10px] font-bold uppercase px-2 py-1 rounded-md border app-border app-text-sec active:scale-95";
    return btn;
  };

  config.proBadges.forEach(({ selector, feature }) => {
    const anchor = document.querySelector(selector);
    if (!anchor) return;

    const row =
      anchor.closest(".flex.items-center.justify-between") ||
      anchor.parentElement;
    if (!row) return;

    // Правая часть
    let right = row.lastElementChild;
    if (!right) return;

    // Если справа уже контейнер, добавляем туда,
    // иначе создаем правый контейнер.
    if (!right.classList.contains("flex")) {
      const wrap = document.createElement("div");
      wrap.className = "flex items-center gap-2";
      row.appendChild(wrap);
      right = wrap;
    }

    right.prepend(makeBadge(feature));
  });
}
