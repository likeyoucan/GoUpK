// Файл: www/js/stopwatch/stopwatch-sessions.js

import {
  $,
  safeSetLS,
  safeGetLS,
  safeRemoveLS,
  showToast,
  getUniqueName,
} from "../utils.js?v=VERSION";
import { t } from "../i18n.js?v=VERSION";
import { modalManager } from "../modal.js?v=VERSION";
import { CustomSelect } from "../custom-select.js?v=VERSION";
import { APP_EVENTS } from "../constants/events.js?v=VERSION";

export function setupStopwatchSessions(sw) {
  try {
    const stored = safeGetLS("sw_saved_sessions");
    sw.savedSessions = stored ? JSON.parse(stored) : [];
  } catch {
    sw.savedSessions = [];
  }

  const sortOptions = [
    { value: "date_asc", text: t("date_old") },
    { value: "date_desc", text: t("date_new") },
    { value: "result_fast", text: t("result_fast") },
    { value: "name_az", text: t("name_az") },
    { value: "name_za", text: t("name_za") },
  ];

  sw.sortSelect = new CustomSelect(
    "swSortSelectContainer",
    sortOptions,
    (value) => sw.sortSessions(value),
    sw.currentSort,
  );

  sw.els.nameInput?.addEventListener("input", () =>
    sw.els.nameError?.classList.add("hidden"),
  );

  sw.els.sessionsList?.addEventListener("click", (e) => {
    const header = e.target.closest(".sw-session-header");
    const shareBtn = e.target.closest(".sw-share-btn");
    const renameBtn = e.target.closest(".sw-rename-btn");
    const deleteBtn = e.target.closest(".sw-delete-btn");

    if (shareBtn) {
      e.stopPropagation();
      sw.shareSavedSession(Number(shareBtn.dataset.id));
      return;
    }

    if (renameBtn) {
      e.stopPropagation();
      sw.prepareRenameSession(Number(renameBtn.dataset.id));
      return;
    }

    if (deleteBtn) {
      e.stopPropagation();
      sw.deleteSession(Number(deleteBtn.dataset.id));
      return;
    }

    if (header) {
      sw.toggleSessionDetails(Number(header.dataset.id));
    }
  });

  sw.prepareSaveSession = () => {
    if (sw.laps.length === 0 && sw.elapsedTime === 0) return;

    const defaultName = getUniqueName(t("stopwatch"), sw.savedSessions, "name");
    const completionTime = sw.isRunning
      ? Date.now()
      : sw.pauseTime || Date.now();

    const pendingSession = {
      id: Date.now(),
      name: "",
      date: completionTime,
      totalTime: sw.elapsedTime,
      laps: sw._buildSessionLapsForSave(),
    };

    modalManager.open("sw-name-modal", {
      action: "save",
      name: defaultName,
      pendingSession,
    });
  };

  sw.prepareRenameSession = (id) => {
    const session = sw.savedSessions.find((s) => s.id === id);
    if (!session) return;

    modalManager.open("sw-name-modal", {
      action: "rename",
      name: session.name,
      targetId: id,
    });
  };

  sw.prepareNameForm = (data) => {
    sw.nameModalState = { ...data };
    sw.els.nameError?.classList.add("hidden");

    sw.els.nameTitle.textContent =
      data.action === "rename" ? t("rename") : t("session_name");

    sw.els.nameInput.value = data.name;
    sw.els.nameInput.placeholder = data.name;
    setTimeout(() => sw.els.nameInput?.focus(), 100);
  };

  sw.confirmNameModal = () => {
    const inputVal = sw.els.nameInput.value.trim();
    const finalName = inputVal !== "" ? inputVal : sw.els.nameInput.placeholder;

    if (finalName.length > 50) {
      sw.els.nameError.textContent = t("name_too_long");
      sw.els.nameError?.classList.remove("hidden");
      sw.els.nameInput.classList.add("animate-shake");
      setTimeout(() => sw.els.nameInput.classList.remove("animate-shake"), 300);
      return;
    }

    const isDuplicate = sw.savedSessions.some(
      (s) =>
        s.name.toLowerCase() === finalName.toLowerCase() &&
        (sw.nameModalState.action === "save" ||
          s.id !== sw.nameModalState.targetId),
    );

    if (isDuplicate) {
      sw.els.nameError.textContent = t("name_exists");
      sw.els.nameError?.classList.remove("hidden");
      sw.els.nameInput.classList.add("animate-shake");
      setTimeout(() => sw.els.nameInput.classList.remove("animate-shake"), 300);
      return;
    }

    if (sw.nameModalState.action === "save") {
      const session = sw.nameModalState.pendingSession;
      session.name = finalName;
      sw.savedSessions.push(session);
      safeSetLS("sw_saved_sessions", JSON.stringify(sw.savedSessions));
      showToast(t("session_saved"));
    } else if (sw.nameModalState.action === "rename") {
      const session = sw.savedSessions.find(
        (s) => s.id === sw.nameModalState.targetId,
      );
      if (session) {
        session.name = finalName;
        safeSetLS("sw_saved_sessions", JSON.stringify(sw.savedSessions));
        sw.sortSessions(sw.currentSort);
      }
    }

    modalManager.closeCurrent();
  };

  sw.confirmClearAll = () => {
    sw.savedSessions = [];
    safeRemoveLS("sw_saved_sessions");
    sw.renderSavedSessions();
    modalManager.closeCurrent();
    showToast(t("history_cleared"));
  };

  sw.sortSessions = (type) => {
    sw.currentSort = type;
    if (sw.sortSelect) sw.sortSelect.setValue(type, false);

    sw.savedSessions.sort((a, b) => {
      if (type === "date_desc") return b.date - a.date;
      if (type === "date_asc") return a.date - b.date;
      if (type === "name_az") return a.name.localeCompare(b.name);
      if (type === "name_za") return b.name.localeCompare(a.name);
      if (type === "result_fast") return a.totalTime - b.totalTime;
      return 0;
    });

    sw.renderSavedSessions();
  };

  sw.deleteSession = (id) => {
    sw.savedSessions = sw.savedSessions.filter((s) => s.id !== id);
    safeSetLS("sw_saved_sessions", JSON.stringify(sw.savedSessions));
    sw.renderSavedSessions();
  };

  sw.onLanguageChangedForSessions = () => {
    sw.renderSavedSessions();
    if (sw.laps.length > 0) sw.reRenderCurrentLaps();

    if (sw.sortSelect) {
      sw.sortSelect.options = [
        { value: "date_asc", text: t("date_old") },
        { value: "date_desc", text: t("date_new") },
        { value: "result_fast", text: t("result_fast") },
        { value: "name_az", text: t("name_az") },
        { value: "name_za", text: t("name_za") },
      ];
      sw.sortSelect.populateOptions();
      sw.sortSelect.setValue(sw.currentSort, false);
    }

    sw.updateSaveButtonVisibility();
  };

  document.addEventListener(APP_EVENTS.LANGUAGE_CHANGED, () => {
    sw.onLanguageChangedForSessions();
  });
}
