// Файл: www/js/main.js

import { $, showToast } from "./utils.js?v=VERSION";
import { langManager, t } from "./i18n.js?v=VERSION";
import { themeManager } from "./theme.js?v=VERSION";
import { navigation } from "./navigation.js?v=VERSION";
import { sw } from "./stopwatch.js?v=VERSION";
import { tm } from "./timer.js?v=VERSION";
import { tb } from "./tabata.js?v=VERSION";
import { sm } from "./sound.js?v=VERSION";
import { modalManager } from "./modal.js?v=VERSION";
import { initTouchRanges } from "./touch-range.js?v=VERSION";
import { preload } from "./preload.js?v=VERSION";
import {
  initForegroundService,
  destroyForegroundService,
} from "./foreground-service.js?v=VERSION";

import { initRingSvg } from "./bootstrap/ring-svg-injector.js?v=VERSION";
import { applyPerformanceProfile } from "./bootstrap/performance-profile.js?v=VERSION";
import { bindAppLifecycle } from "./bootstrap/app-lifecycle.js?v=VERSION";
import { initializeApp } from "./bootstrap/app-init.js?v=VERSION";
import { bindUiInteractions } from "./bootstrap/ui-interactions.js?v=VERSION";

import { appProManager } from "./app-pro.js?v=VERSION";
import { adsManager } from "./ads.js?v=VERSION";
import { APP_EVENTS } from "./constants/events.js?v=VERSION";
import { CustomSelect } from "./custom-select.js?v=VERSION";

function renderBootError(error) {
  const msg = (error && (error.stack || error.message)) || String(error);
  console.error("[BOOT ERROR]", error);

  preload.hide();
  document.body.classList.remove("preload");

  const existing = document.getElementById("boot-error-panel");
  if (existing) existing.remove();

  const panel = document.createElement("div");
  panel.id = "boot-error-panel";
  panel.className =
    "fixed inset-0 z-[300] bg-black/80 text-white p-4 overflow-auto text-xs font-mono";
  panel.innerHTML = `
    <div class="max-w-3xl mx-auto space-y-3">
      <h2 class="text-lg font-bold">App Boot Failed</h2>
      <p>Application stopped before initialization. Check error details below.</p>
      <pre class="whitespace-pre-wrap break-words bg-black/40 p-3 rounded-xl">${msg.replace(/[<>&]/g, (m) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[m])}</pre>
      <button id="boot-reload-btn" class="px-4 py-2 rounded-lg bg-white text-black font-bold">Reload</button>
    </div>
  `;
  document.body.appendChild(panel);

  const reloadBtn = document.getElementById("boot-reload-btn");
  reloadBtn?.addEventListener("click", () => location.reload());
}

function initProSettingsUi() {
  const statusEl = $("pro-status-badge");
  const revokeBtn = $("btn-revoke-pro");
  const modeHost = $("proModeSelectContainer");

  if (!modeHost) return;

  const modeOptions = [
    { value: "subscription", text: "Subscription" },
    { value: "lifetime", text: "Lifetime" },
    { value: "disabled", text: "Disabled" },
  ];

  const modeSelect = new CustomSelect(
    "proModeSelectContainer",
    modeOptions,
    async (value) => {
      try {
        await appProManager.setMode(value);
      } catch (err) {
        console.error("[pro-mode] failed", err);
      }
    },
    appProManager.mode,
  );

  const featureMap = [
    ["pro-gate-custom-colors", "custom_colors"],
    ["pro-gate-accent-bg", "accent_bg"],
    ["pro-gate-remove-ads", "remove_ads"],
    ["pro-gate-sound-themes", "sound_themes"],
    ["pro-gate-app-icon", "app_icon"],
  ];

  const sync = () => {
    if (statusEl)
      statusEl.textContent = appProManager.purchased ? "Pro active" : "Free";
    modeSelect?.setValue(appProManager.mode, false);

    featureMap.forEach(([id, key]) => {
      const el = $(id);
      if (!el) return;
      el.checked = !!appProManager.features?.[key];
    });
  };

  featureMap.forEach(([id, key]) => {
    const el = $(id);
    if (!el) return;
    el.addEventListener("change", async (e) => {
      try {
        await appProManager.setFeatureGate(key, !!e.target.checked);
      } catch (err) {
        console.error("[pro-feature] failed", key, err);
      }
    });
  });

  revokeBtn?.addEventListener("click", async () => {
    try {
      await appProManager.revoke();
    } catch (err) {
      console.error("[pro-revoke] failed", err);
    }
  });

  document.addEventListener(APP_EVENTS.PRO_STATUS_CHANGED, sync);
  sync();
}

async function bootstrap() {
  initializeApp({
    applyPerformanceProfile,
    initRingSvg,
    langManager,
    initTouchRanges,
    themeManager,
    sm,
    sw,
    tm,
    tb,
    navigation,
    modalManager,
  });

  await appProManager.init();

  adsManager.init();
  adsManager.bindAutoRefresh();
  adsManager.bindLifecycleMonetization();

  bindAppLifecycle({
    preload,
    initForegroundService,
    destroyForegroundService,
    modalManager,
    navigation,
  });

  bindUiInteractions({
    $,
    showToast,
    t,
    modalManager,
    themeManager,
    sm,
    langManager,
    sw,
    tm,
    tb,
    navigation,
  });

  initProSettingsUi();

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      appProManager.revalidateOrReset().catch((err) => {
        console.error("[pro-revalidate] failed", err);
      });
    }
  });

  document.addEventListener(APP_EVENTS.PRO_PAYWALL_REQUESTED, (e) => {
    const feature = e?.detail?.feature || "pro";
    showToast(`Pro required: ${feature}`);
  });
}

window.addEventListener("error", (e) => {
  console.error("[GLOBAL ERROR]", e.error || e.message);
});

window.addEventListener("unhandledrejection", (e) => {
  console.error("[UNHANDLED PROMISE]", e.reason);
});

document.addEventListener("DOMContentLoaded", async () => {
  try {
    await bootstrap();
  } catch (error) {
    renderBootError(error);
  }
});
