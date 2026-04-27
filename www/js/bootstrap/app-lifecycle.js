// Файл: www/js/bootstrap/app-lifecycle.js

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

function bindForegroundLifecycle({ initForegroundService, destroyForegroundService }) {
  initForegroundService();

  const onBeforeUnload = () => {
    destroyForegroundService();
  };

  window.addEventListener("beforeunload", onBeforeUnload, { once: true });

  return () => {
    window.removeEventListener("beforeunload", onBeforeUnload);
  };
}

function bindCapacitorLifecycle({ modalManager, navigation }) {
  if (!(window.Capacitor && window.Capacitor.isNativePlatform())) {
    return () => {};
  }

  const { StatusBar, App } = window.Capacitor.Plugins || {};

  if (StatusBar) {
    StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {});
    StatusBar.setStyle({ style: "DARK" }).catch(() => {});
  }

  let backHandle = null;

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
  }

  return () => {
    Promise.resolve(backHandle)
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
}) {
  preload.show();

  const unbindPreloader = bindPreloaderLifecycle(preload);
  const unbindForeground = bindForegroundLifecycle({
    initForegroundService,
    destroyForegroundService,
  });
  const unbindCapacitor = bindCapacitorLifecycle({ modalManager, navigation });

  return () => {
    unbindPreloader?.();
    unbindForeground?.();
    unbindCapacitor?.();
  };
}