// Файл: www/js/store.js

const storeData = {
  activeTimer: null, // Хранит имя активного таймера ('stopwatch', 'timer', 'tabata') или null
};

export const store = {
  /**
   * Устанавливает, какой таймер сейчас является активным.
   * @param {string | null} timerName - Имя таймера или null для сброса.
   */
  setActiveTimer(timerName) {
    storeData.activeTimer = timerName;
  },

  /**
   * Возвращает имя активного в данный момент таймера.
   * @returns {string | null}
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
