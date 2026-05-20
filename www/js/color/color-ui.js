// Файл: www/js/color/color-ui.js

function hexToRgbSafe(hex) {
  const h = String(hex || "").trim();
  if (!h.startsWith("#")) return null;

  if (h.length === 4) {
    return {
      r: parseInt(h[1] + h[1], 16),
      g: parseInt(h[2] + h[2], 16),
      b: parseInt(h[3] + h[3], 16),
    };
  }

  if (h.length === 7) {
    return {
      r: parseInt(h.slice(1, 3), 16),
      g: parseInt(h.slice(3, 5), 16),
      b: parseInt(h.slice(5, 7), 16),
    };
  }

  return null;
}

function relativeLumFromRgb({ r, g, b }) {
  const a = [r, g, b].map((v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });

  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

export function createColorSwatch({ color, isCustom, type, t }) {
  const wrapper = document.createElement("div");
  wrapper.className = "color-swatch-wrapper relative rounded-full";
  wrapper.dataset.color = color;
  wrapper.dataset.custom = String(isCustom);

  const button = document.createElement("button");
  button.type = "button";
  button.className =
    "color-btn w-9 h-9 flex items-center justify-center rounded-full shrink-0 transition-transform active:scale-90 border focus:outline-none custom-focus";
  button.setAttribute(
    "aria-label",
    color === "default" ? t("default_color") : color,
  );

  if (color === "default") {
    if (type === "accent") button.classList.add("default-accent-btn");
    else button.classList.add("default-bg-btn");
  } else {
    button.style.backgroundColor = color;

    const rgb = hexToRgbSafe(color);
    if (rgb) {
      const lum = relativeLumFromRgb(rgb);
      if (lum < 0.22) {
        button.dataset.darkColor = "1";
      }
    }
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

  container
    .querySelectorAll(".color-swatch-wrapper")
    .forEach((el) => el.remove());

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

export function updateAddButtonColor({
  button,
  color,
  hexToRGB,
  getLuminance,
}) {
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
