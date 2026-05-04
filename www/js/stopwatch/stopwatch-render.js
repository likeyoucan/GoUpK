// Файл: www/js/stopwatch/stopwatch-render.js

import { $, formatTime, updateText } from "../utils.js?v=VERSION";
import { t } from "../i18n.js?v=VERSION";
import { uiSettingsManager } from "../ui-settings.js?v=VERSION";

const pad2 = (n) => String(n).padStart(2, "0");

// Main stopwatch display:
// < 1h  -> MM:SS(.cc)
// >= 1h -> HH:MM:SS(.cc)
// When days exist, hours are shown in 00-23 range (not cumulative 84, 120, etc.)
function formatStopwatchMain(ms, { showMs = false } = {}) {
  const safeMs = Math.max(0, Math.floor(ms));
  const totalSec = Math.floor(safeMs / 1000);

  const days = Math.floor(totalSec / 86400);
  const totalHours = Math.floor(totalSec / 3600);
  const hours = days > 0 ? totalHours % 24 : totalHours;

  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  const centis = Math.floor((safeMs % 1000) / 10);

  const base =
    totalHours > 0 || days > 0
      ? `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`
      : `${pad2(minutes)}:${pad2(seconds)}`;

  return showMs ? `${base}.${pad2(centis)}` : base;
}

function formatStopwatchExtended(ms) {
  const totalSec = Math.floor(Math.max(0, ms) / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);

  if (days > 0) return `${days}${t("day_short")} ${hours}${t("hour_short")}`;
  if (hours > 0) return `${hours}${t("hour_short")}`;
  return "";
}

export function setupStopwatchRender(sw) {
  sw.createLapElement = (lap, isLatest = false) => {
    const lapTemplate = $("sw-lap-row-template");
    if (!lapTemplate) return document.createElement("div");

    const clone = lapTemplate.content.cloneNode(true);
    const div = clone.firstElementChild;

    div.classList.add(
      "lap-row",
      "mt-2.5",
      "py-3",
      "border-b",
      "app-border",
      "px-3",
      "rounded-lg",
      "transition-all",
      "duration-300",
    );
    div.classList.remove("py-2", "border-gray-500/10", "px-2");

    if (isLatest) div.classList.add("bg-black/5", "dark:bg-white/5");

    const shouldForceHours = sw.elapsedTime >= 3600000;

    div.querySelector('[data-template="lap-index"]').textContent =
      `${t("lap_text")} ${lap.index}`;
    div.querySelector('[data-template="lap-total"]').textContent = formatTime(
      lap.total,
      {
        showMs: uiSettingsManager.showMs,
        forceHours: shouldForceHours,
      },
    );

    const splitTimeEl = div.querySelector('[data-template="lap-split"]');
    splitTimeEl.textContent = formatTime(lap.diff, {
      showMs: uiSettingsManager.showMs,
      forceHours: shouldForceHours,
    });
    splitTimeEl.classList.add("split-time");

    if (isLatest) {
      splitTimeEl.classList.remove("app-text");
      splitTimeEl.classList.add("primary-text");
    }

    return div;
  };

  sw.reRenderCurrentLaps = () => {
    sw.els.lapsContainer.replaceChildren();

    if (sw.laps.length === 0) {
      const noLapsDiv = document.createElement("div");
      noLapsDiv.className = "text-center app-text-sec opacity-50 mt-4 text-sm";
      noLapsDiv.setAttribute("data-i18n", "no_laps");
      noLapsDiv.textContent = t("no_laps");
      sw.els.lapsContainer.appendChild(noLapsDiv);
      return;
    }

    [...sw.laps].reverse().forEach((lap, i, arr) => {
      sw.els.lapsContainer.prepend(
        sw.createLapElement(lap, i === arr.length - 1),
      );
    });
  };

  sw.updateSaveButtonVisibility = () => {
    const canShare = sw.shareResults.canShowShareButton(sw.laps.length);

    if (sw.els.saveBtn) {
      sw.els.saveBtn.classList.toggle("hidden", !canShare);
      sw.els.saveBtn.classList.toggle("flex", canShare);
    }

    if (sw.els.shareBtn) {
      sw.els.shareBtn.classList.toggle("hidden", !canShare);
      sw.els.shareBtn.classList.toggle("flex", canShare);
    }
  };

  sw.renderSavedSessions = () => {
    if (!sw.els || !sw.els.sessionsList) return;

    const hasSessions = sw.savedSessions.length > 0;

    if (sw.els.swSortWrapper) {
      sw.els.swSortWrapper.classList.toggle("hidden", !hasSessions);
    }

    const clearAllBtn = $("sw-clearAllBtn");
    if (clearAllBtn) clearAllBtn.disabled = !hasSessions;

    sw.els.sessionsList.replaceChildren();

    if (!hasSessions) {
      const emptyDiv = document.createElement("div");
      emptyDiv.className =
        "text-center app-text-sec opacity-50 mt-10 text-sm pointer-events-none";
      emptyDiv.setAttribute("data-i18n", "empty_sessions");
      emptyDiv.textContent = t("empty_sessions");
      sw.els.sessionsList.appendChild(emptyDiv);
      return;
    }

    const fragment = document.createDocumentFragment();
    const sessionTemplate = $("sw-session-template");
    const lapTemplate = $("sw-lap-row-template");
    if (!sessionTemplate || !lapTemplate) return;

    sw.savedSessions.forEach((session) => {
      const clone = sessionTemplate.content.cloneNode(true);
      const sessionElement = clone.firstElementChild;
      const shouldForceHours = session.totalTime >= 3600000;

      const dateObj = new Date(session.date || session.id);
      const dateStr = `${dateObj.toLocaleDateString()} ${dateObj.toLocaleTimeString(
        [],
        {
          hour: "2-digit",
          minute: "2-digit",
        },
      )}`;

      sessionElement.querySelector('[data-template="name"]').textContent =
        session.name;
      sessionElement.querySelector('[data-template="date"]').textContent =
        dateStr;
      sessionElement.querySelector('[data-template="totalTime"]').textContent =
        formatTime(session.totalTime, {
          showMs: uiSettingsManager.showMs,
          forceHours: shouldForceHours,
        });

      const header = sessionElement.querySelector(
        '[data-template-id="header"]',
      );
      const share = sessionElement.querySelector(
        '[data-template-id="shareBtn"]',
      );
      const rename = sessionElement.querySelector(
        '[data-template-id="renameBtn"]',
      );
      const del = sessionElement.querySelector(
        '[data-template-id="deleteBtn"]',
      );

      header.dataset.id = session.id;
      if (share) share.dataset.id = session.id;
      if (rename) rename.dataset.id = session.id;
      if (del) del.dataset.id = session.id;

      const detailsEl = sessionElement.querySelector(
        '[data-template-id="details"]',
      );
      const iconEl = sessionElement.querySelector('[data-template-id="icon"]');
      detailsEl.id = `sw-details-${session.id}`;
      iconEl.id = `sw-icon-${session.id}`;

      if (share) share.textContent = t("share");
      if (rename) rename.textContent = t("rename");
      if (del) del.textContent = t("delete");

      const lapsContainer = sessionElement.querySelector(
        '[data-template="lapsContainer"]',
      );

      const headerDiv = document.createElement("div");
      headerDiv.className =
        "flex justify-between items-center py-1.5 border-b border-gray-500/30 mb-1 px-2";

      const lapSpan = document.createElement("span");
      lapSpan.className =
        "text-[10px] font-bold app-text-sec uppercase tracking-wider";
      lapSpan.textContent = t("lap_text");

      const timesDiv = document.createElement("div");
      timesDiv.className = "flex items-center gap-4";

      const totalSpan = document.createElement("span");
      totalSpan.className =
        "text-[10px] font-bold app-text-sec uppercase tracking-wider w-16 text-right";
      totalSpan.textContent = t("total_time");

      const splitSpan = document.createElement("span");
      splitSpan.className =
        "text-[10px] font-bold app-text-sec uppercase tracking-wider w-16 text-right";
      splitSpan.textContent = t("split_time");

      timesDiv.append(totalSpan, splitSpan);
      headerDiv.append(lapSpan, timesDiv);
      lapsContainer.appendChild(headerDiv);

      session.laps.forEach((lap) => {
        const lapClone = lapTemplate.content.cloneNode(true);
        const lapElement = lapClone.firstElementChild;

        lapElement.querySelector('[data-template="lap-index"]').textContent =
          `${t("lap_text")} ${lap.index}`;

        lapElement.querySelector('[data-template="lap-total"]').textContent =
          formatTime(lap.total, {
            showMs: uiSettingsManager.showMs,
            forceHours: shouldForceHours,
          });

        lapElement.querySelector('[data-template="lap-split"]').textContent =
          formatTime(lap.diff, {
            showMs: uiSettingsManager.showMs,
            forceHours: shouldForceHours,
          });

        lapsContainer.appendChild(lapElement);
      });

      fragment.appendChild(sessionElement);
    });

    sw.els.sessionsList.appendChild(fragment);
  };

  sw.toggleSessionDetails = (id) => {
    const detailsEl = $(`sw-details-${id}`);
    const iconEl = $(`sw-icon-${id}`);
    if (!detailsEl) return;

    if (detailsEl.classList.contains("hidden")) {
      detailsEl.classList.remove("hidden");
      if (iconEl) iconEl.style.transform = "rotate(180deg)";
    } else {
      detailsEl.classList.add("hidden");
      if (iconEl) iconEl.style.transform = "rotate(0deg)";
    }
  };

  sw.updateDisplay = () => {
    const showMs = uiSettingsManager.showMs;

    const mainDisplayStr = formatStopwatchMain(sw.elapsedTime, { showMs });
    updateText(sw.els.display, mainDisplayStr);

    if (sw.els.extendedDisplay) {
      const extStr = formatStopwatchExtended(sw.elapsedTime);

      if (extStr) {
        updateText(sw.els.extendedDisplay, extStr);
        sw.els.extendedDisplay.classList.remove("hidden", "opacity-0");
      } else {
        // Keep line height stable without visible text
        updateText(sw.els.extendedDisplay, " ");
        sw.els.extendedDisplay.classList.remove("hidden");
        sw.els.extendedDisplay.classList.add("opacity-0");
      }
    }

    const appEl = $("app");
    if (sw.els.ring && !appEl?.classList.contains("is-view-transitioning")) {
      sw.els.ring.style.strokeDashoffset =
        sw.ringLength - ((sw.elapsedTime % 60000) / 60000) * sw.ringLength;
    }
  };
}
