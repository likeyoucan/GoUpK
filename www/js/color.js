// Файл: www/js/color.js (НОВЫЙ)

/**
 * Проверяет, является ли строка валидным HEX-кодом цвета.
 * @param {string} color - Строка для проверки.
 * @returns {boolean}
 */
export function isValidHex(color) {
  if (typeof color !== "string" || !color.startsWith("#")) return false;
  // Поддерживает форматы #rgb, #rgba, #rrggbb, #rrggbbaa
  const hex = color.slice(1);
  if (![3, 4, 6, 8].includes(hex.length)) return false;
  return /^[0-9a-fA-F]+$/.test(hex);
}

/**
 * Конвертирует HEX в RGB.
 * @param {string} H - HEX-код.
 * @returns {{r: number, g: number, b: number}}
 */
export function hexToRGB(H) {
  if (!isValidHex(H)) return { r: 0, g: 0, b: 0 };
  let r = 0,
    g = 0,
    b = 0;
  if (H.length === 4) {
    r = parseInt(H[1] + H[1], 16);
    g = parseInt(H[2] + H[2], 16);
    b = parseInt(H[3] + H[3], 16);
  } else if (H.length === 7) {
    r = parseInt(H.substring(1, 3), 16);
    g = parseInt(H.substring(3, 5), 16);
    b = parseInt(H.substring(5, 7), 16);
  }
  return { r, g, b };
}

/**
 * Конвертирует HEX в HSL.
 * @param {string} H - HEX-код.
 * @returns {{h: number, s: number, l: number}}
 */
export function hexToHSL(H) {
  if (!isValidHex(H)) return { h: 142, s: 50, l: 50 };
  const { r: r255, g: g255, b: b255 } = hexToRGB(H);
  let r = r255 / 255,
    g = g255 / 255,
    b = b255 / 255;
  let cmin = Math.min(r, g, b),
    cmax = Math.max(r, g, b),
    delta = cmax - cmin;
  let h = 0,
    s = 0,
    l = (cmax + cmin) / 2;
  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1));
    if (cmax === r) h = ((g - b) / delta) % 6;
    else if (cmax === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
  }
  h = Math.round(h * 60);
  if (h < 0) h += 360;
  return { h, s: +(s * 100).toFixed(1), l: +(l * 100).toFixed(1) };
}

/**
 * Рассчитывает яркость цвета (Luminance).
 * @param {number} r - Компонент Red (0-255).
 * @param {number} g - Компонент Green (0-255).
 * @param {number} b - Компонент Blue (0-255).
 * @returns {number} - Яркость от 0 до 1.
 */
export function getLuminance(r, g, b) {
  const a = [r, g, b].map((v) =>
    (v /= 255) <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4),
  );
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

/**
 * Создает SVG иконку.
 * @param {string} pathData - Атрибут 'd' для <path>.
 * @param {string[]} [classes=[]] - CSS-классы.
 * @returns {SVGElement}
 */
export function createSVGIcon(pathData, classes = []) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2.5");
  svg.setAttribute("focusable", "false");
  svg.setAttribute("aria-hidden", "true");
  if (classes.length) svg.classList.add(...classes);
  path.setAttribute("d", pathData);
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");
  svg.appendChild(path);
  return svg;
}
