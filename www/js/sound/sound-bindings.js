// Файл: www/js/sound/sound-bindings.js

import { APP_EVENTS } from "../constants/events.js?v=VERSION";
import { STORAGE_KEYS } from "../constants/storage-keys.js?v=VERSION";
import { appProManager } from "../app-pro.js?v=VERSION";
import { showToast } from "../utils.js?v=VERSION";

function notifySoundThemeProLocked() {
  showToast("Sound themes are available in Pro");
  document.dispatchEvent(
    new CustomEvent(APP_EVENTS.PRO_PAYWALL_REQUESTED, {
      detail: { feature: "sound_themes" },
    }),
  );
}

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
      // Free baseline: classic.
      if (newTheme !== "classic" && !appProManager.canUse("sound_themes")) {
        notifySoundThemeProLocked();
        sm.soundThemeSelect?.setValue(sm.theme || "classic", false);
        return;
      }

      sm.theme = newTheme;
      safeSetLS(STORAGE_KEYS.APP_SOUND_THEME, sm.theme);
      sm.play("click", { theme: newTheme });
    },
    sm.theme,
  );

  // If current saved theme is Pro-only and user has no access, fallback to classic.
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
}
