import { safeGetLS, safeSetLS, showToast } from "./utils.js?v=VERSION";
import { t } from "./i18n.js?v=VERSION";

const APP_ID = "StopwatchPro";
const SCHEMA_VERSION = 1;

const KEYS = {
  // settings
  appLang: "app_lang",
  themeMode: "theme_mode",
  themeColor: "theme_color",
  themeBgColor: "theme_bg_color",
  appShowMs: "app_show_ms",
  appShowForegroundBanner: "app_show_foreground_banner",
  appHideNavLabels: "app_hide_nav_labels",
  appAdaptiveBg: "app_adaptive_bg",
  appVignette: "app_vignette",
  appVignetteAlpha: "app_vignette_alpha",
  appLiquidGlass: "app_liquid_glass",
  appRingWidth: "app_ring_width",
  fontSize: "font_size",
  appSwMinuteBeep: "app_sw_minute_beep",

  // sound
  appSound: "app_sound",
  appVibro: "app_vibro",
  appVibroLevel: "app_vibro_level",
  appSoundTheme: "app_sound_theme",
  appVolume: "app_volume",
  appVolumeLastNonZero: "app_volume_last_non_zero",

  // stopwatch
  swSavedSessions: "sw_saved_sessions",

  // tabata
  tbWorkouts: "tb_workouts",
  tbSelectedId: "tb_selected_id",

  // timer
  timerPresets: "timer_presets_v1",
  timerFinishAction: "timer_finish_action",
  timerRestDurationMs: "timer_rest_duration_ms",

  // history
  activityHistory: "activity_history_v1",
};

const EXPORT_KEYS = Object.values(KEYS);

function parseMaybeJson(value) {
  if (value == null) return null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function toStorable(value) {
  if (value == null) return null;
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

function isObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function downloadTextFile(filename, text, mime = "application/json;charset=utf-8;") {
  const blob = new Blob(["\uFEFF", text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

function nowStamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

export const backupManager = {
  buildBackupObject() {
    const data = {};

    EXPORT_KEYS.forEach((key) => {
      const raw = safeGetLS(key);
      data[key] = parseMaybeJson(raw);
    });

    return {
      app: APP_ID,
      version: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      data,
    };
  },

  exportBackup() {
    const payload = this.buildBackupObject();
    const text = JSON.stringify(payload, null, 2);
    const fileName = `stopwatchpro_backup_${nowStamp()}.json`;
    downloadTextFile(fileName, text);
    showToast(t("share_file_saved") || "Backup downloaded");
  },

  validateBackupObject(obj) {
    const errors = [];

    if (!isObject(obj)) {
      errors.push("Payload is not an object");
      return { ok: false, errors };
    }

    if (obj.app !== APP_ID) {
      errors.push(`Invalid app id: expected "${APP_ID}"`);
    }

    if (typeof obj.version !== "number") {
      errors.push("Missing or invalid version");
    }

    if (!isObject(obj.data)) {
      errors.push("Missing or invalid data object");
    }

    return { ok: errors.length === 0, errors };
  },

  parseBackupText(text) {
    try {
      return { ok: true, value: JSON.parse(text) };
    } catch (e) {
      return { ok: false, error: e };
    }
  },

  dryRunImport(obj, mode = "merge") {
    const validation = this.validateBackupObject(obj);
    if (!validation.ok) {
      return {
        ok: false,
        errors: validation.errors,
        report: null,
      };
    }

    const incoming = obj.data || {};
    const report = {
      mode,
      keysIncoming: [],
      keysApply: [],
      keysSkip: [],
    };

    Object.keys(incoming).forEach((key) => {
      report.keysIncoming.push(key);

      if (!EXPORT_KEYS.includes(key)) {
        report.keysSkip.push(key);
        return;
      }

      const incomingValue = incoming[key];
      const hasExisting = safeGetLS(key) !== null;

      if (mode === "replace") {
        report.keysApply.push(key);
        return;
      }

      // merge mode
      if (incomingValue == null) {
        report.keysSkip.push(key);
        return;
      }

      // for arrays/objects: shallow merge policy = replace at key level
      if (!hasExisting) report.keysApply.push(key);
      else report.keysApply.push(key);
    });

    return { ok: true, errors: [], report };
  },

  importBackup(obj, { mode = "merge", dryRun = false } = {}) {
    const plan = this.dryRunImport(obj, mode);
    if (!plan.ok) return plan;
    if (dryRun) return plan;

    const incoming = obj.data || {};

    if (mode === "replace") {
      // clear known keys first
      EXPORT_KEYS.forEach((key) => {
        safeSetLS(key, "");
      });
    }

    Object.keys(incoming).forEach((key) => {
      if (!EXPORT_KEYS.includes(key)) return;

      const value = incoming[key];

      if (mode === "merge" && value == null) return;

      const storable = toStorable(value);
      if (storable === null) return;

      safeSetLS(key, storable);
    });

    return { ok: true, errors: [], report: plan.report };
  },
};