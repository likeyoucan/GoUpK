// Файл: www/js/app-monetization-config.js

/*

1. Раздел pro

pro.enabled
Тип: boolean
Значение:
true — Pro логика включена.
false — Pro ограничения отключены, приложение работает как free.
Использовать:
false для бесплатной сборки.
true для обычной монетизированной сборки.

pro.forcePurchased
Тип: null | true | false
Значение:
null — обычный режим, берется реальное состояние.
true — принудительно активировать Pro на старте (тест).
false — принудительно отключить Pro на старте (тест).

Важно:
Это QA-переключатель, не оставлять в проде.
pro.mode
Тип: "subscription" | "lifetime" | "disabled"

Значение:
"subscription" — подписка.
"lifetime" — пожизненная лицензия.
"disabled" — gating отключен.

Рекомендация:
В проде: subscription или lifetime.
Для полностью free: disabled.
pro.features
Тип: Record<string, boolean>

Логика:
true — фича платная (нужен Pro).
false — фича бесплатная.
Поддерживаемые ключи:
custom_colors
accent_bg
remove_ads
sound_themes
app_icon

2. Раздел ads

ads.enabledByDefault
Тип: boolean
Значение:
true — реклама включена по умолчанию.
false — реклама выключена по умолчанию.

ads.defaultProvider
Тип: "yandex" | "admob" | "mediation"
Значение:
какой провайдер выбрать при запуске.
Сейчас используется напрямую в main.js.

ads.aggregator
Тип: string
Сейчас:
декларативный параметр (резерв для native-слоя/роутинга).
напрямую не используется.

ads.strategy
Тип: string
Примеры:
"banner"
"interstitial"
"banner+interstitial"
"off"
Сейчас:
декларативный параметр, напрямую не используется.

ads.interstitialCooldownMs
Тип: number (мс)
Значение:
минимальный интервал между interstitial.
Сейчас используется напрямую.

3. Раздел proBadges

Определяет, где в UI рендерить кнопку Pro.
Структура
selector: CSS-селектор строки настройки.
feature: feature-ключ, на который завязан paywall.
Пример
{ selector: "#setting-row-sound-theme", feature: "sound_themes" }
Требования
Элемент по selector должен существовать в DOM.
В строке желательно иметь [data-pro-badge-slot] для точного размещения бейджа.
Не добавлять вручную data-pro-feature кнопки в HTML, если включен JS-инжект.

4. Что реально применяется сейчас

Используются:

pro.enabled
pro.forcePurchased
pro.mode
pro.features
ads.enabledByDefault
ads.defaultProvider
ads.interstitialCooldownMs
proBadges

Пока не используются напрямую:
ads.aggregator
ads.strategy

5. Готовые профили

A) Полностью бесплатная версия

pro: {
  enabled: false,
  forcePurchased: null,
  mode: "disabled",
  features: {
    custom_colors: false,
    accent_bg: false,
    remove_ads: false,
    sound_themes: false,
    app_icon: false,
  },
},
ads: {
  enabledByDefault: true,
  defaultProvider: "yandex",
  aggregator: "mediation",
  strategy: "banner+interstitial",
  interstitialCooldownMs: 300000,
},

B) Строгий Free + Pro

pro: {
  enabled: true,
  forcePurchased: null,
  mode: "subscription",
  features: {
    custom_colors: true,
    accent_bg: true,
    remove_ads: true,
    sound_themes: true,
    app_icon: true,
  },
},
C) QA (всегда Pro)

pro: {
  enabled: true,
  forcePurchased: true,
  mode: "subscription",
  features: {
    custom_colors: true,
    accent_bg: true,
    remove_ads: true,
    sound_themes: true,
    app_icon: true,
  },
},

6. Частые проблемы

Дубли Pro-кнопок
Причина:
в HTML есть ручные Pro-кнопки и одновременно включен proBadges инжект.
Решение:
оставить только JS-инжект из proBadges.

Бейдж не появляется
Причина:
неверный selector или отсутствует строка в index.html.
Решение:
проверить селектор и id строки в Settings.

Все пользователи внезапно Pro
Причина:
забыли forcePurchased: true после теста.
Решение:
вернуть forcePurchased: null.

Pro не работает
Причина:
pro.enabled: false или mode: "disabled".
Решение:
включить pro.enabled: true, поставить mode subscription/lifetime.

7. Правила перед релизом

Перед production проверяйте:
forcePurchased === null
pro.enabled === true
mode соответствует продукту
features выставлены как в тарифах
нет ручных Pro-кнопок в HTML
ads.defaultProvider и interstitialCooldownMs корректны

8. Быстрый QA чек

Прелоадер скрывается.
btn-buy-pro открывает paywall.
Free пользователь получает paywall на gated-опции.
Pro бейджи есть только в нужных строках.
Нет дубликатов бейджей.
Ads toggle работает с учетом remove_ads.
Interstitial не чаще cooldown.
Переключение языка обновляет тексты в paywall.

*/

export const APP_MONETIZATION_CONFIG = {
  pro: {
    enabled: true,
    forcePurchased: null, // null | true | false
    mode: "lifetime", // subscription | lifetime | disabled
    features: {
      custom_colors: true,
      accent_bg: true,
      remove_ads: true,
      sound_themes: true,
      app_icon: true,
    },
  },

  ads: {
    enabledByDefault: true,
    defaultProvider: "yandex", // yandex | admob | mediation
    aggregator: "mediation",
    strategy: "banner+interstitial",
    interstitialCooldownMs: 5 * 60 * 1000,
  },

  // Один бейдж на строку настройки
  proBadges: [
    { selector: "#setting-row-accent", feature: "accent_bg" },
    { selector: "#setting-row-bg", feature: "accent_bg" },
    { selector: "#setting-row-sound-theme", feature: "sound_themes" },
    { selector: "#setting-row-ads", feature: "remove_ads" },
  ],
};
