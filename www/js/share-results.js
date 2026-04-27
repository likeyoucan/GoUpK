// www/js/share-results.js

import { formatTime, showToast } from "./utils.js?v=VERSION";
import { t } from "./i18n.js?v=VERSION";

const CSV_SEPARATOR = ";";

function escapeCsv(value) {
  const str = String(value ?? "");
  if (str.includes('"') || str.includes(CSV_SEPARATOR) || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toLocalDateTime(ts) {
  const d = new Date(ts || Date.now());
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function downloadFile(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    ta.remove();
    return ok;
  }
}

function buildStopwatchText(payload) {
  const lines = [];
  lines.push(`Stopwatch Pro - ${t("stopwatch")}`);
  lines.push(`${t("name")}: ${payload.name}`);
  lines.push(`${t("date_new")}: ${payload.dateText}`);
  lines.push(`${t("total_time")}: ${payload.totalTimeText}`);
  lines.push("");
  lines.push(`${t("lap_text")}\t${t("total_time")}\t${t("split_time")}`);

  payload.rows.forEach((r) => {
    lines.push(`${r.index}\t${r.total}\t${r.split}`);
  });

  return lines.join("\n");
}

function buildStopwatchCsv(payload) {
  const rows = [];
  rows.push(`sep=${CSV_SEPARATOR}`);

  rows.push(
    [t("lap_text"), t("total_time"), t("split_time")]
      .map(escapeCsv)
      .join(CSV_SEPARATOR),
  );

  payload.rows.forEach((r) => {
    rows.push([r.index, r.total, r.split].map(escapeCsv).join(CSV_SEPARATOR));
  });

  const header = [
    `Stopwatch Pro - ${t("stopwatch")}`,
    `${t("name")}: ${payload.name}`,
    `${t("date_new")}: ${payload.dateText}`,
    `${t("total_time")}: ${payload.totalTimeText}`,
    "",
  ];

  return [...header, ...rows].join("\r\n") + "\r\n";
}

function makeFilename(payload, ext) {
  const safeName = (payload.name || "stopwatch")
    .replace(/[\\/:*?"<>|]/g, "_")
    .trim();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${safeName || "stopwatch"}_${stamp}.${ext}`;
}

function isUserShareCancel(error) {
  if (!error) return false;
  const name = String(error.name || "").toLowerCase();
  const message = String(error.message || "").toLowerCase();

  return (
    name === "aborterror" ||
    name === "notallowederror" ||
    message.includes("cancel") ||
    message.includes("aborted") ||
    message.includes("dismissed") ||
    message.includes("user aborted") ||
    message.includes("user cancelled")
  );
}

export const shareResults = {
  canShowShareButton(lapsCount) {
    return Number(lapsCount) > 0;
  },

  buildStopwatchPayload(session, { showMs = true } = {}) {
    const forceHours = (session?.totalTime || 0) >= 3600000;
    const laps = Array.isArray(session?.laps) ? session.laps : [];

    return {
      name: session?.name || t("stopwatch"),
      dateText: toLocalDateTime(session?.date || session?.id),
      totalTimeText: formatTime(session?.totalTime || 0, {
        showMs,
        forceHours,
      }),
      rows: laps.map((lap) => ({
        index: `${t("lap_text")} ${lap.index}`,
        total: formatTime(lap.total, { showMs, forceHours }),
        split: formatTime(lap.diff, { showMs, forceHours }),
      })),
    };
  },

  async shareAsText(payload) {
    const text = buildStopwatchText(payload);

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
      showToast(t("share_file_failed"));
      return false;
    }

    const csv = buildStopwatchCsv(payload);
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
        showToast(t("share_file_failed"));
        return false;
      }
    }

    try {
      downloadFile(blob, fileName);
      showToast(t("share_file_saved"));
      return true;
    } catch {
      showToast(t("share_file_failed"));
      return false;
    }
  },
};
