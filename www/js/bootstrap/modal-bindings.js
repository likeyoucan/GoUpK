// Файл: www/js/bootstrap/modal-bindings.js

import { APP_EVENTS } from "../constants/events.js?v=VERSION";
import { appProManager } from "../app-pro.js?v=VERSION";
import { t } from "../i18n.js?v=VERSION";

function safeToast(showToast, key, fallback) {
  const text = t(key);
  showToast(text === key ? fallback : text);
}

export function bindModalActions({
  $,
  showToast,
  t: tr,
  modalManager,
  themeManager,
  sm,
  langManager,
  sw,
  tb,
}) {
  const confirmReset = () => {
    modalManager.closeCurrent();
    themeManager.resetSettings();
    sm.resetSettings();
    langManager.resetSettings();
    setTimeout(() => showToast(tr("settings_reset_success")), 450);
  };

  const handlers = [];

  const bind = (id, event, fn) => {
    const el = $(id);
    if (!el) return;
    el.addEventListener(event, fn);
    handlers.push({ el, event, fn });
  };

  bind("sw-openResultsBtn", "click", () => {
    modalManager.open("sw-sessions-modal");
  });

  bind("tb-openModalBtn", "click", () => {
    modalManager.open("tb-modal", { idToEdit: null });
  });

  bind("btn-open-reset", "click", () => {
    modalManager.open("reset-modal");
  });

  // Legal modal from legacy settings button (if still present)
  bind("btn-open-legal", "click", () => {
    modalManager.open("legal-modal");
  });

  // Legal modal from footer inline privacy link
  bind("btn-open-legal-inline", "click", () => {
    modalManager.open("legal-modal");
  });

  bind("sw-clearAllBtn", "click", () => {
    if (sw.savedSessions.length > 0) modalManager.open("sw-clear-modal");
  });

  bind("reset-confirm", "click", confirmReset);
  bind("sw-clear-confirm", "click", () => sw.confirmClearAll());

  bind("sw-name-modal-content", "submit", (e) => {
    e.preventDefault();
    sw.confirmNameModal();
  });

  bind("tb-modal-form", "submit", (e) => {
    e.preventDefault();
    tb.saveWorkout();
  });

  // Main Pro button:
  // - data-pro-action="open-paywall" -> open paywall
  // - data-pro-action="cancel-subscription" -> revoke subscription
  bind("btn-buy-pro", "click", async (e) => {
    const btn = e.currentTarget;
    const action = btn?.dataset?.proAction || "open-paywall";

    if (action === "hidden") return;

    if (action === "cancel-subscription") {
      e.preventDefault();
      try {
        await appProManager.revoke();
      } catch (err) {
        console.error("[pro] revoke failed", err);
        safeToast(showToast, "share_failed", "Action failed");
      }
      return;
    }

    modalManager.open("pro-subscribe-modal");
  });

  // Confirm buy in paywall modal
  bind("pro-confirm-buy", "click", async () => {
    try {
      await appProManager.purchase();
      modalManager.closeCurrent();
    } catch (err) {
      console.error("[pro] purchase failed", err);
      safeToast(showToast, "share_failed", "Purchase failed");
    }
  });

  bind("pro-cancel-buy", "click", () => {
    modalManager.closeCurrent();
  });

  // Universal Pro badges (right-side "Pro" buttons)
  const onProBadgeClick = (e) => {
    const btn = e.target.closest("[data-pro-feature]");
    if (!btn) return;
    e.preventDefault();

    const feature = btn.getAttribute("data-pro-feature") || "pro_feature";
    if (appProManager.canUse(feature)) return;

    document.dispatchEvent(
      new CustomEvent(APP_EVENTS.PRO_PAYWALL_REQUESTED, {
        detail: { feature },
      }),
    );
    modalManager.open("pro-subscribe-modal");
  };

  document.addEventListener("click", onProBadgeClick);
  handlers.push({ el: document, event: "click", fn: onProBadgeClick });

  // If some module requests paywall programmatically
  const onPaywallRequested = () => {
    modalManager.open("pro-subscribe-modal");
  };
  document.addEventListener(
    APP_EVENTS.PRO_PAYWALL_REQUESTED,
    onPaywallRequested,
  );
  handlers.push({
    el: document,
    event: APP_EVENTS.PRO_PAYWALL_REQUESTED,
    fn: onPaywallRequested,
  });

  return () => {
    handlers.forEach(({ el, event, fn }) => {
      el.removeEventListener(event, fn);
    });
  };
}