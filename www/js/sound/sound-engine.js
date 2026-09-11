// Файл: www/js/sound/sound-engine.js

export function initAudio(sm) {
  if (sm.audioCtx || !sm.soundEnabled) return;

  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) sm.audioCtx = new AudioContext();
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
  tactile: 85,
  light: 40,
  medium: 24,
  strong: 0,
};

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
    const intensityMap = {
      light: 0.52,
      medium: 0.7,
      strong: 0.98,
      tactile: 0.42,
    };

    const typeMultiplier = intensityMap[intensityKey] || 0.7;

    const rawLevel = Number(sm.vibroLevel || 1);
    const levelMap = new Map([
      [0.5, 0.44],
      [0.75, 0.62],
      [1, 0.82],
      [1.5, 1.14],
      [2, 1.52],
    ]);

    const nearestLevel = [0.5, 0.75, 1, 1.5, 2].reduce((prev, cur) =>
      Math.abs(cur - rawLevel) < Math.abs(prev - rawLevel) ? cur : prev,
    );
    const levelMultiplier = levelMap.get(nearestLevel) ?? 0.82;

    const globalSoftness = 0.72;
    const finalMultiplier = typeMultiplier * levelMultiplier * globalSoftness;

    const scalePulse = (duration) => {
      const d = Math.round((Number(duration) || 0) * finalMultiplier);
      return Math.max(1, Math.min(90, d));
    };

    const scalePause = (duration) => {
      const d = Math.round((Number(duration) || 0) * 1.05);
      return Math.max(1, Math.min(140, d));
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
  if (!sm.audioCtx) return;

  const osc = sm.audioCtx.createOscillator();
  const gainNode = sm.audioCtx.createGain();

  osc.type = type;
  osc.connect(gainNode);
  gainNode.connect(sm.audioCtx.destination);

  const now = sm.audioCtx.currentTime;
  const startTime = now + startTimeOffset;
  const peakVol = 0.95 * sm.volume * volMultiplier;

  gainNode.gain.setValueAtTime(0, startTime);

  if (sustain) {
    const attackTime = Math.min(0.05, duration * 0.1);
    const releaseTime = Math.min(0.05, duration * 0.1);
    gainNode.gain.linearRampToValueAtTime(peakVol, startTime + attackTime);
    gainNode.gain.linearRampToValueAtTime(
      peakVol,
      startTime + duration - releaseTime,
    );
    gainNode.gain.linearRampToValueAtTime(0.001, startTime + duration);
  } else {
    gainNode.gain.linearRampToValueAtTime(
      peakVol,
      startTime + Math.min(0.02, duration * 0.1),
    );
    gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  }

  osc.frequency.setValueAtTime(freq, startTime);

  if (slideToFreq) {
    if (sustain) {
      osc.frequency.linearRampToValueAtTime(
        slideToFreq,
        startTime + duration * 0.4,
      );
      osc.frequency.linearRampToValueAtTime(slideToFreq, startTime + duration);
    } else {
      osc.frequency.exponentialRampToValueAtTime(
        slideToFreq,
        startTime + duration,
      );
    }
  }

  osc.onended = () => {
    osc.disconnect();
    gainNode.disconnect();
  };

  osc.start(startTime);
  osc.stop(startTime + duration);
}

export function play(sm, type, options = {}) {
  if (!sm.soundEnabled || !sm.audioCtx || sm.volume === 0) return;

  unlockAudio(sm);

  const activeTheme = options.theme || sm.theme;
  const vol = sm.THEME_VOL_MULTIPLIERS[activeTheme] || 1.0;

  if (activeTheme === "classic") {
    if (type === "click") {
      playNote(sm, 2000, "sine", 0, 0.05, 0.4);
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
      playNote(sm, 1200, "sine", 0, 0.05, 0.2 * vol, 200, true);
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
      playNote(sm, 300, "sine", 0, 0.1, 0.5 * vol);
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
      playNote(sm, 500, "sine", 0, 0.03, 0.4 * vol);
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
      playNote(sm, 440, "sine", 0, 0.08, 0.4 * vol);
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
}
