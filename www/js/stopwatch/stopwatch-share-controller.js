// Файл: www/js/stopwatch/stopwatch-share-controller.js

import { t } from "../i18n.js?v=VERSION";
import { modalManager } from "../modal.js?v=VERSION";
import { uiSettingsManager } from "../ui-settings.js?v=VERSION";
import { adsManager } from "../ads.js?v=VERSION";

export function setupStopwatchShareController(sw) {
  sw._unbindShareController?.();
  sw._unbindShareController = null;

  const disposers = [];
  const bind = (el, event, handler, options) => {
    if (!el) return;
    el.addEventListener(event, handler, options);
    disposers.push(() => el.removeEventListener(event, handler, options));
  };

  sw._buildSessionLapsForSave = () => {
    let sessionLaps = [...sw.laps];
    const lastLapTotal = sw.laps.length > 0 ? sw.laps[0].total : 0;

    if (sw.elapsedTime > lastLapTotal) {
      const diff = sw.elapsedTime - lastLapTotal;
      if (diff > 10) {
        sessionLaps.unshift({
          total: sw.elapsedTime,
          diff,
          index: sessionLaps.length + 1,
        });
      }
    }

    return sessionLaps;
  };

  sw.getCurrentSessionForShare = () => {
    if (sw.laps.length === 0) return null;

    return {
      id: Date.now(),
      name: t("stopwatch"),
      date: sw.isRunning ? Date.now() : sw.pauseTime || Date.now(),
      totalTime: sw.elapsedTime,
      laps: sw._buildSessionLapsForSave(),
    };
  };

  sw.shareSessionWithChoice = async (session) => {
    sw.pendingShareSession = session;
    modalManager.open("sw-share-mode-modal");
  };

  sw.shareCurrentResult = async () => {
    const session = sw.getCurrentSessionForShare();
    if (!session) return;

    adsManager.showInterstitialIfAllowed("share");
    await sw.shareSessionWithChoice(session);
  };

  sw.shareSavedSession = async (id) => {
    const session = sw.savedSessions.find((s) => s.id === id);
    if (!session) return;

    adsManager.showInterstitialIfAllowed("share");
    await sw.shareSessionWithChoice(session);
  };

  const onSaveClick = () => sw.prepareSaveSession();
  const onShareClick = () => sw.shareCurrentResult();

  const onShareTextClick = async () => {
    const session = sw.pendingShareSession;
    if (!session) return;

    const payload = sw.shareResults.buildStopwatchPayload(session, {
      showMs: uiSettingsManager.showMs,
    });

    await sw.shareResults.shareAsText(payload);
    sw.pendingShareSession = null;
    modalManager.closeCurrent();
  };

  const onShareCsvClick = async () => {
    const session = sw.pendingShareSession;
    if (!session) return;

    const payload = sw.shareResults.buildStopwatchPayload(session, {
      showMs: uiSettingsManager.showMs,
    });

    await sw.shareResults.shareAsFile(payload, { format: "csv" });
    sw.pendingShareSession = null;
    modalManager.closeCurrent();
  };

  sw.bindShareButtons = () => {
    bind(sw.els.saveBtn, "click", onSaveClick);
    bind(sw.els.shareBtn, "click", onShareClick);
    bind(sw.els.shareModeTextBtn, "click", onShareTextClick);
    bind(sw.els.shareModeCsvBtn, "click", onShareCsvClick);
  };

  sw._unbindShareController = () => {
    disposers.forEach((off) => {
      try {
        off?.();
      } catch (err) {
        console.error("[stopwatch-share-controller.dispose]", err);
      }
    });
  };
}
