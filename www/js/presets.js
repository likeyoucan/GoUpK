// Файл: www/js/presets.js

import { safeGetLS, safeSetLS } from "./utils.js?v=VERSION";
import { t } from "./i18n.js?v=VERSION";

const PRESETS_KEY = "timer_presets_v1";

function makeId() {
  return `tp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizePreset(raw) {
  return {
    id: raw?.id || makeId(),
    name: String(raw?.name || t("timer")),
    durationMs: Math.max(1000, Number(raw?.durationMs) || 30000),
    type: raw?.type || "countdown",
    meta: raw?.meta && typeof raw.meta === "object" ? raw.meta : {},
  };
}

function defaultPresets() {
  return [
    {
      id: "preset_pomodoro_25_5",
      name: "Pomodoro 25/5",
      durationMs: 25 * 60 * 1000,
      type: "pomodoro",
      meta: { restMs: 5 * 60 * 1000 },
    },
    {
      id: "preset_emom_1m",
      name: "EMOM 1:00",
      durationMs: 60 * 1000,
      type: "emom",
      meta: {},
    },
    {
      id: "preset_quick_30s",
      name: "Quick 30s",
      durationMs: 30 * 1000,
      type: "countdown",
      meta: {},
    },
  ];
}

function splitHMS(ms) {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return { h, m, s };
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

export const presets = {
  getTimerPresets() {
    try {
      const stored = safeGetLS(PRESETS_KEY);
      if (!stored) return defaultPresets();
      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed) || parsed.length === 0) return defaultPresets();
      return parsed.map(normalizePreset);
    } catch {
      return defaultPresets();
    }
  },

  saveTimerPresets(list) {
    const normalized = Array.isArray(list) ? list.map(normalizePreset) : [];
    safeSetLS(PRESETS_KEY, JSON.stringify(normalized));
  },

  ensureDefaultPresets() {
    const list = this.getTimerPresets();
    if (!Array.isArray(list) || list.length === 0) {
      this.saveTimerPresets(defaultPresets());
      return defaultPresets();
    }
    // если старые данные не содержат дефолты, не форсим, оставляем user data
    return list;
  },

  createPreset(preset) {
    const list = this.getTimerPresets();
    const next = [...list, normalizePreset(preset)];
    this.saveTimerPresets(next);
    return next;
  },

  updatePreset(id, patch) {
    const list = this.getTimerPresets();
    const next = list.map((p) => {
      if (p.id !== id) return p;
      return normalizePreset({ ...p, ...patch });
    });
    this.saveTimerPresets(next);
    return next;
  },

  deletePreset(id) {
    const list = this.getTimerPresets();
    const next = list.filter((p) => p.id !== id);
    this.saveTimerPresets(next);
    return next;
  },

  applyPresetToTimer(preset, tm) {
    if (!preset || !tm?.els) return;
    const { h, m, s } = splitHMS(preset.durationMs);

    if (tm.els.h) tm.els.h.value = pad2(h);
    if (tm.els.m) tm.els.m.value = pad2(m);
    if (tm.els.s) tm.els.s.value = pad2(s);

    tm.totalDuration = preset.durationMs;
    tm.isPaused = false;
    tm.remainingAtPause = 0;
  },
};