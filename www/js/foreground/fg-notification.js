// Файл: www/js/foreground/fg-notification.js

function readCssVar(name) {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
}

function toHexFromColor(value) {
  const v = String(value || "")
    .trim()
    .toLowerCase();

  if (!v) return "";
  if (v.startsWith("#")) {
    if (v.length === 4) {
      return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
    }
    return v;
  }

  const rgbMatch = v.match(
    /rgba?\(\s*([0-9.]+)\s*[, ]\s*([0-9.]+)\s*[, ]\s*([0-9.]+)(?:\s*[,/]\s*([0-9.]+))?\s*\)/,
  );
  if (!rgbMatch) return "";

  const r = Math.max(0, Math.min(255, Math.round(Number(rgbMatch[1]))));
  const g = Math.max(0, Math.min(255, Math.round(Number(rgbMatch[2]))));
  const b = Math.max(0, Math.min(255, Math.round(Number(rgbMatch[3]))));

  const hex = (n) => n.toString(16).padStart(2, "0");
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

export function getThemeSnapshot() {
  const isDarkTheme = document.documentElement.classList.contains("dark");
  return {
    isDarkTheme,
    themeToken: isDarkTheme ? "dark" : "light",
  };
}

export function getAccentSnapshot() {
  // Берем уже вычисленные CSS-переменные (включая adaptive-логику).
  const accentRaw = readCssVar("--primary-color");
  const onAccentRaw = readCssVar("--on-primary-color");

  const accentColor = toHexFromColor(accentRaw) || "#3399ff";
  const onAccentColor = toHexFromColor(onAccentRaw) || "#ffffff";

  return {
    accentColor,
    onAccentColor,
    accentToken: `${accentColor}|${onAccentColor}`,
  };
}

export function buildSignature(state, payload, { themeToken, accentToken }) {
  return [
    state.mode,
    state.running ? "1" : "0",
    state.metaKey || "",
    payload.title,
    payload.body,
    themeToken || "",
    accentToken || "",
  ].join("|");
}

export function buildForegroundOptions({
  fgId,
  channelId,
  smallIcon,
  payload,
  isDarkTheme,
  toggleTitle,
  accentColor,
  onAccentColor,
}) {
  return {
    id: fgId,
    title: payload.title,
    body: payload.body,
    smallIcon,
    notificationChannelId: channelId,
    silent: true,
    serviceType: "specialUse",

    // Цвета передаем в нативный слой.
    color: accentColor,
    colorized: true,
    buttonColor: accentColor,
    buttonTextColor: onAccentColor,

    buttons: [
      {
        id: 1,
        title: toggleTitle,
        color: accentColor,
        textColor: onAccentColor,
      },
    ],

    isDarkTheme,
  };
}
