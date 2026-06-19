// Файл: www/js/bootstrap/runtime-bootstrap.js

import { initializeApp } from "./app-init.js?v=VERSION";
import { bindAppLifecycle } from "./app-lifecycle.js?v=VERSION";
import { bindUiInteractions } from "./ui-interactions.js?v=VERSION";
import { createDisposerBag } from "./disposer-bag.js?v=VERSION";
import { createRuntimeHub } from "../core/runtime-hub.js?v=VERSION";

export function initRuntimeBootstrap({
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
  preload,
  initForegroundService,
  destroyForegroundService,
  adsManager,
  showToast,
  t,
  getById,
}) {
  const bag = createDisposerBag();
  const runtimeHub = createRuntimeHub();

  runtimeHub.register("app-init", () => {
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
  });

  runtimeHub.register("app-lifecycle", () => {
    bag.add(
      bindAppLifecycle({
        preload,
        initForegroundService,
        destroyForegroundService,
        modalManager,
        navigation,
        adsManager,
      }),
    );
  });

  runtimeHub.register("ui-interactions", () => {
    bag.add(
      bindUiInteractions({
        $: getById,
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
      }),
    );
  });

  runtimeHub.start();

  return () => {
    try {
      runtimeHub.stop();
    } catch (err) {
      console.error("[runtime-bootstrap.runtime-hub.stop]", err);
    }

    bag.run();
  };
}
