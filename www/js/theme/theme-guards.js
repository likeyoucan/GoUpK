// Файл www/js/theme/theme-guards.js

import { showToast } from "../utils.js?v=VERSION";
import { APP_EVENTS } from "../constants/events.js?v=VERSION";
import { resolveToastText } from "../constants/toast-fallbacks.js?v=VERSION";

export function notifyProBlocked(t, feature = "accent_bg") {
  showToast(resolveToastText(t, "pro_required"));
  document.dispatchEvent(
    new CustomEvent(APP_EVENTS.PRO_PAYWALL_REQUESTED, {
      detail: { feature },
    }),
  );
}
