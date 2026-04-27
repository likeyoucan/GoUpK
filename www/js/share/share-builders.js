// Файл: www/js/share/share-builders.js

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

function makeFilename(payload, ext) {
  const safeName = (payload.name || "stopwatch")
    .replace(/[\\/:*?"<>|]/g, "_")
    .trim();

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${safeName || "stopwatch"}_${stamp}.${ext}`;
}

function buildStopwatchText(payload, t) {
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

function buildStopwatchCsv(payload, t) {
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

function buildStopwatchPayload(session, formatTime, t, { showMs = true } = {}) {
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
}

export {
  CSV_SEPARATOR,
  buildStopwatchPayload,
  buildStopwatchText,
  buildStopwatchCsv,
  makeFilename,
};
