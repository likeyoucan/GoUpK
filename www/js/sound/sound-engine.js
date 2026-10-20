// Файл: www/js/sound/sound-engine.js

export function initAudio(sm) {
  if (sm.audioCtx || !sm.soundEnabled) return;

  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    sm.audioCtx = new AudioContext();

    // Master bus for smooth global mix control.
    sm.masterGain = sm.audioCtx.createGain();
    sm.masterGain.gain.value = 1;

    // Soft compressor to prevent harsh peaks/click-like overload artifacts.
    sm.masterCompressor = sm.audioCtx.createDynamicsCompressor();
    const now = sm.audioCtx.currentTime;
    sm.masterCompressor.threshold.setValueAtTime(-18, now);
    sm.masterCompressor.knee.setValueAtTime(18, now);
    sm.masterCompressor.ratio.setValueAtTime(3.5, now);
    sm.masterCompressor.attack.setValueAtTime(0.003, now);
    sm.masterCompressor.release.setValueAtTime(0.12, now);

    sm.masterGain.connect(sm.masterCompressor);
    sm.masterCompressor.connect(sm.audioCtx.destination);

    sm._activeVoices = 0;
    sm._maxVoices = 14;
    sm._lastPlayAt = Object.create(null);
    sm._duckReleaseTimer = 0;
    sm._busyUntil = 0;
  } catch {
    sm.soundEnabled = false;
  }
}

export function unlockAudio(sm) {
  if (sm.audioCtx && sm.audioCtx.state === "suspended") {
    sm.audioCtx.resume().catch(() => {});
  }
}

let __lastVibrateAt = 0;
const VIBRATE_MIN_INTERVAL_BY_TYPE = {
  tactile: 95,
  light: 55,
  medium: 36,
  strong: 0,
};

function pickNearestLevel(level) {
  const levels = [0.5, 0.75, 1, 1.5, 2];
  const raw = Number(level || 1);
  return levels.reduce((prev, cur) =>
    Math.abs(cur - raw) < Math.abs(prev - raw) ? cur : prev,
  );
}

export function vibrate(sm, basePattern, intensityKey = "medium") {
  if (!sm.vibroEnabled || !navigator.vibrate) return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) return;

  const now = performance.now();
  const throttleMs =
    VIBRATE_MIN_INTERVAL_BY_TYPE[intensityKey] ??
    VIBRATE_MIN_INTERVAL_BY_TYPE.medium;

  if (throttleMs > 0 && now - __lastVibrateAt < throttleMs) return;
  __lastVibrateAt = now;

  try {
    const typeMultiplierMap = {
      ui: 0.82,
      tactile: 0.26,
      light: 0.42,
      medium: 0.72,
      strong: 1.15,
    };

    const levelProfileMap = {
      0.5: { amp: 0.36, minPulse: 3 },
      0.75: { amp: 0.52, minPulse: 5 },
      1: { amp: 0.8, minPulse: 8 },
      1.5: { amp: 1.2, minPulse: 12 },
      2: { amp: 1.65, minPulse: 16 },
    };

    const lvl = pickNearestLevel(sm.vibroLevel);
    const levelProfile = levelProfileMap[lvl] || levelProfileMap[1];
    const typeMul = typeMultiplierMap[intensityKey] || typeMultiplierMap.medium;

    const finalMul = typeMul * levelProfile.amp;
    const minPulse = levelProfile.minPulse;

    const scalePulse = (duration) => {
      const raw = Math.round((Number(duration) || 0) * finalMul);
      return Math.max(minPulse, Math.min(90, raw));
    };

    const scalePause = (duration) => {
      const raw = Math.round((Number(duration) || 0) * 1.02);
      return Math.max(1, Math.min(120, raw));
    };

    const pattern = Array.isArray(basePattern)
      ? basePattern.map((d, i) => (i % 2 === 0 ? scalePulse(d) : scalePause(d)))
      : scalePulse(basePattern);

    navigator.vibrate(pattern);
  } catch {}
}

export function playNote(
  sm,
  freq,
  type,
  startTimeOffset,
  duration,
  volMultiplier = 1,
  slideToFreq = null,
  sustain = false,
) {
  if (!sm.audioCtx || !sm.masterGain) return;

  const maxVoices = Number(sm._maxVoices || 14);
  const activeVoices = Number(sm._activeVoices || 0);

  const isUiFx = type === "sine" || type === "square" || type === "triangle";
  const isLongCue = sustain || duration >= 0.35;

  if (activeVoices >= maxVoices && !isLongCue) return;
  if (activeVoices >= maxVoices - 2 && !isLongCue && isUiFx) return;

  const osc = sm.audioCtx.createOscillator();
  const gainNode = sm.audioCtx.createGain();

  osc.type = type;
  osc.connect(gainNode);
  gainNode.connect(sm.masterGain);

  const now = sm.audioCtx.currentTime;
  const startTime = now + startTimeOffset;
  const peakVol = 0.95 * sm.volume * volMultiplier;

  // Softer envelope to reduce click artifacts under high event density.
  const safeDuration = Math.max(0.035, Number(duration) || 0.05);
  const attack = Math.min(0.012, safeDuration * 0.18);
  const release = Math.min(0.02, safeDuration * 0.28);
  const sustainFrom = startTime + attack;
  const releaseAt = startTime + safeDuration - release;
  const stopAt = startTime + safeDuration + 0.008;

  gainNode.gain.cancelScheduledValues(startTime);
  gainNode.gain.setValueAtTime(0.0001, startTime);
  gainNode.gain.linearRampToValueAtTime(peakVol, sustainFrom);
  gainNode.gain.setValueAtTime(peakVol, Math.max(sustainFrom, releaseAt));
  gainNode.gain.linearRampToValueAtTime(0.0001, startTime + safeDuration);

  osc.frequency.setValueAtTime(freq, startTime);

  if (slideToFreq) {
    if (sustain) {
      osc.frequency.linearRampToValueAtTime(
        slideToFreq,
        startTime + safeDuration * 0.4,
      );
      osc.frequency.linearRampToValueAtTime(
        slideToFreq,
        startTime + safeDuration,
      );
    } else {
      osc.frequency.exponentialRampToValueAtTime(
        slideToFreq,
        startTime + safeDuration,
      );
    }
  }

  sm._activeVoices = activeVoices + 1;

  osc.onended = () => {
    osc.disconnect();
    gainNode.disconnect();
    sm._activeVoices = Math.max(0, (sm._activeVoices || 1) - 1);
  };

  osc.start(startTime);
  osc.stop(stopAt);
}

function shouldThrottleType(sm, type) {
  const now = performance.now();
  const minGapMsByType = {
    click: 80,
    tick: 140,
    minute_beep: 500,
    work_start: 450,
    rest_start: 450,
    complete: 1800,
  };

  const minGap = minGapMsByType[type] ?? 0;
  const last = Number(sm._lastPlayAt?.[type] || 0);

  if (minGap > 0 && now - last < minGap) {
    return true;
  }

  if (!sm._lastPlayAt) sm._lastPlayAt = Object.create(null);
  sm._lastPlayAt[type] = now;
  return false;
}

function applySoftDucking(sm, type) {
  if (!sm.audioCtx || !sm.masterGain) return;

  const nowCtx = sm.audioCtx.currentTime;
  const isPriority =
    type === "work_start" || type === "rest_start" || type === "complete";
  if (!isPriority) return;

  if (sm._duckReleaseTimer) {
    clearTimeout(sm._duckReleaseTimer);
    sm._duckReleaseTimer = 0;
  }

  const g = sm.masterGain.gain;
  const current = g.value;

  g.cancelScheduledValues(nowCtx);
  g.setValueAtTime(current, nowCtx);
  g.linearRampToValueAtTime(0.82, nowCtx + 0.035);
  g.linearRampToValueAtTime(0.92, nowCtx + 0.18);

  sm._duckReleaseTimer = setTimeout(() => {
    if (!sm.audioCtx || !sm.masterGain) return;
    const t = sm.audioCtx.currentTime;
    const gg = sm.masterGain.gain;
    gg.cancelScheduledValues(t);
    gg.setValueAtTime(gg.value, t);
    gg.linearRampToValueAtTime(1, t + 0.14);
    sm._duckReleaseTimer = 0;
  }, 170);
}

export function play(sm, type, options = {}) {
  if (!sm.soundEnabled || !sm.audioCtx || sm.volume === 0) return;

  const now = performance.now();
  const isUiFx = type === "click" || type === "tick" || type === "minute_beep";

  // During priority cues, skip UI FX to avoid noisy overlap.
  if (isUiFx && now < Number(sm._busyUntil || 0)) return;

  if (shouldThrottleType(sm, type)) return;

  unlockAudio(sm);
  applySoftDucking(sm, type);

  const activeTheme = options.theme || sm.theme;
  const vol = sm.THEME_VOL_MULTIPLIERS[activeTheme] || 1.0;

  const isBusy = now < Number(sm._busyUntil || 0);
  const uiClickMix = isBusy && type === "click" ? 0.45 : 1;

  if (activeTheme === "classic") {
    if (type === "click") {
      playNote(sm, 2000, "sine", 0, 0.05, 0.4 * uiClickMix);
    } else if (type === "tick") {
      playNote(sm, 2500, "square", 0, 0.05, 0.3);
    } else if (type === "work_start") {
      playNote(sm, 2500, "sine", 0, 0.1, 0.4);
      playNote(sm, 2500, "sine", 0.5, 0.1, 0.4);
      playNote(sm, 2500, "sine", 1, 0.1, 0.4);
      playNote(sm, 3000, "sine", 1.5, 0.6, 0.6);
    } else if (type === "rest_start") {
      playNote(sm, 2500, "sine", 0, 0.1, 0.5);
      playNote(sm, 1500, "sine", 0.15, 0.5, 0.6);
    } else if (type === "complete") {
      playNote(sm, 2500, "square", 0, 0.06, 0.4);
      playNote(sm, 2500, "square", 0.1, 0.06, 0.4);
      playNote(sm, 2500, "square", 0.2, 0.06, 0.4);
      playNote(sm, 2500, "square", 0.6, 0.06, 0.4);
      playNote(sm, 2500, "square", 0.7, 0.06, 0.4);
      playNote(sm, 2500, "square", 0.8, 0.06, 0.4);
      playNote(sm, 2500, "square", 1.2, 0.06, 0.4);
      playNote(sm, 2500, "square", 1.3, 0.06, 0.4);
      playNote(sm, 2500, "square", 1.4, 0.06, 0.4);
    } else if (type === "minute_beep") {
      playNote(sm, 1500, "sine", 0, 0.1, 0.7);
    }
  } else if (activeTheme === "sport") {
    if (type === "click") {
      playNote(sm, 1200, "sine", 0, 0.05, 0.2 * vol * uiClickMix, 200, true);
    } else if (type === "tick") {
      playNote(sm, 1500, "sine", 0, 0.1, 0.2 * vol, 300, true);
    } else if (type === "work_start") {
      playNote(sm, 2500, "sine", 0, 0.3, 0.2 * vol, 100);
      playNote(sm, 1000, "sine", 0, 0.3, 0.15 * vol, 50, true);
    } else if (type === "rest_start") {
      playNote(sm, 1200, "sine", 0, 0.3, 0.2 * vol, 100, true);
      playNote(sm, 600, "sine", 0, 0.3, 0.2 * vol, 50);
    } else if (type === "complete") {
      playNote(sm, 2500, "sine", 0, 0.25, 0.15 * vol, 100);
      playNote(sm, 1000, "sine", 0, 0.25, 0.2 * vol, 50);
      playNote(sm, 2500, "sine", 0.35, 0.25, 0.15 * vol, 100);
      playNote(sm, 1000, "sine", 0.35, 0.25, 0.1 * vol, 50);
      playNote(sm, 3500, "triangle", 0.7, 0.8, 0.15 * vol, 100);
      playNote(sm, 1500, "sine", 0.7, 0.8, 0.2 * vol, 50);
      playNote(sm, 300, "sine", 0.7, 0.8, 0.1 * vol, 20, true);
    } else if (type === "minute_beep") {
      playNote(sm, 2000, "sine", 0, 0.08, 0.8 * vol);
    }
  } else if (activeTheme === "vibe") {
    if (type === "click") {
      playNote(sm, 300, "sine", 0, 0.1, 0.5 * vol * uiClickMix);
    } else if (type === "tick") {
      playNote(sm, 400, "sine", 0, 0.15, 0.5 * vol);
    } else if (type === "work_start") {
      playNote(sm, 261.63, "sine", 0, 1.5, 0.4 * vol);
      playNote(sm, 329.63, "sine", 0, 1.5, 0.1 * vol);
      playNote(sm, 392, "sine", 0, 1.5, 0.3 * vol);
    } else if (type === "rest_start") {
      playNote(sm, 392, "sine", 0, 1, 0.4 * vol);
      playNote(sm, 329.63, "sine", 0.1, 1, 0.3 * vol);
      playNote(sm, 261.63, "sine", 0.2, 1.5, 0.4 * vol);
    } else if (type === "complete") {
      playNote(sm, 261.63, "sine", 0, 3, 0.2 * vol);
      playNote(sm, 329.63, "sine", 0.1, 3, 0.3 * vol);
      playNote(sm, 392, "sine", 0.2, 3, 0.3 * vol);
      playNote(sm, 493.88, "sine", 0.3, 3, 0.15 * vol);
    } else if (type === "minute_beep") {
      playNote(sm, 500, "sine", 0, 1.5, 0.4 * vol);
    }
  } else if (activeTheme === "work") {
    if (type === "click") {
      playNote(sm, 500, "sine", 0, 0.03, 0.4 * vol * uiClickMix);
    } else if (type === "tick") {
      playNote(sm, 700, "sine", 0, 0.05, 0.3 * vol);
    } else if (type === "work_start") {
      playNote(sm, 880, "sine", 0, 1.5, 0.3 * vol);
      playNote(sm, 1760, "sine", 0, 0.5, 0.15 * vol);
    } else if (type === "rest_start") {
      playNote(sm, 523.25, "sine", 0, 1.5, 0.2 * vol);
      playNote(sm, 261.63, "sine", 0, 2.5, 0.4 * vol);
    } else if (type === "complete") {
      playNote(sm, 880, "sine", 0, 1, 0.2 * vol);
      playNote(sm, 783.99, "sine", 0.4, 1, 0.2 * vol);
      playNote(sm, 659.25, "sine", 0.8, 2, 0.2 * vol);
    } else if (type === "minute_beep") {
      playNote(sm, 880, "sine", 0, 0.07, 0.3 * vol);
    }
  } else if (activeTheme === "life") {
    if (type === "click") {
      playNote(sm, 440, "sine", 0, 0.08, 0.4 * vol * uiClickMix);
    } else if (type === "tick") {
      playNote(sm, 523.25, "sine", 0, 0.1, 0.4 * vol);
    } else if (type === "work_start") {
      playNote(sm, 523.25, "sine", 0, 0.2, 0.4 * vol);
      playNote(sm, 659.25, "sine", 0.12, 0.2, 0.4 * vol);
      playNote(sm, 783.99, "sine", 0.24, 0.2, 0.4 * vol);
      playNote(sm, 1046.5, "sine", 0.36, 0.6, 0.45 * vol);
    } else if (type === "rest_start") {
      playNote(sm, 392, "sine", 0, 0.15, 0.4 * vol);
      playNote(sm, 523.25, "sine", 0.15, 0.6, 0.5 * vol);
    } else if (type === "complete") {
      playNote(sm, 523.25, "triangle", 0, 0.15, 0.4 * vol);
      playNote(sm, 523.25, "triangle", 0.15, 0.15, 0.4 * vol);
      playNote(sm, 523.25, "triangle", 0.3, 0.15, 0.4 * vol);
      playNote(sm, 659.25, "triangle", 0.45, 0.4, 0.4 * vol);
      playNote(sm, 587.33, "triangle", 0.85, 0.15, 0.4 * vol);
      playNote(sm, 659.25, "triangle", 1, 1, 0.5 * vol);
    } else if (type === "minute_beep") {
      playNote(sm, 783.99, "sine", 0, 0.15, 0.4 * vol);
    }
  }

  if (type === "work_start" || type === "rest_start") {
    sm._busyUntil = performance.now() + 800;
  }
  if (type === "complete") {
    sm._busyUntil = performance.now() + 1800;
  }
}
