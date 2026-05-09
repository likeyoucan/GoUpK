// Файл: www/js/bootstrap/modal-bindings.js

import { APP_EVENTS } from "../constants/events.js?v=VERSION";
import { appProManager } from "../app-pro.js?v=VERSION";

export function bindModalActions({
  $,
  showToast,
  t,
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
    setTimeout(() => showToast(t("settings_reset_success")), 450);
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

  // Buy Pro main button (in Settings bottom area)
  bind("btn-buy-pro", "click", () => {
    modalManager.open("pro-subscribe-modal");
  });

  // Confirm buy in paywall modal
  bind("pro-confirm-buy", "click", async () => {
    await appProManager.purchase();
    modalManager.closeCurrent();
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
