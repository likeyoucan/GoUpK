// Файл: www/js/color/color-ui.js

export function createColorSwatch({
  color,
  isCustom,
  type,
  t,
}) {
  const wrapper = document.createElement("div");
  wrapper.className = "color-swatch-wrapper relative rounded-full";
  wrapper.dataset.color = color;
  wrapper.dataset.custom = String(isCustom);

  const button = document.createElement("button");
  button.type = "button";
  button.className =
    "color-btn w-9 h-9 flex items-center justify-center rounded-full shrink-0 transition-transform active:scale-90 border border-black/20 dark:border-white/20 focus:outline-none custom-focus";
  button.setAttribute("aria-label", color === "default" ? t("default_color") : color);

  if (color === "default") {
    if (type === "accent") button.classList.add("default-accent-btn");
    else button.classList.add("default-bg-btn");
  } else {
    button.style.backgroundColor = color;
  }

  wrapper.append(button);
  return wrapper;
}

export function populateColorSection({
  container,
  type,
  standardColors,
  customColors,
  t,
}) {
  if (!container) return;

  container.querySelectorAll(".color-swatch-wrapper").forEach((el) => el.remove());

  const picker = container.querySelector(".color-picker-wrapper");
  const colors = [...standardColors, ...customColors];

  colors.forEach((color) => {
    const isCustom = customColors.includes(color);
    const swatch = createColorSwatch({ color, isCustom, type, t });
    container.insertBefore(swatch, picker);
  });
}

export function addColorToDOM({ container, color, type, t }) {
  if (!container) return;
  const picker = container.querySelector(".color-picker-wrapper");
  const swatch = createColorSwatch({ color, isCustom: true, type, t });
  container.insertBefore(swatch, picker);
}

export function updateAddButtonColor({ button, color, hexToRGB, getLuminance }) {
  button.style.backgroundColor = color;
  button.dataset.color = color;

  const { r, g, b } = hexToRGB(color);
  const luminance = getLuminance(r, g, b);
  button.style.color = luminance > 0.5 ? "#1f2937" : "#ffffff";
}

export function updateSelectionUI({
  container,
  type,
  color,
  doScroll,
  normalizeColor,
  themeManager,
  getCssVariable,
  hexToRGB,
  getLuminance,
  createSVGIcon,
}) {
  if (!container) return;

  container
    .querySelectorAll(".color-swatch-wrapper, .color-picker-wrapper")
    .forEach((el) => {
      el.classList.remove(
        "ring-2",
        "ring-[var(--primary-color)]",
        "ring-offset-2",
        "ring-offset-surface",
      );
      el.querySelector(".injected-checkmark")?.remove();
    });

  const normalizedColor = normalizeColor(color);
  let activeWrapper = container.querySelector(
    `.color-swatch-wrapper[data-color="${normalizedColor}"]`,
  );

  if (!activeWrapper) {
    const picker = container.querySelector(
      type === "accent" ? "#customColorInput" : "#customBgInput",
    );
    if (picker && normalizeColor(picker.value) === normalizedColor) {
      activeWrapper = picker.closest(".color-picker-wrapper");
    }
  }

  if (!activeWrapper) return;

  activeWrapper.classList.add(
    "ring-2",
    "ring-[var(--primary-color)]",
    "ring-offset-2",
    "ring-offset-surface",
  );

  if (!activeWrapper.matches(".color-picker-wrapper")) {
    const isDefault = normalizedColor === "default";
    let luminance;

    if (isDefault) {
      const cssVar = type === "accent" ? "--primary-color" : "--bg-color";
      const currentTheme = themeManager.getCurrentTheme();
      const defaultVarForTheme =
        type === "accent"
          ? getCssVariable(`--default-accent-${currentTheme}`)
          : getCssVariable(`--default-bg-${currentTheme}`);
      const currentColor = getCssVariable(cssVar) || defaultVarForTheme;
      luminance = getLuminance(...Object.values(hexToRGB(currentColor)));
    } else {
      luminance = getLuminance(...Object.values(hexToRGB(normalizedColor)));
    }

    const iconColor = luminance > 0.5 ? "#1f2937" : "#ffffff";
    const icon = createSVGIcon("M4.5 12.75l6 6 9-13.5", [
      "w-5",
      "h-5",
      "injected-checkmark",
    ]);
    icon.style.color = iconColor;
    activeWrapper.querySelector(".color-btn")?.append(icon);
  }

  if (doScroll) {
    activeWrapper.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }
}