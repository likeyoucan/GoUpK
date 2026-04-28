// Файл: www/js/sound/sound-state.js

import { APP_EVENTS } from "../constants/events.js?v=VERSION";
import { STORAGE_KEYS } from "../constants/storage-keys.js?v=VERSION";

export function syncVolumeUI(sm, $, value = sm.volume) {
  const volumeSlider = $("volumeSlider");
  if (volumeSlider) volumeSlider.value = String(value);

  const display = $("volumeDisplay");
  if (display) display.textContent = `${Math.round(value * 100)}%`;
}

export function clearPreviewTimer(sm) {
  if (sm.volumePreviewTimer) {
    clearTimeout(sm.volumePreviewTimer);
    sm.volumePreviewTimer = null;
  }
}

export function schedulePreview(sm) {
  clearPreviewTimer(sm);
  if (!sm.soundEnabled || sm.volume <= 0) return;

  sm.volumePreviewTimer = setTimeout(() => {
    sm.play("click");
    sm.volumePreviewTimer = null;
  }, sm.VOLUME_PREVIEW_DELAY);
}

export function setSoundEnabled(
  sm,
  enabled,
  { $, safeSetLS, initAudio },
  { persist = true, restoreVolume = true } = {},
) {
  sm.soundEnabled = enabled;

  const toggle = $("toggle-sound");
  if (toggle) toggle.checked = enabled;

  if (!enabled) {
    if (sm.volume > 0) {
      sm.lastNonZeroVolume = sm.volume;
      safeSetLS(STORAGE_KEYS.APP_VOLUME_LAST_NON_ZERO, sm.lastNonZeroVolume);
    }

    sm.volume = 0;
    syncVolumeUI(sm, $, sm.volume);
  } else {
    if (restoreVolume) {
      const restored = sm.lastNonZeroVolume > 0 ? sm.lastNonZeroVolume : 1;
      sm.volume = restored;
    }

    syncVolumeUI(sm, $, sm.volume);
    initAudio();
  }

  if (persist) {
    safeSetLS(STORAGE_KEYS.APP_SOUND, sm.soundEnabled);
    safeSetLS(STORAGE_KEYS.APP_VOLUME, sm.volume);
  }
}

export function applySliderVolume(
  sm,
  rawValue,
  { $, safeSetLS, setSoundEnabled },
  { withPreview = false } = {},
) {
  const newVolume = Number.parseFloat(rawValue);
  if (!Number.isFinite(newVolume)) return;

  const prevVolume = sm.volume;
  sm.volume = newVolume;
  syncVolumeUI(sm, $, sm.volume);

  if (newVolume <= 0) {
    clearPreviewTimer(sm);

    if (prevVolume > 0) {
      sm.lastNonZeroVolume = prevVolume;
      safeSetLS(STORAGE_KEYS.APP_VOLUME_LAST_NON_ZERO, sm.lastNonZeroVolume);
    }

    if (sm.soundEnabled) {
      setSoundEnabled(false, { persist: true, restoreVolume: false });
    } else {
      safeSetLS(STORAGE_KEYS.APP_VOLUME, 0);
    }
    return;
  }

  sm.lastNonZeroVolume = newVolume;
  safeSetLS(STORAGE_KEYS.APP_VOLUME_LAST_NON_ZERO, sm.lastNonZeroVolume);

  if (!sm.soundEnabled) {
    setSoundEnabled(true, { persist: true, restoreVolume: false });
  } else {
    safeSetLS(STORAGE_KEYS.APP_VOLUME, newVolume);
  }

  if (withPreview) {
    schedulePreview(sm);
  }
}

export function applySettings(sm, { $, safeGetLS, safeSetLS }) {
  sm.soundEnabled = safeGetLS(STORAGE_KEYS.APP_SOUND) !== "false";
  sm.vibroEnabled = safeGetLS(STORAGE_KEYS.APP_VIBRO) !== "false";
  sm.vibroLevel = parseFloat(safeGetLS(STORAGE_KEYS.APP_VIBRO_LEVEL)) || 1;

  sm.volume =
    safeGetLS(STORAGE_KEYS.APP_VOLUME) !== null
      ? parseFloat(safeGetLS(STORAGE_KEYS.APP_VOLUME))
      : 1;

  sm.lastNonZeroVolume =
    safeGetLS(STORAGE_KEYS.APP_VOLUME_LAST_NON_ZERO) !== null
      ? parseFloat(safeGetLS(STORAGE_KEYS.APP_VOLUME_LAST_NON_ZERO))
      : 1;

  if (!Number.isFinite(sm.lastNonZeroVolume) || sm.lastNonZeroVolume <= 0) {
    sm.lastNonZeroVolume = 1;
  }

  if (sm.soundEnabled) {
    if (!Number.isFinite(sm.volume) || sm.volume <= 0) {
      sm.volume = sm.lastNonZeroVolume;
    }
  } else {
    if (Number.isFinite(sm.volume) && sm.volume > 0) {
      sm.lastNonZeroVolume = sm.volume;
      safeSetLS(STORAGE_KEYS.APP_VOLUME_LAST_NON_ZERO, sm.lastNonZeroVolume);
    }
    sm.volume = 0;
  }

  sm.theme = safeGetLS(STORAGE_KEYS.APP_SOUND_THEME) || "classic";

  if ($("toggle-sound")) $("toggle-sound").checked = sm.soundEnabled;
  if ($("toggle-vibro")) $("toggle-vibro").checked = sm.vibroEnabled;

  if ($("vibroSlider")) {
    const levels = [0.5, 0.75, 1, 1.5, 2];
    const closestIndex = levels.reduce(
      (p, c, i) =>
        Math.abs(c - sm.vibroLevel) < Math.abs(levels[p] - sm.vibroLevel)
          ? i
          : p,
      0,
    );
    $("vibroSlider").value = closestIndex;
  }

  syncVolumeUI(sm, $, sm.volume);

  if (sm.soundThemeSelect) {
    sm.soundThemeSelect.setValue(sm.theme, false);
  }

  updateVolumeUI($);

  document.dispatchEvent(
    new CustomEvent(APP_EVENTS.VIBRO_TOGGLED, {
      detail: { enabled: sm.vibroEnabled },
    }),
  );
}

export function resetSettings(sm, { safeRemoveLS, applySettings, initAudio }) {
  const soundKeys = [
    STORAGE_KEYS.APP_SOUND,
    STORAGE_KEYS.APP_VIBRO,
    STORAGE_KEYS.APP_VIBRO_LEVEL,
    STORAGE_KEYS.APP_SOUND_THEME,
    STORAGE_KEYS.APP_VOLUME,
    STORAGE_KEYS.APP_VOLUME_LAST_NON_ZERO,
  ];

  soundKeys.forEach(safeRemoveLS);

  sm.soundEnabled = true;
  sm.vibroEnabled = true;
  sm.vibroLevel = 1;
  sm.volume = 1;
  sm.lastNonZeroVolume = 1;
  sm.theme = "classic";

  clearPreviewTimer(sm);

  applySettings();
  initAudio();
}

export function updateVolumeUI($) {
  const volSlider = $("volumeSlider");
  if (!volSlider) return;

  volSlider.disabled = false;
  const parentContainer = volSlider.closest(".p-4");
  if (parentContainer) parentContainer.classList.remove("is-disabled");
}
