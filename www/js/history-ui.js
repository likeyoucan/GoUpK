import { $, showToast } from "./utils.js?v=VERSION";
import { t } from "./i18n.js?v=VERSION";
import { historyStore } from "./history.js?v=VERSION";
import { modalManager } from "./modal.js?v=VERSION";
import { navigation } from "./navigation.js?v=VERSION";
import { tm } from "./timer.js?v=VERSION";
import { tb } from "./tabata.js?v=VERSION";
import { CustomSelect } from "./custom-select.js?v=VERSION";

export const historyUI = {
  mode: "timer",
  sort: "date_desc",
  sortSelect: null,
  els: {},

  init() {
    this.els = {
      title: $("history-title"),
      list: $("history-list"),
      clearBtn: $("history-clearBtn"),
    };

    this.sortSelect = new CustomSelect(
      "historySortSelectContainer",
      [
        { value: "date_asc", text: t("date_old") },
        { value: "date_desc", text: t("date_new") },
      ],
      (value) => {
        this.sort = value;
        this.render();
      },
      this.sort,
    );

    this.els.clearBtn?.addEventListener("click", () => {
      historyStore.clear(this.mode);
      this.render();
      showToast(t("history_cleared"));
    });

    document.addEventListener("languageChanged", () => {
      if (this.sortSelect) {
        this.sortSelect.options = [
          { value: "date_asc", text: t("date_old") },
          { value: "date_desc", text: t("date_new") },
        ];
        this.sortSelect.populateOptions();
        this.sortSelect.setValue(this.sort, false);
      }
      this.render();
    });
  },

  open(mode = "timer") {
    this.mode = mode === "tabata" ? "tabata" : "timer";
    this.render();
    modalManager.open("history-modal");
  },

  render() {
    if (!this.els.list) return;

    if (this.els.title) {
      this.els.title.textContent = `${t("history")} • ${t(this.mode)}`;
    }

    const rows = historyStore.sort(historyStore.getByMode(this.mode), this.sort);
    this.els.list.replaceChildren();

    if (!rows.length) {
      const empty = document.createElement("div");
      empty.className = "text-center app-text-sec opacity-50 mt-10 text-sm";
      empty.textContent = t("empty_sessions");
      this.els.list.appendChild(empty);
      return;
    }

    rows.forEach((entry) => {
      const card = document.createElement("div");
      card.className =
        "app-surface border app-border rounded-xl p-3 flex items-center justify-between gap-3";

      const left = document.createElement("div");
      left.className = "min-w-0";

      const dt = new Date(entry.startAt);
      const statusKey = entry.resultStatus === "completed" ? "completed" : "stopped";

      const title = document.createElement("div");
      title.className = "font-bold app-text truncate";
      title.textContent = `${dt.toLocaleDateString()} ${dt.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })}`;

      const subtitle = document.createElement("div");
      subtitle.className = "text-xs app-text-sec mt-1";
      subtitle.textContent = `${t(statusKey)} • ${Math.round(entry.duration / 1000)}s`;

      left.append(title, subtitle);

      const actions = document.createElement("div");
      actions.className = "flex items-center gap-2 shrink-0";

      const runBtn = document.createElement("button");
      runBtn.type = "button";
      runBtn.className =
        "min-h-[36px] px-3 rounded-lg text-xs font-bold primary-text active:scale-95 transition-transform";
      runBtn.textContent = t("run_again");
      runBtn.addEventListener("click", () => this.runAgain(entry));

      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className =
        "min-h-[36px] px-3 rounded-lg text-xs font-bold text-alert active:scale-95 transition-transform";
      delBtn.textContent = t("delete");
      delBtn.addEventListener("click", () => {
        historyStore.remove(entry.id);
        this.render();
      });

      actions.append(runBtn, delBtn);
      card.append(left, actions);
      this.els.list.appendChild(card);
    });
  },

  runAgain(entry) {
    if (entry.mode === "timer") {
      const total = Number(entry.payload?.totalDuration || 30000);
      const h = Math.floor(total / 3600000);
      const m = Math.floor((total % 3600000) / 60000);
      const s = Math.floor((total % 60000) / 1000);

      if (tm.els.h) tm.els.h.value = String(h).padStart(2, "0");
      if (tm.els.m) tm.els.m.value = String(m).padStart(2, "0");
      if (tm.els.s) tm.els.s.value = String(s).padStart(2, "0");

      navigation.switchView("timer");
      modalManager.closeCurrent();
      return;
    }

    if (entry.mode === "tabata") {
      const p = entry.payload || {};
      if (p.work && p.rest && p.rounds) {
        tb.work = p.work;
        tb.rest = p.rest;
        tb.rounds = p.rounds;
      }
      navigation.switchView("tabata");
      modalManager.closeCurrent();
    }
  },
};