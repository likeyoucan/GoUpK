/**
 * store.js
 * Простое хранилище состояния в памяти для отслеживания активного таймера.
 * Это легковесная альтернатива более сложным менеджерам состояний.
 * Она позволяет разным модулям знать, какой таймер сейчас запущен,
 * чтобы избежать одновременной работы нескольких таймеров.
 */

const storeData = {
  /** @type {('stopwatch'|'timer'|'tabata')|null} */
  activeTimer: null,
};

export const store = {
  /**
   * Устанавливает, какой таймер сейчас является активным.
   * @param {('stopwatch'|'timer'|'tabata')|null} timerName - Имя таймера или null для сброса.
   */
  setActiveTimer(timerName) {
    storeData.activeTimer = timerName;
  },

  /**
   * Возвращает имя активного в данный момент таймера.
   * @returns {('stopwatch'|'timer'|'tabata')|null}
   */
  getActiveTimer() {
    return storeData.activeTimer;
  },

  /**
   * Проверяет, совпадает ли переданное имя с активным таймером.
   * @param {string} timerName
   * @returns {boolean}
   */
  isActive(timerName) {
    return storeData.activeTimer === timerName;
  },

  /**
   * Сбрасывает активный таймер.
   */
  clearActiveTimer() {
    storeData.activeTimer = null;
  },
};