// Файл: www/js/sound/sound-bindings.js

import { APP_EVENTS } from "../constants/events.js?v=VERSION";
import { STORAGE_KEYS } from "../constants/storage-keys.js?v=VERSION";
import { appProManager } from "../app-pro.js?v=VERSION";
import { showToast } from "../utils.js?v=VERSION";
import { resolveToastText } from "../constants/toast-fallbacks.js?v=VERSION";
import { emitAppEvent } from "../events/app-events.js?v=VERSION";

function notifySoundThemeProLocked(t) {
  showToast(resolveToastText(t, "pro_sound_themes_locked"));
  emitAppEvent(APP_EVENTS.PRO_PAYWALL_REQUESTED, { feature: "sound_themes" });
}

export function bindSoundControls(sm, { $, safeSetLS, CustomSelect, t }) {
  sm._unbindSoundControls?.();

  const disposers = [];

  const bind = (el, event, handler, options) => {
    if (!el) return;
    el.addEventListener(event, handler, options);
    disposers.push(() => el.removeEventListener(event, handler, options));
  };

  const onToggleSound = (e) => {
    const enabled = e.target.checked;

    sm.setSoundEnabled(enabled, {
      persist: true,
      restoreVolume: true,
    });

    sm.updateVolumeUI();

    if (enabled) {
      sm.play("click");
    }
  };
  bind($("toggle-sound"), "change", onToggleSound);

  const onToggleVibro = (e) => {
    sm.vibroEnabled = e.target.checked;
    safeSetLS(STORAGE_KEYS.APP_VIBRO, sm.vibroEnabled);

    emitAppEvent(APP_EVENTS.VIBRO_TOGGLED, {
      enabled: sm.vibroEnabled,
    });

    if (sm.vibroEnabled) sm.vibrate(50, "medium");
  };
  bind($("toggle-vibro"), "change", onToggleVibro);

  const volumeSlider = $("volumeSlider");
  if (volumeSlider) {
    if (sm._onVolumeInput) {
      volumeSlider.removeEventListener("input", sm._onVolumeInput);
    }
    if (sm._onVolumeChange) {
      volumeSlider.removeEventListener("change", sm._onVolumeChange);
    }

    sm._onVolumeInput = (e) => {
      sm._applySliderVolume(e.target.value, { withPreview: true });
    };

    sm._onVolumeChange = (e) => {
      sm._applySliderVolume(e.target.value, { withPreview: false });
    };

    bind(volumeSlider, "input", sm._onVolumeInput);
    bind(volumeSlider, "change", sm._onVolumeChange);
  }

  const soundThemeOptions = [
    { value: "classic", text: t("theme_classic") },
    { value: "sport", text: t("theme_sport") },
    { value: "vibe", text: t("theme_vibe") },
    { value: "work", text: t("theme_work") },
    { value: "life", text: t("theme_life") },
  ];

  const soundThemeContainer = $("soundThemeSelectContainer");
  if (soundThemeContainer) {
    sm.soundThemeSelect?.destroy?.();
    sm.soundThemeSelect = new CustomSelect(
      "soundThemeSelectContainer",
      soundThemeOptions,
      (newTheme) => {
        if (newTheme !== "classic" && !appProManager.canUse("sound_themes")) {
          notifySoundThemeProLocked(t);
          sm.soundThemeSelect?.setValue(sm.theme || "classic", false);
          return;
        }

        sm.theme = newTheme;
        safeSetLS(STORAGE_KEYS.APP_SOUND_THEME, sm.theme);
        sm.play("click", { theme: newTheme });
      },
      sm.theme,
    );
  } else {
    console.warn(
      "[sound] soundThemeSelectContainer not found, skip custom select init",
    );
    sm.soundThemeSelect = null;
  }

  if (sm.theme !== "classic" && !appProManager.canUse("sound_themes")) {
    sm.theme = "classic";
    safeSetLS(STORAGE_KEYS.APP_SOUND_THEME, sm.theme);
    sm.soundThemeSelect?.setValue("classic", false);
  }

  const unlockHandler = () => sm.unlock();

  document.addEventListener("click", unlockHandler, {
    once: true,
    capture: true,
  });
  document.addEventListener("touchstart", unlockHandler, {
    once: true,
    passive: true,
  });

  disposers.push(() =>
    document.removeEventListener("click", unlockHandler, true),
  );
  disposers.push(() =>
    document.removeEventListener("touchstart", unlockHandler, true),
  );

  sm._unbindSoundControls = () => {
    disposers.forEach((off) => {
      try {
        off?.();
      } catch (err) {
        console.error("[sound-bindings.dispose]", err);
      }
    });
  };

  return sm._unbindSoundControls;
}
