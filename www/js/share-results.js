// Файл: www/js/share-results.js

import { formatTime, showToast } from "./utils.js?v=VERSION";
import { t } from "./i18n.js?v=VERSION";

import {
  buildStopwatchPayload,
  buildStopwatchText,
  buildStopwatchCsv,
  makeFilename,
} from "./share/share-builders.js?v=VERSION";

import {
  isUserShareCancel,
  downloadFile,
  copyToClipboard,
} from "./share/share-transport.js?v=VERSION";

function getShareFileFailedText() {
  const key = t("share_file_failed");
  return key === "share_file_failed" ? t("share_failed") : key;
}

export const shareResults = {
  canShowShareButton(lapsCount) {
    return Number(lapsCount) > 0;
  },

  buildStopwatchPayload(session, options = {}) {
    return buildStopwatchPayload(session, formatTime, t, options);
  },

  async shareAsText(payload) {
    const text = buildStopwatchText(payload, t);

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Stopwatch Pro - ${payload.name}`,
          text,
        });
        return true;
      } catch (error) {
        if (isUserShareCancel(error)) return false;
      }
    }

    const copied = await copyToClipboard(text);
    if (copied) {
      showToast(t("share_copied"));
      return true;
    }

    showToast(t("share_failed"));
    return false;
  },

  async shareAsFile(payload, { format = "csv" } = {}) {
    if (format !== "csv") {
      showToast(getShareFileFailedText());
      return false;
    }

    const csv = buildStopwatchCsv(payload, t);
    const fileName = makeFilename(payload, "csv");

    const bom = "\uFEFF";
    const blob = new Blob([bom, csv], { type: "text/csv;charset=utf-8;" });
    const file = new File([blob], fileName, {
      type: "text/csv;charset=utf-8;",
    });

    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({
          title: `Stopwatch Pro - ${payload.name}`,
          text: payload.totalTimeText,
          files: [file],
        });
        return true;
      } catch (error) {
        if (isUserShareCancel(error)) return false;
        showToast(getShareFileFailedText());
        return false;
      }
    }

    try {
      downloadFile(blob, fileName);
      showToast(t("share_file_saved"));
      return true;
    } catch {
      showToast(getShareFileFailedText());
      return false;
    }
  },
};
