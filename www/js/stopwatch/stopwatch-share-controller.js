// Файл: www/js/stopwatch/stopwatch-share-controller.js

import { t } from "../i18n.js?v=VERSION";
import { modalManager } from "../modal.js?v=VERSION";
import { uiSettingsManager } from "../ui-settings.js?v=VERSION";

export function setupStopwatchShareController(sw) {
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
    await sw.shareSessionWithChoice(session);
  };

  sw.shareSavedSession = async (id) => {
    const session = sw.savedSessions.find((s) => s.id === id);
    if (!session) return;
    await sw.shareSessionWithChoice(session);
  };

  sw.bindShareButtons = () => {
    sw.els.saveBtn?.addEventListener("click", () => sw.prepareSaveSession());
    sw.els.shareBtn?.addEventListener("click", () => sw.shareCurrentResult());

    sw.els.shareModeTextBtn?.addEventListener("click", async () => {
      const session = sw.pendingShareSession;
      if (!session) return;

      const payload = sw.shareResults.buildStopwatchPayload(session, {
        showMs: uiSettingsManager.showMs,
      });

      await sw.shareResults.shareAsText(payload);
      sw.pendingShareSession = null;
      modalManager.closeCurrent();
    });

    sw.els.shareModeCsvBtn?.addEventListener("click", async () => {
      const session = sw.pendingShareSession;
      if (!session) return;

      const payload = sw.shareResults.buildStopwatchPayload(session, {
        showMs: uiSettingsManager.showMs,
      });

      await sw.shareResults.shareAsFile(payload, { format: "csv" });
      sw.pendingShareSession = null;
      modalManager.closeCurrent();
    });
  };
}