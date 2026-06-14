// Файл: www/js/theme/theme-history.js

export function buildColorSet(type, colorManager) {
  const base =
    type === "accent"
      ? [
          ...colorManager.standardAccentColors,
          ...colorManager.customAccentColors,
        ]
      : [...colorManager.standardBgColors, ...colorManager.customBgColors];

  return new Set(base.map((c) => String(c).toLowerCase()));
}
