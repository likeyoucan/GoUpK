import { safeGetLS, safeSetLS, safeRemoveLS } from "./utils.js?v=VERSION";
import { CustomSelect } from "./custom-select.js?v=VERSION";

/**
 * Словарь переводов. Английский (en) используется как язык по умолчанию (fallback).
 */
export const translations = {
  en: { /* ... все ваши английские переводы ... */ },
  ru: { /* ... все ваши русские переводы ... */ },
};

/**
 * Конфигурация поддерживаемых языков.
 * `code` - код языка (ISO 639-1).
 * `nativeName` - "родное" название языка для отображения в списке.
 */
const SUPPORTED_LANGUAGES = [
  { code: 'en', nativeName: 'English' },
  { code: 'ru', nativeName: 'Русский' },
];

export const langManager = {
  /** @type {string} Текущий активный язык. */
  current: 'en',
  
  /** @type {CustomSelect|null} Экземпляр кастомного селекта. */
  langSelect: null,

  init() {
    const storedLangPref = safeGetLS("app_lang") || 'auto';
    let initialLangCode;

    if (storedLangPref === 'auto') {
      initialLangCode = this._getSystemLang();
    } else {
      initialLangCode = storedLangPref;
    }
    
    this._createSelect(storedLangPref);
    this.setLang(initialLangCode, storedLangPref === 'auto');
  },

  /**
   * Сбрасывает настройки языка к значениям по умолчанию.
   */
  resetSettings() {
    safeRemoveLS("app_lang");
    // Переинициализируем модуль, чтобы он снова определил системный язык
    this.init();
  },

  /**
   * Устанавливает активный язык и обновляет весь UI.
   * @param {string} langCode - Код языка для установки (e.g., 'en', 'ru').
   * @param {boolean} [isAuto=false] - Флаг, указывающий, что язык был выбран автоматически.
   */
  setLang(langCode, isAuto = false) {
    this.current = translations[langCode] ? langCode : 'en'; // Fallback на 'en'
    document.documentElement.lang = this.current;
    
    if (!isAuto) {
      safeSetLS("app_lang", this.current);
    }
    
    // Обновляем UI самого селекта
    if (this.langSelect) {
      this.langSelect.options = this._getLangOptions();
      this.langSelect.populateOptions();
      this.langSelect.setValue(isAuto ? "auto" : this.current, false);
    }

    // Обновляем все элементы с data-i18n на странице
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      const translation = t(key);
      
      // Используем textContent для безопасности и производительности
      if (el.textContent.trim() !== translation) {
          el.textContent = translation;
      }
    });

    // Уведомляем другие модули о смене языка
    document.dispatchEvent(new CustomEvent("languageChanged"));
  },

  /**
   * Инициализирует CustomSelect для выбора языка.
   * @param {string} initialValue - Начальное значение для селекта ('auto', 'en', etc.).
   * @private
   */
  _createSelect(initialValue) {
    this.langSelect = new CustomSelect(
      "langSelectContainer",
      this._getLangOptions(),
      (value) => { // onSelect callback
        if (value === "auto") {
          const sysLang = this._getSystemLang();
          this.setLang(sysLang, true);
          safeSetLS("app_lang", "auto");
        } else {
          this.setLang(value);
        }
      },
      initialValue
    );
  },

  /**
   * Генерирует массив опций для CustomSelect.
   * @returns {Array<{value: string, text: string}>}
   * @private
   */
  _getLangOptions() {
    const options = [{ value: "auto", text: t("lang_auto") }];
    SUPPORTED_LANGUAGES.forEach(lang => {
      options.push({ value: lang.code, text: lang.nativeName });
    });
    return options;
  },

  /**
   * Определяет предпочтительный язык системы.
   * @returns {string} Код языка ('ru' или 'en').
   * @private
   */
  _getSystemLang() {
    return navigator.language.startsWith('ru') ? 'ru' : 'en';
  }
};

/**
 * Основная функция-переводчик.
 * @param {string} key - Ключ для поиска в словаре переводов.
 * @returns {string} Переведенная строка, или строка на английском, или сам ключ.
 */
export function t(key) {
  return (
    translations[langManager.current]?.[key] || // 1. Попытка найти перевод на текущем языке
    translations.en[key] ||                      // 2. Fallback на английский
    key                                          // 3. Fallback на сам ключ
  );
}

// Поместите ваши объекты переводов `en` и `ru` сюда, чтобы они были доступны для `translations`
Object.assign(translations.en, {
  theme_classic: "Classic",
  volume: "Volume",
  edit: "Edit",
  stopwatch: "Stopwatch",
  timer: "Timer",
  tabata: "Tabata",
  settings: "Settings",
  pause: "PAUSE",
  lap: "Lap",
  reset: "Reset",
  laps_history: "Laps History",
  no_laps: "No laps recorded",
  countdown: "Countdown",
  hr: "HR",
  min: "MIN",
  sec: "SEC",
  tabata_interval: "Tabata Interval",
  my_workouts: "My Workouts",
  create_new: "+ New",
  round: "ROUND",
  stop: "STOP",
  create_workout: "Create Workout",
  name: "Name",
  work: "Work",
  rest: "Rest",
  rounds: "Rounds",
  rds: "Rds",
  count: "COUNT",
  save: "Save",
  appearance: "Appearance",
  language: "Language",
  lang_auto: "Auto",
  theme: "Theme",
  accent_color: "Accent",
  bg_color: "Background",
  interface: "General",
  font_size: "Font Size",
  ring_width: "Ring Thickness",
  timer_finished: "Timer Finished!",
  tabata_complete: "Tabata Complete!",
  get_ready: "Get Ready",
  cannot_delete: "Cannot delete active/last workout",
  lap_text: "Lap",
  active_timer: "Stop timer first!",
  show_ms: "Show Milliseconds",
  hide_nav_labels: "Hide Nav Labels",
  reset_settings: "Reset to Defaults",
  save_session: "Save Session",
  saved_results: "Saved Results",
  sort_by: "Sort by:",
  date_new: "Newest first",
  date_old: "Oldest first",
  name_az: "Name (A-Z)",
  name_za: "Name (Z-A)",
  result_fast: "Result (Fastest)",
  empty_sessions: "No saved sessions",
  session_saved: "Session saved!",
  enter_name: "Enter session name:",
  rename: "Rename",
  delete: "Delete",
  cancel: "Cancel",
  session_name: "Session Name",
  reset_confirm_msg: "Are you sure? Your saved workouts will not be deleted.",
  name_exists: "Name already exists",
  timer_zero: "Set timer value first!",
  sound: "Sound",
  vibration: "Vibration",
  vibro_level: "Depth",
  sound_theme: "Sound Theme",
  theme_sport: "Sport",
  theme_vibe: "Vibe",
  theme_work: "Work",
  theme_life: "Life",
  total_time: "Total",
  split_time: "Split",
  clear_all: "Clear All",
  clear_history_confirm: "Are you sure you want to delete all saved results?",
  history_cleared: "History cleared!",
  adaptive_bg: "Adaptive Background Colors",
  vignette: "Dark Vignette Effect",
  liquid_glass: "Liquid Glass",
  theme_auto: "Auto",
  theme_light: "Light",
  theme_dark: "Dark",
  settings_reset_success: "Settings Reset!",
  day_short: "d",
  hour_short: "h",
  feedback: "Feedback",
  version: "Version",
  developed_by: "Developed by",
  sw_minute_beep: "Stopwatch minute beep",
  add_color: "Add color",
  vibro_min: "min",
  vibro_low: "low",
  vibro_medium: "mid",
  vibro_high: "high",
  vibro_max: "max",
  vignette_min: "min",
  vignette_low: "low",
  vignette_medium: "mid",
  vignette_high: "high",
  vignette_max: "max",
  limit_reached: "Limit reached",
  accent_limit_msg: "Max 50 custom accent colors",
  bg_limit_msg: "Max 50 custom background colors",
  name_too_long: "Name cannot exceed 50 characters",
  vignette_depth: "Intensity",
  default_color: "Default",
  color_already_exists: "Color already added",
});
Object.assign(translations.ru, {
    theme_classic: "Классика",
    volume: "Громкость",
    edit: "Изменить",
    stopwatch: "Секундомер",
    timer: "Таймер",
    tabata: "Табата",
    settings: "Настройки",
    pause: "ПАУЗА",
    lap: "Круг",
    reset: "Сброс",
    laps_history: "История кругов",
    no_laps: "Нет записей",
    countdown: "Таймер",
    hr: "Ч",
    min: "МИН",
    sec: "СЕК",
    tabata_interval: "Табата Интервалы",
    my_workouts: "Мои тренировки",
    create_new: "+ Своя",
    round: "РАУНД",
    stop: "ЗАВЕРШИТЬ",
    create_workout: "Создать",
    name: "Название",
    work: "Работа",
    rest: "Отдых",
    rounds: "Раунды",
    rds: "Рнд",
    count: "СЧЕТ",
    save: "Сохранить",
    appearance: "Внешний вид",
    language: "Язык",
    lang_auto: "Авто",
    theme: "Тема",
    accent_color: "Цвет акцента",
    bg_color: "Цвет фона",
    interface: "Общие",
    font_size: "Размер шрифта",
    ring_width: "Толщина кольца",
    timer_finished: "Таймер завершен!",
    tabata_complete: "Тренировка завершена!",
    get_ready: "Приготовьтесь",
    cannot_delete: "Нельзя удалить активную/последнюю",
    lap_text: "Круг",
    active_timer: "Сначала остановите таймер!",
    show_ms: "Миллисекунды",
    hide_nav_labels: "Скрыть подписи иконок",
    reset_settings: "Сброс настроек",
    save_session: "Сохранить",
    saved_results: "Сохраненные результаты",
    sort_by: "Сортировка:",
    date_new: "Сначала новые",
    date_old: "Сначала старые",
    name_az: "По имени (А-Я)",
    name_za: "По имени (Я-А)",
    result_fast: "По результату",
    empty_sessions: "Нет результатов",
    session_saved: "Сохранено!",
    enter_name: "Введите название:",
    rename: "Переим.",
    delete: "Удалить",
    cancel: "Отмена",
    session_name: "Имя сессии",
    reset_confirm_msg: "Вы уверены? Ваши тренировки не будут удалены.",
    name_exists: "Имя уже существует",
    timer_zero: "Установите время таймера!",
    sound: "Звук",
    vibration: "Вибрация",
    vibro_level: "Глубина",
    sound_theme: "Тема звуков",
    theme_sport: "Спорт",
    theme_vibe: "Вайб",
    theme_work: "Работа",
    theme_life: "Жизнь",
    total_time: "Общее",
    split_time: "Интервал",
    clear_all: "Очистить все",
    clear_history_confirm: "Вы уверены, что хотите удалить все сохраненные результаты?",
    history_cleared: "История очищена!",
    adaptive_bg: "Адаптивные цвета фона",
    vignette: "Эффект темной виньетки",
    liquid_glass: "Эффект жидкого стекла",
    theme_auto: "Авто",
    theme_light: "Светлая",
    theme_dark: "Темная",
    settings_reset_success: "Настройки сброшены!",
    day_short: "д",
    hour_short: "ч",
    feedback: "Обратная связь",
    version: "Версия",
    developed_by: "Разработано:",
    sw_minute_beep: "Сигнал каждую минуту",
    add_color: "Добавить цвет",
    vibro_min: "мин",
    vibro_low: "низ",
    vibro_medium: "срд",
    vibro_high: "выс",
    vibro_max: "макс",
    vignette_min: "мин",
    vignette_low: "низ",
    vignette_medium: "срд",
    vignette_high: "выс",
    vignette_max: "макс",
    limit_reached: "Достигнут лимит",
    accent_limit_msg: "Максимум 50 своих цветов акцента",
    bg_limit_msg: "Максимум 50 своих цветов фона",
    name_too_long: "Название не может превышать 50 символов",
    vignette_depth: "Интенсивность",
    default_color: "По умполчанию",
    color_already_exists: "Цвет уже добавлен",
});