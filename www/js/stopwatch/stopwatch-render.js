// Файл: www/js/stopwatch/stopwatch-render.js

import { $, formatTime, updateText } from "../utils.js?v=VERSION";
import { t } from "../i18n.js?v=VERSION";
import { uiSettingsManager } from "../ui-settings.js?v=VERSION";

const pad2 = (n) => String(n).padStart(2, "0");

// Main stopwatch display: always MM:SS(.cc)
// Hours/days are shown only in extended line below.
function formatStopwatchMain(ms, { showMs = false } = {}) {
  const safeMs = Math.max(0, Math.floor(ms));
  const totalSec = Math.floor(safeMs / 1000);

  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  const centis = Math.floor((safeMs % 1000) / 10);

  let base = `${pad2(minutes)}:${pad2(seconds)}`;
  if (showMs) base += `.${pad2(centis)}`;
  return base;
}

function formatStopwatchExtended(ms) {
  const totalSec = Math.floor(Math.max(0, ms) / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);

  if (days > 0) return `${days}${t("day_short")} ${hours}${t("hour_short")}`;
  if (hours > 0) return `${hours}${t("hour_short")}`;
  return "";
}

// Keep text inside the ring without changing font-size.
function fitStopwatchDisplay(el) {
  if (!el) return;

  const isGo = el.classList.contains("is-go");
  el.style.transformOrigin = "center center";
  if (isGo) {
    el.style.transform = "";
    el.dataset.scaleX = "1";
    el.dataset.fitSig = "";
    return;
  }

  const text = el.textContent || "";
  const available = el.clientWidth || el.parentElement?.clientWidth || 0;
  const needed = el.scrollWidth || 0;
  if (!available || !needed) return;

  const sig = `${text}|${Math.round(available)}`;
  if (el.dataset.fitSig === sig) return;
  el.dataset.fitSig = sig;

  let target = 1;
  if (needed > available + 1) {
    target = Math.max(0.9, Math.min(1, available / needed));
  }

  const prev = Number(el.dataset.scaleX || "1");
  const next = Math.round(target * 1000) / 1000;

  if (Math.abs(prev - next) < 0.012) return;

  el.style.transform = `translateX(0px) scaleX(${next})`;
  el.dataset.scaleX = String(next);
}

function setLapsTableMode(isActive) {
  const container = $("sw-lapsContainer");
  if (!container) return;
  container.classList.toggle("laps-table-mode", !!isActive);
}

function createSavedSessionTableHead() {
  const headerDiv = document.createElement("div");
  headerDiv.className = "sw-laps-table-head flex justify-between items-center";

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

  return headerDiv;
}

export function setupStopwatchRender(sw) {
  sw._sessionDataById = new Map();

  sw.createLapElement = (lap, isLatest = false) => {
    const lapTemplate = $("sw-lap-row-template");
    if (!lapTemplate) return document.createElement("div");

    const clone = lapTemplate.content.cloneNode(true);
    const div = clone.firstElementChild;

    div.className =
      "lap-row sw-current-lap-row flex justify-between items-center px-3 py-2 border-b app-border";

    const shouldForceHours = sw.elapsedTime >= 3600000;
    const trLap = t("lap_text");

    div.querySelector('[data-template="lap-index"]').textContent =
      `${trLap} ${lap.index}`;

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
      div.classList.add("is-latest");
      splitTimeEl.classList.add("split-time-latest");
    }

    return div;
  };

  sw.reRenderCurrentLaps = () => {
    sw.els.lapsContainer.replaceChildren();

    if (sw.laps.length === 0) {
      setLapsTableMode(false);

      const noLapsDiv = document.createElement("div");
      noLapsDiv.className = "text-center app-text-sec opacity-50 mt-4 text-sm";
      noLapsDiv.setAttribute("data-i18n", "no_laps");
      noLapsDiv.textContent = t("no_laps");
      sw.els.lapsContainer.appendChild(noLapsDiv);
      return;
    }

    setLapsTableMode(true);

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

  sw._hydrateSessionDetails = (id) => {
    const detailsEl = $(`sw-details-${id}`);
    if (!detailsEl) return;

    const lapsContainer = detailsEl.querySelector(
      '[data-template="lapsContainer"]',
    );
    if (!lapsContainer) return;

    if (lapsContainer.dataset.hydrated === "1") return;

    const data = sw._sessionDataById.get(id);
    if (!data) return;

    lapsContainer.classList.add("sw-session-laps-table");
    lapsContainer.replaceChildren();

    lapsContainer.appendChild(createSavedSessionTableHead());

    const lapTemplate = $("sw-lap-row-template");
    if (!lapTemplate) return;

    const fragment = document.createDocumentFragment();
    const laps = Array.isArray(data.laps) ? data.laps : [];

    laps.forEach((lap) => {
      const lapClone = lapTemplate.content.cloneNode(true);
      const lapElement = lapClone.firstElementChild;

      lapElement.className =
        "lap-row sw-laps-table-row flex justify-between items-center px-3";

      lapElement.querySelector('[data-template="lap-index"]').textContent =
        `${t("lap_text")} ${lap.index}`;

      lapElement.querySelector('[data-template="lap-total"]').textContent =
        formatTime(lap.total, {
          showMs: uiSettingsManager.showMs,
          forceHours: !!data.shouldForceHours,
        });

      lapElement.querySelector('[data-template="lap-split"]').textContent =
        formatTime(lap.diff, {
          showMs: uiSettingsManager.showMs,
          forceHours: !!data.shouldForceHours,
        });

      fragment.appendChild(lapElement);
    });

    lapsContainer.appendChild(fragment);
    lapsContainer.dataset.hydrated = "1";
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
    sw._sessionsRenderToken = (sw._sessionsRenderToken || 0) + 1;
    const renderToken = sw._sessionsRenderToken;
    sw._sessionDataById.clear();

    if (!hasSessions) {
      const emptyDiv = document.createElement("div");
      emptyDiv.className =
        "text-center app-text-sec opacity-50 mt-10 text-sm pointer-events-none";
      emptyDiv.setAttribute("data-i18n", "empty_sessions");
      emptyDiv.textContent = t("empty_sessions");
      sw.els.sessionsList.appendChild(emptyDiv);
      return;
    }

    const trShare = t("share");
    const trRename = t("rename");
    const trDelete = t("delete");

    const sessionTemplate = $("sw-session-template");
    if (!sessionTemplate) return;

    const sessions = sw.savedSessions;
    const total = sessions.length;

    const mem = Number(navigator.deviceMemory || 4);
    const cores = Number(navigator.hardwareConcurrency || 4);
    const lowEnd = mem <= 4 || cores <= 4;
    const chunkSize = lowEnd ? 8 : 20;

    let index = 0;

    const renderChunk = () => {
      if (renderToken !== sw._sessionsRenderToken) return;
      const frag = document.createDocumentFragment();
      const end = Math.min(index + chunkSize, total);

      for (; index < end; index += 1) {
        const session = sessions[index];
        const clone = sessionTemplate.content.cloneNode(true);
        const sessionElement = clone.firstElementChild;
        const shouldForceHours = (session.totalTime || 0) >= 3600000;

        const dateObj = new Date(session.date || session.id);
        const dateStr = `${dateObj.toLocaleDateString()} ${dateObj.toLocaleTimeString(
          [],
          { hour: "2-digit", minute: "2-digit" },
        )}`;

        sessionElement.querySelector('[data-template="name"]').textContent =
          session.name || t("stopwatch");
        sessionElement.querySelector('[data-template="date"]').textContent =
          dateStr;
        sessionElement.querySelector(
          '[data-template="totalTime"]',
        ).textContent = formatTime(session.totalTime || 0, {
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

        const id = Number(session.id);
        header.dataset.id = id;
        if (share) share.dataset.id = id;
        if (rename) rename.dataset.id = id;
        if (del) del.dataset.id = id;

        const detailsEl = sessionElement.querySelector(
          '[data-template-id="details"]',
        );
        const iconEl = sessionElement.querySelector(
          '[data-template-id="icon"]',
        );
        detailsEl.id = `sw-details-${id}`;
        iconEl.id = `sw-icon-${id}`;

        sw._sessionDataById.set(id, {
          laps: Array.isArray(session.laps) ? session.laps : [],
          shouldForceHours,
        });

        const lapsContainer = detailsEl.querySelector(
          '[data-template="lapsContainer"]',
        );
        if (lapsContainer) {
          lapsContainer.classList.add("sw-session-laps-table");
          lapsContainer.replaceChildren();
          lapsContainer.dataset.hydrated = "0";
        }

        if (share) {
          share.setAttribute("aria-label", trShare);
          share.setAttribute("title", trShare);
        }
        if (rename) {
          rename.setAttribute("aria-label", trRename);
          rename.setAttribute("title", trRename);
        }
        if (del) {
          del.setAttribute("aria-label", trDelete);
          del.setAttribute("title", trDelete);
        }

        frag.appendChild(sessionElement);
      }

      if (renderToken !== sw._sessionsRenderToken) return;
      sw.els.sessionsList.appendChild(frag);

      if (index < total) {
        requestAnimationFrame(renderChunk);
      }
    };

    requestAnimationFrame(renderChunk);
  };

  sw.toggleSessionDetails = (id) => {
    const detailsEl = $(`sw-details-${id}`);
    const iconEl = $(`sw-icon-${id}`);
    if (!detailsEl) return;

    const isHidden = detailsEl.classList.contains("hidden");

    if (isHidden) {
      sw._hydrateSessionDetails(id);
      detailsEl.classList.remove("hidden");
      if (iconEl) iconEl.style.transform = "rotate(180deg)";
      return;
    }

    detailsEl.classList.add("hidden");
    if (iconEl) iconEl.style.transform = "rotate(0deg)";
  };

  sw.updateDisplay = () => {
    const showMs = uiSettingsManager.showMs;
    const mainDisplayStr = formatStopwatchMain(sw.elapsedTime, { showMs });

    updateText(sw.els.display, mainDisplayStr);
    fitStopwatchDisplay(sw.els.display);

    if (sw.els.extendedDisplay) {
      const extStr = formatStopwatchExtended(sw.elapsedTime);

      if (extStr) {
        updateText(sw.els.extendedDisplay, extStr);
        sw.els.extendedDisplay.classList.remove("hidden", "opacity-0");
      } else {
        updateText(sw.els.extendedDisplay, " ");
        sw.els.extendedDisplay.classList.remove("hidden");
        sw.els.extendedDisplay.classList.add("opacity-0");
      }
    }
  };
}
