// Файл: www/js/i18n.js

import { safeGetLS, safeSetLS, safeRemoveLS } from "./utils.js?v=VERSION";
import { CustomSelect } from "./custom-select.js?v=VERSION"; // <-- 1. ДОБАВЛЕН ИМПОРТ

export const translations = {
  en: {
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
  },
  ru: {
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
    clear_history_confirm:
      "Вы уверены, что хотите удалить все сохраненные результаты?",
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
    default_color: "По умолчанию",
    color_already_exists: "Цвет уже добавлен",
  },
};

export const langManager = {
  current: "en",
  langSelect: null, // <-- 2. СВОЙСТВО ДЛЯ ХРАНЕНИЯ ЭКЗЕМПЛЯРА СЕЛЕКТОРА

  init() {
    const stored = safeGetLS("app_lang");
    const initialLang = stored || "auto";

    // <-- 3. ИНИЦИАЛИЗАЦИЯ НОВОГО CUSTOM SELECT -->
    const langOptions = [
      { value: "auto", text: t("lang_auto") },
      { value: "en", text: "English" },
      { value: "ru", text: "Русский" },
    ];

    this.langSelect = new CustomSelect(
      "langSelectContainer",
      langOptions,
      (value) => {
        // onSelect callback
        if (value === "auto") {
          const sys = navigator.language.startsWith("ru") ? "ru" : "en";
          this.setLang(sys, true);
          safeSetLS("app_lang", "auto");
        } else {
          this.setLang(value);
        }
      },
      initialLang, // Начальное значение
    );

    if (initialLang === "auto") {
      const sys = navigator.language.startsWith("ru") ? "ru" : "en";
      this.setLang(sys, true);
    } else {
      this.setLang(initialLang);
    }
  },

  resetSettings() {
    safeRemoveLS("app_lang");
    this.init(); // Переинициализируем для сброса на 'auto'
  },

  setLang(lang, isAuto = false) {
    this.current = lang;
    document.documentElement.lang = lang;
    if (!isAuto) {
      safeSetLS("app_lang", lang);
    }

    // <-- 4. ОБНОВЛЕНИЕ UI CUSTOM SELECT -->
    if (this.langSelect) {
      // Обновляем тексты опций на текущем языке
      this.langSelect.options = [
        { value: "auto", text: t("lang_auto") },
        { value: "en", text: "English" },
        { value: "ru", text: "Русский" },
      ];
      this.langSelect.populateOptions();
      // Устанавливаем правильное значение, не вызывая колбэк
      this.langSelect.setValue(isAuto ? "auto" : lang, false);
    }

    // Обновляем все элементы с data-i18n на странице
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const newText = t(el.getAttribute("data-i18n"));
      // Этот блок нужен, чтобы не затирать вложенные элементы, например, иконки в кнопках
      if (el.children.length === 0) {
        el.textContent = newText;
        return;
      }
      const existingTextNode = Array.from(el.childNodes).find(
        (node) =>
          node.nodeType === Node.TEXT_NODE && node.nodeValue.trim() !== "",
      );
      if (existingTextNode) {
        existingTextNode.nodeValue = newText;
      }
    });

    document.dispatchEvent(new CustomEvent("languageChanged"));
  },
};

export function t(key) {
  return (
    (translations[langManager.current] &&
      translations[langManager.current][key]) ||
    translations["en"][key] ||
    key
  );
}
