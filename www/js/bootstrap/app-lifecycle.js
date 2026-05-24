// Файл: www/js/bootstrap/app-lifecycle.js

function isNativePlatform() {
  return !!(window.Capacitor && window.Capacitor.isNativePlatform());
}

function getCapacitorPlugins() {
  return window.Capacitor?.Plugins || {};
}

function bindPreloaderLifecycle(preload) {
  let hidden = false;

  const hideOnce = () => {
    if (hidden) return;
    hidden = true;
    preload.hide();
  };

  const onLoad = () => requestAnimationFrame(() => hideOnce());
  window.addEventListener("load", onLoad, { once: true });

  const fallbackTimer = setTimeout(() => {
    requestAnimationFrame(() => hideOnce());
  }, 2500);

  return () => {
    clearTimeout(fallbackTimer);
    window.removeEventListener("load", onLoad);
  };
}

function bindForegroundLifecycle({
  initForegroundService,
  destroyForegroundService,
  adsManager,
}) {
  initForegroundService();

  const onBeforeUnload = () => {
    adsManager?.showInterstitialIfAllowed?.("app_close");
    destroyForegroundService();
  };

  window.addEventListener("beforeunload", onBeforeUnload, { once: true });

  return () => {
    window.removeEventListener("beforeunload", onBeforeUnload);
  };
}

function bindCapacitorLifecycle({ modalManager, navigation, adsManager }) {
  if (!isNativePlatform()) {
    return () => {};
  }

  const { StatusBar, App } = getCapacitorPlugins();

  if (StatusBar) {
    StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {});
    StatusBar.setStyle({ style: "DARK" }).catch(() => {});
  }

  let backHandle = null;
  let appStateHandle = null;

  if (App?.addListener) {
    backHandle = App.addListener("backButton", () => {
      if (modalManager.hasActiveModal()) {
        modalManager.closeCurrent();
      } else if (navigation.activeView !== "stopwatch") {
        navigation.switchView("stopwatch", { source: "tap" });
      } else {
        App.minimizeApp();
      }
    });

    // Treat app background/minimize as app_close monetization scenario.
    appStateHandle = App.addListener("appStateChange", ({ isActive }) => {
      if (isActive === false) {
        adsManager?.showInterstitialIfAllowed?.("app_close");
      }
    });
  }

  return () => {
    Promise.resolve(backHandle)
      .then((h) => h?.remove?.())
      .catch(() => {});

    Promise.resolve(appStateHandle)
      .then((h) => h?.remove?.())
      .catch(() => {});
  };
}

export function bindAppLifecycle({
  preload,
  initForegroundService,
  destroyForegroundService,
  modalManager,
  navigation,
  adsManager,
}) {
  preload.show();

  const unbindPreloader = bindPreloaderLifecycle(preload);
  const unbindForeground = bindForegroundLifecycle({
    initForegroundService,
    destroyForegroundService,
    adsManager,
  });
  const unbindCapacitor = bindCapacitorLifecycle({
    modalManager,
    navigation,
    adsManager,
  });

  return () => {
    unbindPreloader?.();
    unbindForeground?.();
    unbindCapacitor?.();
  };
}
