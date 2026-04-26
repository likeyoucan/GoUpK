// Файл: www/js/history.js

import { safeGetLS, safeSetLS } from "./utils.js?v=VERSION";

const HISTORY_KEY = "activity_history_v1";
const MAX_HISTORY_ITEMS = 500;

function makeId() {
  return `h_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeEntry(raw) {
  return {
    id: raw?.id || makeId(),
    mode: raw?.mode || "timer",
    startAt: Number(raw?.startAt) || Date.now(),
    endAt: Number(raw?.endAt) || Date.now(),
    duration: Math.max(0, Number(raw?.duration) || 0),
    resultStatus: raw?.resultStatus || "stopped", // completed | stopped
    payload: raw?.payload && typeof raw.payload === "object" ? raw.payload : {},
  };
}

export const historyStore = {
  getAll() {
    try {
      const stored = safeGetLS(HISTORY_KEY);
      if (!stored) return [];
      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) return [];
      return parsed.map(normalizeEntry);
    } catch {
      return [];
    }
  },

  saveAll(list) {
    const normalized = Array.isArray(list) ? list.map(normalizeEntry) : [];
    safeSetLS(HISTORY_KEY, JSON.stringify(normalized.slice(0, MAX_HISTORY_ITEMS)));
  },

  append(entry) {
    const next = [normalizeEntry(entry), ...this.getAll()].slice(0, MAX_HISTORY_ITEMS);
    this.saveAll(next);
    return next;
  },

  getByMode(mode) {
    return this.getAll().filter((x) => x.mode === mode);
  },

  sort(list, sort = "date_desc") {
    const arr = [...list];
    if (sort === "date_asc") arr.sort((a, b) => a.startAt - b.startAt);
    else arr.sort((a, b) => b.startAt - a.startAt);
    return arr;
  },

  remove(id) {
    const next = this.getAll().filter((x) => x.id !== id);
    this.saveAll(next);
    return next;
  },

  clear(mode = null) {
    if (!mode) {
      this.saveAll([]);
      return [];
    }
    const next = this.getAll().filter((x) => x.mode !== mode);
    this.saveAll(next);
    return next;
  },
};