// Файл: www/js/color/color-guards.js

import { showToast } from "../utils.js?v=VERSION";
import { t } from "../i18n.js?v=VERSION";
import { APP_EVENTS } from "../constants/events.js?v=VERSION";
import { emitAppEvent } from "../events/app-events.js?v=VERSION";

export function showProMessage(feature = "custom_colors") {
  showToast(
    t("pro_required") === "pro_required"
      ? "Feature available in Pro"
      : t("pro_required"),
  );

  emitAppEvent(APP_EVENTS.PRO_PAYWALL_REQUESTED, { feature });
}
