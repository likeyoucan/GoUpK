// Файл: www/js/share/share-builders.js

const CSV_SEPARATOR = ";";

function padRight(value, width) {
  const text = String(value ?? "");
  if (text.length >= width) return text;
  return text + " ".repeat(width - text.length);
}

function makeSeparator(widths) {
  return `+${widths.map((w) => "-".repeat(w + 2)).join("+")}+`;
}

function makeRow(cells, widths) {
  return `| ${cells.map((c, i) => padRight(c, widths[i])).join(" | ")} |`;
}

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
  const header = [t("lap_text"), t("total_time"), t("split_time")];
  const rows = payload.rows.map((r) => [r.index, r.total, r.split]);

  const widths = [header[0].length, header[1].length, header[2].length];
  rows.forEach((r) => {
    widths[0] = Math.max(widths[0], String(r[0]).length);
    widths[1] = Math.max(widths[1], String(r[1]).length);
    widths[2] = Math.max(widths[2], String(r[2]).length);
  });

  const sep = makeSeparator(widths);
  const table = [
    sep,
    makeRow(header, widths),
    sep,
    ...rows.map((r) => makeRow(r, widths)),
    sep,
  ];

  return [
    `${t("name")}: ${payload.name}`,
    `${t("total_time")}: ${payload.totalTimeText}`,
    "",
    ...table,
  ].join("\n");
}

function buildStopwatchCsv(payload, t) {
  const rows = [];

  // Только таблица, без служебных строк и метаданных
  rows.push(
    [t("lap_text"), t("total_time"), t("split_time")]
      .map(escapeCsv)
      .join(CSV_SEPARATOR),
  );

  payload.rows.forEach((r) => {
    rows.push([r.index, r.total, r.split].map(escapeCsv).join(CSV_SEPARATOR));
  });

  return rows.join("\r\n") + "\r\n";
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
