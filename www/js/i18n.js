// Файл: www/js/i18n.js

import { safeGetLS, safeSetLS, safeRemoveLS } from "./utils.js?v=VERSION";
import { CustomSelect } from "./custom-select.js?v=VERSION";

export const translations = {
  en: {
    accent_color: "Accent",
    accent_limit_msg: "Max 50 custom accent colors",
    active_timer: "Stop timer first!",
    adaptive_bg: "Adaptive Background Colors",
    add_color: "Add color",
    appearance: "Appearance",
    bg_color: "Background",
    bg_limit_msg: "Max 50 custom background colors",
    cancel: "Cancel",
    cannot_delete: "Cannot delete active/last workout",
    clear_all: "Clear All",
    clear_history_confirm: "Are you sure you want to delete all saved results?",
    color_already_exists: "Color already added",
    count: "COUNT",
    countdown: "Countdown",
    create_new: "+ New",
    create_workout: "Create Workout",
    date_new: "Newest first",
    date_old: "Oldest first",
    day_short: "d",
    default_color: "Default",
    delete: "Delete",
    developed_by: "Developed by",
    edit: "Edit",
    empty_sessions: "No saved sessions",
    enter_name: "Enter session name:",
    feedback: "Feedback",
    font_size: "Font Size",
    get_ready: "Get Ready",
    hide_nav_labels: "Hide Nav Labels",
    history_cleared: "History cleared!",
    hour_short: "h",
    hr: "HR",
    interface: "General",
    lang_auto: "Auto",
    language: "Language",
    lap: "Lap",
    lap_text: "Lap",
    laps_history: "Laps History",
    limit_reached: "Limit reached",
    liquid_glass: "Liquid Glass",
    min: "MIN",
    my_workouts: "My Workouts",
    name: "Name",
    name_az: "Name (A-Z)",
    name_exists: "Name already exists",
    name_too_long: "Name cannot exceed 50 characters",
    name_za: "Name (Z-A)",
    no_laps: "No laps recorded",
    pause: "PAUSE",
    rds: "Rds",
    rename: "Rename",
    reset: "Reset",
    reset_confirm_msg: "Are you sure? Your saved workouts will not be deleted.",
    reset_settings: "Reset to Defaults",
    rest: "Rest",
    result_fast: "Result (Fastest)",
    ring_width: "Ring Thickness",
    round: "ROUND",
    rounds: "Rounds",
    save: "Save",
    save_session: "Save Session",
    saved_results: "Saved Results",
    sec: "SEC",
    session_name: "Session Name",
    session_saved: "Session saved!",
    settings: "Settings",
    settings_reset_success: "Settings Reset!",
    share: "Share",
    share_as_file: "Share as CSV",
    share_as_text: "Share as Text",
    share_copied: "Copied to clipboard",
    share_failed: "Unable to share",
    share_file_failed: "Failed to share file",
    share_file_saved: "CSV file downloaded",
    show_foreground_banner: "Show Notification Banner",
    show_ms: "Show Milliseconds",
    sort_by: "Sort by:",
    sound: "Sound",
    sound_theme: "Sound Theme",
    split_time: "Split",
    stop: "STOP",
    stopwatch: "Stopwatch",
    sw_minute_beep: "Stopwatch minute beep",
    tabata: "Tabata",
    tabata_complete: "Tabata Complete!",
    tabata_interval: "Tabata Interval",
    theme: "Theme",
    theme_auto: "Auto",
    theme_classic: "Classic",
    theme_dark: "Dark",
    theme_life: "Life",
    theme_light: "Light",
    theme_sport: "Sport",
    theme_vibe: "Vibe",
    theme_work: "Work",
    timer: "Timer",
    timer_finished: "Timer Finished!",
    timer_zero: "Set timer value first!",
    total_time: "Total",
    version: "Version",
    vibration: "Vibration",
    vibro_high: "high",
    vibro_level: "Depth",
    vibro_low: "low",
    vibro_max: "max",
    vibro_medium: "mid",
    vibro_min: "min",
    vignette: "Dark Vignette Effect",
    vignette_depth: "Intensity",
    vignette_high: "high",
    vignette_low: "low",
    vignette_max: "max",
    vignette_medium: "mid",
    vignette_min: "min",
    volume: "Volume",
    work: "Work",
  },
  ru: {
    accent_color: "Цвет акцента",
    accent_limit_msg: "Максимум 50 своих цветов акцента",
    active_timer: "Сначала остановите таймер!",
    adaptive_bg: "Адаптивные цвета фона",
    add_color: "Добавить цвет",
    appearance: "Внешний вид",
    bg_color: "Цвет фона",
    bg_limit_msg: "Максимум 50 своих цветов фона",
    cancel: "Отмена",
    cannot_delete: "Нельзя удалить активную/последнюю",
    clear_all: "Очистить все",
    clear_history_confirm:
      "Вы уверены, что хотите удалить все сохраненные результаты?",
    color_already_exists: "Цвет уже добавлен",
    count: "СЧЕТ",
    countdown: "Таймер",
    create_new: "+ Своя",
    create_workout: "Создать",
    date_new: "Сначала новые",
    date_old: "Сначала старые",
    day_short: "д",
    default_color: "По умолчанию",
    delete: "Удалить",
    developed_by: "Разработано:",
    edit: "Изменить",
    empty_sessions: "Нет результатов",
    enter_name: "Введите название:",
    feedback: "Обратная связь",
    font_size: "Размер шрифта",
    get_ready: "Приготовьтесь",
    hide_nav_labels: "Скрыть подписи иконок",
    history_cleared: "История очищена!",
    hour_short: "ч",
    hr: "Ч",
    interface: "Общие",
    lang_auto: "Авто",
    language: "Язык",
    lap: "Круг",
    lap_text: "Круг",
    laps_history: "История кругов",
    limit_reached: "Достигнут лимит",
    liquid_glass: "Эффект жидкого стекла",
    min: "МИН",
    my_workouts: "Мои тренировки",
    name: "Название",
    name_az: "По имени (А-Я)",
    name_exists: "Имя уже существует",
    name_too_long: "Название не может превышать 50 символов",
    name_za: "По имени (Я-А)",
    no_laps: "Нет записей",
    pause: "ПАУЗА",
    rds: "Рнд",
    rename: "Переим.",
    reset: "Сброс",
    reset_confirm_msg: "Вы уверены? Ваши тренировки не будут удалены.",
    reset_settings: "Сброс настроек",
    rest: "Отдых",
    result_fast: "По результату",
    ring_width: "Толщина кольца",
    round: "РАУНД",
    rounds: "Раунды",
    save: "Сохранить",
    save_session: "Сохранить",
    saved_results: "Сохраненные результаты",
    sec: "СЕК",
    session_name: "Имя сессии",
    session_saved: "Сохранено!",
    settings: "Настройки",
    settings_reset_success: "Настройки сброшены!",
    share: "Поделиться",
    share_as_file: "Поделиться файлом CSV",
    share_as_text: "Поделиться текстом",
    share_copied: "Скопировано в буфер",
    share_failed: "Не удалось поделиться",
    share_file_failed: "Не удалось поделиться файлом",
    share_file_saved: "CSV файл загружен",
    show_foreground_banner: "Показывать баннер в шторке",
    show_ms: "Миллисекунды",
    sort_by: "Сортировка:",
    sound: "Звук",
    sound_theme: "Тема звуков",
    split_time: "Интервал",
    stop: "ЗАВЕРШИТЬ",
    stopwatch: "Секундомер",
    sw_minute_beep: "Сигнал каждую минуту",
    tabata: "Табата",
    tabata_complete: "Тренировка завершена!",
    tabata_interval: "Табата Интервалы",
    theme: "Тема",
    theme_auto: "Авто",
    theme_classic: "Классика",
    theme_dark: "Темная",
    theme_life: "Жизнь",
    theme_light: "Светлая",
    theme_sport: "Спорт",
    theme_vibe: "Вайб",
    theme_work: "Работа",
    timer: "Таймер",
    timer_finished: "Таймер завершен!",
    timer_zero: "Установите время таймера!",
    total_time: "Общее",
    version: "Версия",
    vibration: "Вибрация",
    vibro_high: "выс",
    vibro_level: "Глубина",
    vibro_low: "низ",
    vibro_max: "макс",
    vibro_medium: "срд",
    vibro_min: "мин",
    vignette: "Эффект темной виньетки",
    vignette_depth: "Интенсивность",
    vignette_high: "выс",
    vignette_low: "низ",
    vignette_max: "макс",
    vignette_medium: "срд",
    vignette_min: "мин",
    volume: "Громкость",
    work: "Работа",
  },
};

export const langManager = {
  current: "en",
  langSelect: null,

  init() {
    const stored = safeGetLS("app_lang");
    const initialLang = stored || "auto";

    if (this.langSelect) {
      this.langSelect.destroy();
      this.langSelect = null;
    }

    const langOptions = [
      { value: "auto", text: t("lang_auto") },
      { value: "en", text: "English" },
      { value: "ru", text: "Русский" },
    ];

    this.langSelect = new CustomSelect(
      "langSelectContainer",
      langOptions,
      (value) => {
        if (value === "auto") {
          const sys = navigator.language.startsWith("ru") ? "ru" : "en";
          this.setLang(sys, true);
          safeSetLS("app_lang", "auto");
        } else {
          this.setLang(value);
        }
      },
      initialLang,
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
    this.init();
  },

  setLang(lang, isAuto = false) {
    this.current = lang;
    document.documentElement.lang = lang;
    if (!isAuto) {
      safeSetLS("app_lang", lang);
    }

    if (this.langSelect) {
      this.langSelect.options = [
        { value: "auto", text: t("lang_auto") },
        { value: "en", text: "English" },
        { value: "ru", text: "Русский" },
      ];
      this.langSelect.populateOptions();
      this.langSelect.setValue(isAuto ? "auto" : lang, false);
    }

    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const newText = t(el.getAttribute("data-i18n"));
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
