// Файл: www/js/share-results.js

import { formatTime, showToast } from "./utils.js?v=VERSION";
import { t } from "./i18n.js?v=VERSION";
import { resolveToastText } from "./constants/toast-fallbacks.js?v=VERSION";

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
  return resolveToastText(t, "share_file_failed");
}

function getShareTextFailedText() {
  return resolveToastText(t, "share_failed");
}

async function saveCsvWithPicker(fileName, csvText) {
  if (typeof window.showSaveFilePicker !== "function") return false;

  try {
    const handle = await window.showSaveFilePicker({
      suggestedName: fileName,
      types: [
        {
          description: "CSV file",
          accept: { "text/csv": [".csv"] },
        },
      ],
    });

    const writable = await handle.createWritable();
    await writable.write(
      new Blob(["\uFEFF", csvText], { type: "text/csv;charset=utf-8;" }),
    );
    await writable.close();
    return true;
  } catch (error) {
    if (isUserShareCancel(error)) return false;
    throw error;
  }
}

function isNativePlatform() {
  try {
    return !!window.Capacitor?.isNativePlatform?.();
  } catch {
    return false;
  }
}

function getPlugins() {
  return window.Capacitor?.Plugins || {};
}

function getSharePlugin() {
  const p = getPlugins();
  return p.Share || null;
}

function getFilesystemPlugin() {
  const p = getPlugins();
  return p.Filesystem || null;
}

function normalizeShareText(text) {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function shareTextNative(payload, text) {
  const share = getSharePlugin();
  if (!share?.share) return { ok: false, reason: "share_plugin_missing" };

  try {
    await share.share({
      title: `Stopwatch Pro - ${payload.name}`,
      text,
      dialogTitle: t("share"),
    });
    return { ok: true };
  } catch (error) {
    if (isUserShareCancel(error)) return { ok: false, canceled: true };
    return { ok: false, error };
  }
}

async function writeCsvToNativeCache(fileName, csvText) {
  const fs = getFilesystemPlugin();
  if (!fs?.writeFile) return null;

  const path = `share/${fileName}`;
  const data = "\uFEFF" + csvText;

  const Directory = fs.Directory || { Cache: "CACHE" };
  const Encoding = fs.Encoding || { UTF8: "utf8" };

  try {
    await fs.writeFile({
      path,
      data,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
      recursive: true,
    });

    if (typeof fs.getUri === "function") {
      const uriRes = await fs.getUri({
        path,
        directory: Directory.Cache,
      });
      if (uriRes?.uri) return uriRes.uri;
    }

    const statRes = await fs.stat?.({
      path,
      directory: Directory.Cache,
    });

    if (statRes?.uri) return statRes.uri;
    return null;
  } catch (err) {
    console.warn("[share] writeCsvToNativeCache failed", err);
    return null;
  }
}

async function shareFileNative(payload, fileName, csvText) {
  const share = getSharePlugin();
  if (!share?.share) return { ok: false, reason: "share_plugin_missing" };

  const uri = await writeCsvToNativeCache(fileName, csvText);
  if (!uri) return { ok: false, reason: "file_uri_missing" };

  try {
    await share.share({
      title: `Stopwatch Pro - ${payload.name}`,
      text: payload.totalTimeText,
      url: uri,
      dialogTitle: t("share"),
    });
    return { ok: true };
  } catch (error) {
    if (isUserShareCancel(error)) return { ok: false, canceled: true };
    return { ok: false, error };
  }
}

export const shareResults = {
  canShowShareButton(lapsCount) {
    return Number(lapsCount) > 0;
  },

  buildStopwatchPayload(session, options = {}) {
    return buildStopwatchPayload(session, formatTime, t, options);
  },

  async shareAsText(payload) {
    const rawText = buildStopwatchText(payload, t);
    const text = normalizeShareText(rawText);

    if (isNativePlatform()) {
      const nativeResult = await shareTextNative(payload, text);
      if (nativeResult.ok) return true;
      if (nativeResult.canceled) return false;
    }

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

    showToast(getShareTextFailedText());
    return false;
  },

  async shareAsFile(payload, { format = "csv" } = {}) {
    if (format !== "csv") {
      showToast(getShareFileFailedText());
      return false;
    }

    const csv = buildStopwatchCsv(payload, t);
    const fileName = makeFilename(payload, "csv");

    if (isNativePlatform()) {
      const nativeResult = await shareFileNative(payload, fileName, csv);
      if (nativeResult.ok) return true;
      if (nativeResult.canceled) return false;
    }

    // Web: prefer explicit save dialog (where supported), then fallback to download.
    try {
      const saved = await saveCsvWithPicker(fileName, csv);
      if (saved) {
        showToast(t("share_file_saved"));
        return true;
      }
    } catch {
      // Continue to classic download fallback
    }

    try {
      const blob = new Blob(["\uFEFF", csv], {
        type: "text/csv;charset=utf-8;",
      });
      downloadFile(blob, fileName);
      showToast(t("share_file_saved"));
      return true;
    } catch {
      showToast(getShareFileFailedText());
      return false;
    }
  },
};