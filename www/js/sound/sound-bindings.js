// Файл: www/js/sound/sound-bindings.js

import { APP_EVENTS } from "../constants/events.js?v=VERSION";
import { STORAGE_KEYS } from "../constants/storage-keys.js?v=VERSION";

export function bindSoundControls(sm, { $, safeSetLS, CustomSelect, t }) {
  $("toggle-sound")?.addEventListener("change", (e) => {
    const enabled = e.target.checked;

    sm.setSoundEnabled(enabled, {
      persist: true,
      restoreVolume: true,
    });

    sm.updateVolumeUI();

    if (enabled) {
      sm.play("click");
    }
  });

  $("toggle-vibro")?.addEventListener("change", (e) => {
    sm.vibroEnabled = e.target.checked;
    safeSetLS(STORAGE_KEYS.APP_VIBRO, sm.vibroEnabled);

    document.dispatchEvent(
      new CustomEvent(APP_EVENTS.VIBRO_TOGGLED, {
        detail: { enabled: sm.vibroEnabled },
      }),
    );

    if (sm.vibroEnabled) sm.vibrate(50, "medium");
  });

  const volumeSlider = $("volumeSlider");
  if (volumeSlider && volumeSlider.dataset.boundSound !== "1") {
    volumeSlider.dataset.boundSound = "1";

    sm._onVolumeInput = (e) => {
      sm._applySliderVolume(e.target.value, { withPreview: true });
    };

    sm._onVolumeChange = (e) => {
      sm._applySliderVolume(e.target.value, { withPreview: false });
    };

    volumeSlider.addEventListener("input", sm._onVolumeInput);
    volumeSlider.addEventListener("change", sm._onVolumeChange);
  }

  const soundThemeOptions = [
    { value: "classic", text: t("theme_classic") },
    { value: "sport", text: t("theme_sport") },
    { value: "vibe", text: t("theme_vibe") },
    { value: "work", text: t("theme_work") },
    { value: "life", text: t("theme_life") },
  ];

  sm.soundThemeSelect = new CustomSelect(
    "soundThemeSelectContainer",
    soundThemeOptions,
    (newTheme) => {
      sm.theme = newTheme;
      safeSetLS(STORAGE_KEYS.APP_SOUND_THEME, sm.theme);
      sm.play("click", { theme: newTheme });
    },
    sm.theme,
  );

  const unlockHandler = () => sm.unlock();

  document.addEventListener("click", unlockHandler, {
    once: true,
    capture: true,
  });

  document.addEventListener("touchstart", unlockHandler, {
    once: true,
    passive: true,
  });
}
