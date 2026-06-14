// Файл: www/js/foreground/fg-notification.js

export function getThemeSnapshot() {
  const isDarkTheme = document.documentElement.classList.contains("dark");
  return {
    isDarkTheme,
    themeToken: isDarkTheme ? "dark" : "light",
  };
}

export function buildSignature(state, payload, themeToken) {
  return [
    state.mode,
    state.running ? "1" : "0",
    state.metaKey || "",
    payload.title,
    payload.body,
    themeToken,
  ].join("|");
}

export function buildForegroundOptions({
  fgId,
  channelId,
  smallIcon,
  payload,
  isDarkTheme,
  toggleTitle,
}) {
  return {
    id: fgId,
    title: payload.title,
    body: payload.body,
    smallIcon,
    notificationChannelId: channelId,
    silent: true,
    serviceType: "specialUse",
    buttons: [{ id: 1, title: toggleTitle }],
    isDarkTheme,
  };
}
