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

export function vibrate(sm, basePattern, intensityKey = "medium") {
  if (!sm.vibroEnabled || !navigator.vibrate) return;

  try {
    const intensityMap = {
      light: 0.7,
      medium: 1.0,
      strong: 1.4,
      tactile: 0.5,
    };

    const typeMultiplier = intensityMap[intensityKey] || 1;
    const levelMultiplier = sm.vibroLevel;
    const finalMultiplier = typeMultiplier * levelMultiplier;

    const applyLevel = (duration) => {
      const baseDuration = duration * 1.5;
      const newDuration = Math.round(baseDuration * finalMultiplier);
      return Math.max(1, Math.min(200, newDuration));
    };

    const pattern = Array.isArray(basePattern)
      ? basePattern.map(applyLevel)
      : applyLevel(basePattern);

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
    if (type === "click") playNote(sm, 2000, "square", 0, 0.05, 0.2);
    else if (type === "tick") playNote(sm, 2500, "square", 0, 0.05, 0.3);
    else if (type === "work_start") {
      playNote(sm, 2500, "square", 0.0, 0.1, 0.4);
      playNote(sm, 2500, "square", 0.5, 0.1, 0.4);
      playNote(sm, 2500, "square", 1.0, 0.1, 0.4);
      playNote(sm, 3000, "square", 1.5, 0.6, 0.6);
    } else if (type === "rest_start") {
      playNote(sm, 2500, "square", 0.0, 0.1, 0.4);
      playNote(sm, 1500, "square", 0.15, 0.5, 0.5);
    } else if (type === "complete") {
      for (let i = 0; i < 3; i += 1) {
        const offset = i * 0.6;
        playNote(sm, 2500, "square", offset + 0.0, 0.06, 0.5);
        playNote(sm, 2500, "square", offset + 0.1, 0.06, 0.5);
        playNote(sm, 2500, "square", offset + 0.2, 0.06, 0.5);
      }
    } else if (type === "minute_beep") playNote(sm, 1500, "sine", 0, 0.1, 0.3);
  } else if (activeTheme === "sport") {
    if (type === "click")
      playNote(sm, 1200, "triangle", 0, 0.05, 0.25 * vol, 200);
    else if (type === "tick")
      playNote(sm, 1500, "triangle", 0, 0.1, 0.35 * vol, 300);
    else if (type === "work_start") {
      playNote(sm, 2500, "triangle", 0.0, 0.3, 0.7 * vol, 100);
      playNote(sm, 1000, "sine", 0.0, 0.3, 0.6 * vol, 50);
    } else if (type === "rest_start") {
      playNote(sm, 1200, "triangle", 0.0, 0.3, 0.5 * vol, 100);
      playNote(sm, 600, "sine", 0.0, 0.3, 0.6 * vol, 50);
    } else if (type === "complete") {
      const playSwoosh = (time, duration, isFinal = false) => {
        playNote(
          sm,
          isFinal ? 3500 : 2500,
          "triangle",
          time,
          duration,
          0.75 * vol,
          100,
        );
        playNote(
          sm,
          isFinal ? 1500 : 1000,
          "sine",
          time,
          duration,
          0.8 * vol,
          50,
        );
        if (isFinal) playNote(sm, 300, "square", time, duration, 0.4 * vol, 20);
      };
      playSwoosh(0.0, 0.25);
      playSwoosh(0.35, 0.25);
      playSwoosh(0.7, 0.8, true);
    } else if (type === "minute_beep")
      playNote(sm, 2000, "triangle", 0, 0.08, 0.5 * vol);
  } else if (activeTheme === "vibe") {
    if (type === "click") playNote(sm, 300, "sine", 0, 0.1, 0.5 * vol);
    else if (type === "tick") playNote(sm, 400, "sine", 0, 0.15, 0.6 * vol);
    else if (type === "work_start") {
      playNote(sm, 261.63, "sine", 0, 1.5, 0.7 * vol);
      playNote(sm, 329.63, "sine", 0, 1.5, 0.6 * vol);
      playNote(sm, 392.0, "sine", 0, 1.5, 0.6 * vol);
    } else if (type === "rest_start") {
      playNote(sm, 392.0, "sine", 0.0, 1.0, 0.5 * vol);
      playNote(sm, 329.63, "sine", 0.1, 1.0, 0.5 * vol);
      playNote(sm, 261.63, "sine", 0.2, 1.5, 0.6 * vol);
    } else if (type === "complete") {
      playNote(sm, 261.63, "sine", 0.0, 3.0, 0.7 * vol);
      playNote(sm, 329.63, "sine", 0.1, 3.0, 0.6 * vol);
      playNote(sm, 392.0, "sine", 0.2, 3.0, 0.6 * vol);
      playNote(sm, 493.88, "sine", 0.3, 3.0, 0.5 * vol);
    } else if (type === "minute_beep")
      playNote(sm, 1046.5, "sine", 0, 0.2, 0.6 * vol);
  } else if (activeTheme === "work") {
    if (type === "click") playNote(sm, 500, "sine", 0, 0.03, 0.3 * vol);
    else if (type === "tick") playNote(sm, 700, "sine", 0, 0.05, 0.3 * vol);
    else if (type === "work_start") {
      playNote(sm, 880, "sine", 0.0, 1.5, 0.5 * vol);
      playNote(sm, 1760, "sine", 0.0, 0.5, 0.15 * vol);
    } else if (type === "rest_start") {
      playNote(sm, 523.25, "sine", 0.0, 1.5, 0.5 * vol);
      playNote(sm, 261.63, "sine", 0.0, 2.5, 0.6 * vol);
    } else if (type === "complete") {
      playNote(sm, 880, "sine", 0.0, 1.0, 0.5 * vol);
      playNote(sm, 783.99, "sine", 0.4, 1.0, 0.5 * vol);
      playNote(sm, 659.25, "sine", 0.8, 2.0, 0.5 * vol);
    } else if (type === "minute_beep")
      playNote(sm, 880, "sine", 0, 0.07, 0.4 * vol);
  } else if (activeTheme === "life") {
    if (type === "click") playNote(sm, 440, "triangle", 0, 0.08, 0.35 * vol);
    else if (type === "tick")
      playNote(sm, 523.25, "triangle", 0, 0.1, 0.45 * vol);
    else if (type === "work_start") {
      playNote(sm, 523.25, "triangle", 0.0, 0.2, 0.5 * vol);
      playNote(sm, 659.25, "triangle", 0.12, 0.2, 0.5 * vol);
      playNote(sm, 783.99, "triangle", 0.24, 0.2, 0.5 * vol);
      playNote(sm, 1046.5, "triangle", 0.36, 0.6, 0.6 * vol);
    } else if (type === "rest_start") {
      playNote(sm, 392.0, "triangle", 0.0, 0.15, 0.5 * vol);
      playNote(sm, 523.25, "triangle", 0.15, 0.6, 0.7 * vol);
    } else if (type === "complete") {
      playNote(sm, 523.25, "triangle", 0.0, 0.15, 0.5 * vol);
      playNote(sm, 523.25, "triangle", 0.15, 0.15, 0.5 * vol);
      playNote(sm, 523.25, "triangle", 0.3, 0.15, 0.5 * vol);
      playNote(sm, 659.25, "triangle", 0.45, 0.4, 0.6 * vol);
      playNote(sm, 587.33, "triangle", 0.85, 0.15, 0.5 * vol);
      playNote(sm, 659.25, "triangle", 1.0, 1.0, 0.6 * vol);
    } else if (type === "minute_beep") {
      playNote(sm, 783.99, "triangle", 0, 0.15, 0.5 * vol);
    }
  }
}
