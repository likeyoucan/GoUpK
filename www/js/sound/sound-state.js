// Файл: www/js/sound/sound-state.js

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
      safeSetLS("app_volume_last_non_zero", sm.lastNonZeroVolume);
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
    safeSetLS("app_sound", sm.soundEnabled);
    safeSetLS("app_volume", sm.volume);
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
      safeSetLS("app_volume_last_non_zero", sm.lastNonZeroVolume);
    }

    if (sm.soundEnabled) {
      setSoundEnabled(false, { persist: true, restoreVolume: false });
    } else {
      safeSetLS("app_volume", 0);
    }
    return;
  }

  sm.lastNonZeroVolume = newVolume;
  safeSetLS("app_volume_last_non_zero", sm.lastNonZeroVolume);

  if (!sm.soundEnabled) {
    setSoundEnabled(true, { persist: true, restoreVolume: false });
  } else {
    safeSetLS("app_volume", newVolume);
  }

  if (withPreview) {
    schedulePreview(sm);
  }
}

export function applySettings(sm, { $, safeGetLS, safeSetLS }) {
  sm.soundEnabled = safeGetLS("app_sound") !== "false";
  sm.vibroEnabled = safeGetLS("app_vibro") !== "false";
  sm.vibroLevel = parseFloat(safeGetLS("app_vibro_level")) || 1;

  sm.volume =
    safeGetLS("app_volume") !== null ? parseFloat(safeGetLS("app_volume")) : 1;

  sm.lastNonZeroVolume =
    safeGetLS("app_volume_last_non_zero") !== null
      ? parseFloat(safeGetLS("app_volume_last_non_zero"))
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
      safeSetLS("app_volume_last_non_zero", sm.lastNonZeroVolume);
    }
    sm.volume = 0;
  }

  sm.theme = safeGetLS("app_sound_theme") || "classic";

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
    new CustomEvent("vibroToggled", { detail: { enabled: sm.vibroEnabled } }),
  );
}

export function resetSettings(sm, { safeRemoveLS, applySettings, initAudio }) {
  const soundKeys = [
    "app_sound",
    "app_vibro",
    "app_vibro_level",
    "app_sound_theme",
    "app_volume",
    "app_volume_last_non_zero",
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
