// Файл: www/js/tabata/tabata-workouts.js

import {
  $,
  showToast,
  updateText,
  safeSetLS,
  safeGetLS,
  getUniqueName,
} from "../utils.js?v=VERSION";
import { t } from "../i18n.js?v=VERSION";
import { modalManager } from "../modal.js?v=VERSION";
import { APP_EVENTS } from "../constants/events.js?v=VERSION";
import { STORAGE_KEYS } from "../constants/storage-keys.js?v=VERSION";
import { onAppEvent } from "../events/app-events.js?v=VERSION";

export function setupTabataWorkouts(tb) {
  tb._unbindWorkouts?.();
  tb._unbindWorkouts = null;

  const disposers = [];

  let listRenderRaf = 0;
  const scheduleListRender = () => {
    if (listRenderRaf) return;
    listRenderRaf = requestAnimationFrame(() => {
      listRenderRaf = 0;
      tb.renderList();
    });
  };

  const flushListRender = () => {
    if (listRenderRaf) {
      cancelAnimationFrame(listRenderRaf);
      listRenderRaf = 0;
    }
    tb.renderList();
  };

  tb.prepareEdit = (idToEdit = null) => {
    tb.els.nameError?.classList.add("hidden");
    tb.editingWorkoutId = idToEdit;

    const titleEl = $("tb-modal-title");
    if (titleEl) {
      updateText(titleEl, idToEdit ? t("edit") : t("create_workout"));
    }

    if (idToEdit) {
      const w = tb.workouts.find((x) => x.id === idToEdit);
      if (w) {
        tb.els.editName.value = w.name;
        tb.els.editWork.value = w.work;
        tb.els.editRest.value = w.rest;
        tb.els.editRounds.value = w.rounds;
      }
    } else {
      const selectedWorkout =
        tb.workouts.find((x) => x.id === tb.selectedId) || null;

      const baseWork = selectedWorkout
        ? selectedWorkout.work
        : Math.max(1, Math.round((tb.work || 20000) / 1000));
      const baseRest = selectedWorkout
        ? selectedWorkout.rest
        : Math.max(1, Math.round((tb.rest || 10000) / 1000));
      const baseRounds = selectedWorkout
        ? selectedWorkout.rounds
        : Math.max(1, tb.rounds || 8);

      tb.els.editName.value = getUniqueName(t("tabata"), tb.workouts, "name");
      tb.els.editWork.value = baseWork;
      tb.els.editRest.value = baseRest;
      tb.els.editRounds.value = baseRounds;
    }

    setTimeout(() => tb.els.editName?.focus(), 300);
  };

  tb.saveWorkout = () => {
    let finalName = tb.els.editName.value.trim();
    if (!finalName) finalName = getUniqueName(t("tabata"), tb.workouts, "name");

    if (finalName.length > 50) {
      updateText(tb.els.nameError, t("name_too_long"));
      tb.els.nameError?.classList.remove("hidden");
      tb.els.editName.classList.add("animate-shake");
      setTimeout(() => tb.els.editName.classList.remove("animate-shake"), 300);
      return;
    }

    const finalLower = finalName.toLowerCase();
    const exists = tb.workouts.some(
      (w) =>
        w.name.toLowerCase() === finalLower && w.id !== tb.editingWorkoutId,
    );

    if (exists) {
      updateText(tb.els.nameError, t("name_exists"));
      tb.els.nameError?.classList.remove("hidden");
      tb.els.editName.classList.add("animate-shake");
      setTimeout(() => tb.els.editName.classList.remove("animate-shake"), 300);
      return;
    }

    const w = Math.max(1, parseInt(tb.els.editWork.value, 10) || 20);
    const r = Math.max(1, parseInt(tb.els.editRest.value, 10) || 10);
    const rnd = Math.max(1, parseInt(tb.els.editRounds.value, 10) || 8);

    let workoutIdToSelect = tb.editingWorkoutId;

    if (tb.editingWorkoutId) {
      const index = tb.workouts.findIndex((x) => x.id === tb.editingWorkoutId);
      if (index !== -1) {
        tb.workouts[index] = {
          ...tb.workouts[index],
          name: finalName,
          work: w,
          rest: r,
          rounds: rnd,
        };
      }
    } else {
      const newW = {
        id: Date.now(),
        name: finalName,
        work: w,
        rest: r,
        rounds: rnd,
      };
      tb.workouts.push(newW);
      workoutIdToSelect = newW.id;
    }

    safeSetLS(STORAGE_KEYS.TB_WORKOUTS, JSON.stringify(tb.workouts));
    tb.selectWorkout(workoutIdToSelect);
    scheduleListRender();
    modalManager.closeCurrent();
  };

  tb.deleteWorkout = (id) => {
    if (tb.status !== "STOPPED") {
      showToast(t("active_timer"));
      return;
    }

    if (tb.workouts.length <= 1) {
      showToast(t("cannot_delete"));
      return;
    }

    const next = tb.workouts.filter((w) => w.id !== id);
    if (next.length === tb.workouts.length) return;

    tb.workouts = next;
    safeSetLS(STORAGE_KEYS.TB_WORKOUTS, JSON.stringify(tb.workouts));

    if (tb.selectedId === id) tb.selectWorkout(tb.workouts[0].id);
    scheduleListRender();
  };

  tb.selectWorkout = (id) => {
    if (tb.status !== "STOPPED") return;

    const w = tb.workouts.find((k) => k.id === id);
    if (!w) return;

    tb.selectedId = id;
    safeSetLS(STORAGE_KEYS.TB_SELECTED_ID, id);

    tb.work = w.work * 1000;
    tb.rest = w.rest * 1000;
    tb.rounds = w.rounds;

    updateText(tb.els.activeName, w.name);

    const secShort = t("sec").toLowerCase();
    const detailsText = `${w.work}${secShort} / ${w.rest}${secShort} • ${w.rounds} ${t("rds")}`;
    updateText(tb.els.activeDetail, detailsText);

    scheduleListRender();
  };

  tb.renderList = () => {
    if (!tb.els.list) return;
    tb.els.list.replaceChildren();

    const fragment = document.createDocumentFragment();
    const template = $("tb-workout-template");
    if (!template) return;

    const secShort = t("sec").toLowerCase();
    const rds = t("rds");
    const trEdit = t("edit");
    const trDelete = t("delete");

    tb.workouts.forEach((w) => {
      const clone = template.content.cloneNode(true);
      const workoutElement = clone.firstElementChild;
      const isAct = w.id === tb.selectedId;

      workoutElement.classList.toggle("app-surface", !isAct);
      workoutElement.classList.toggle("border", !isAct);
      workoutElement.classList.toggle("app-border", !isAct);
      workoutElement.classList.toggle("shadow-sm", !isAct);

      workoutElement.classList.toggle("app-surface", isAct);
      workoutElement.classList.toggle("border-2", isAct);
      workoutElement.classList.toggle("border-[var(--primary-color)]", isAct);
      workoutElement.classList.toggle("shadow-md", isAct);

      workoutElement.dataset.id = w.id;
      workoutElement.querySelector('[data-template-id="editBtn"]').dataset.id =
        w.id;
      workoutElement.querySelector(
        '[data-template-id="deleteBtn"]',
      ).dataset.id = w.id;

      const nameEl = workoutElement.querySelector('[data-template="name"]');
      nameEl.textContent = w.name;
      nameEl.classList.toggle("primary-text", isAct);
      nameEl.classList.toggle("app-text", !isAct);

      const detailsText = `${w.work}${secShort} / ${w.rest}${secShort} • ${w.rounds} ${rds}`;
      workoutElement.querySelector('[data-template="details"]').textContent =
        detailsText;

      workoutElement
        .querySelector('[data-template-id="editBtn"]')
        .setAttribute("aria-label", trEdit);
      workoutElement
        .querySelector('[data-template-id="deleteBtn"]')
        .setAttribute("aria-label", trDelete);

      fragment.appendChild(workoutElement);
    });

    tb.els.list.appendChild(fragment);
  };

  tb.loadWorkoutsFromStorage = () => {
    try {
      const stored = safeGetLS(STORAGE_KEYS.TB_WORKOUTS);
      if (stored && JSON.parse(stored).length > 0) {
        tb.workouts = JSON.parse(stored);
      } else {
        throw new Error("empty");
      }
    } catch {
      tb.workouts = [
        { id: 1, name: "Standard Tabata", work: 20, rest: 10, rounds: 8 },
      ];
      safeSetLS(STORAGE_KEYS.TB_WORKOUTS, JSON.stringify(tb.workouts));
    }

    const lastSelectedId = Number(safeGetLS(STORAGE_KEYS.TB_SELECTED_ID));
    const exists = tb.workouts.find((w) => w.id === lastSelectedId);

    tb.selectWorkout(exists ? lastSelectedId : tb.workouts[0]?.id);
    flushListRender();
  };

  tb.bindWorkoutEvents = () => {
    tb._unbindWorkouts?.();

    const localDisposers = [];

    const bind = (el, event, handler, options) => {
      if (!el) return;
      el.addEventListener(event, handler, options);
      localDisposers.push(() =>
        el.removeEventListener(event, handler, options),
      );
    };

    const onEditNameInput = () => tb.els.nameError?.classList.add("hidden");
    bind(tb.els.editName, "input", onEditNameInput);

    const onListClick = (e) => {
      const delBtn = e.target.closest(".tb-del-btn");
      const editBtn = e.target.closest(".tb-edit-btn");
      const row = e.target.closest(".tb-workout-row");

      if (delBtn) {
        e.stopPropagation();
        tb.deleteWorkout(Number(delBtn.dataset.id));
      } else if (editBtn) {
        e.stopPropagation();
        modalManager.open("tb-modal", { idToEdit: Number(editBtn.dataset.id) });
      } else if (row) {
        tb.selectWorkout(Number(row.dataset.id));
      }
    };
    bind(tb.els.list, "click", onListClick);

    const offLangChanged = onAppEvent(APP_EVENTS.LANGUAGE_CHANGED, () => {
      flushListRender();
      if (tb.selectedId) tb.selectWorkout(tb.selectedId);
    });
    localDisposers.push(offLangChanged);

    tb._unbindWorkouts = () => {
      localDisposers.forEach((off) => {
        try {
          off?.();
        } catch (err) {
          console.error("[tabata-workouts.dispose]", err);
        }
      });
    };

    disposers.push(tb._unbindWorkouts);
  };

  tb._unbindWorkouts = () => {
    if (listRenderRaf) {
      cancelAnimationFrame(listRenderRaf);
      listRenderRaf = 0;
    }

    disposers.forEach((off) => {
      try {
        off?.();
      } catch (err) {
        console.error("[tabata-workouts.dispose.root]", err);
      }
    });
  };
}
