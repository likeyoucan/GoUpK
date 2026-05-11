// Файл: www/js/app-monetization-config.js

/*

===========================================
APP MONETIZATION CONFIG - СПРАВОЧНИК
===========================================

Этот файл управляет:
1) Pro-гейтингом
2) Рекламой
3) Pro-бейджами в настройках
4) Ценообразованием для кнопки/модалки покупки

-------------------------------------------
1. Раздел pro
-------------------------------------------

pro.enabled
Тип: boolean
Значение:
- true  -> Pro логика включена
- false -> Pro ограничения отключены, приложение работает как free

pro.forcePurchased
Тип: null | true | false
Значение:
- null  -> обычный режим, берется реальное состояние
- true  -> принудительно включить Pro (для QA)
- false -> принудительно выключить Pro (для QA)

Важно:
Это тестовый переключатель. Для production обычно: null.

pro.mode
Тип: "subscription" | "lifetime" | "disabled"
Логика:
- subscription -> подписка
- lifetime     -> разовая покупка Pro
- disabled     -> Pro-гейтинг отключен

pro.features
Тип: Record<string, boolean>
Логика:
- true  -> фича платная (нужен Pro)
- false -> фича бесплатная

Поддерживаемые ключи:
- custom_colors
- accent_bg
- remove_ads
- sound_themes
- app_icon

-------------------------------------------
2. Раздел pro.pricing
-------------------------------------------

Используется для отображения цены:
- в кнопке покупки
- в paywall-модалке

pro.pricing.currency
Тип: string
Пример: "RUB", "USD", "EUR"
Назначение:
Код валюты (можно использовать в форматтерах).

pro.pricing.currencySymbol
Тип: string
Пример: "₽", "$", "€"
Назначение:
Символ для UI.

pro.pricing.amount
Тип: number
Пример: 990
Назначение:
Базовая цена до скидки.

pro.pricing.period
Тип: "month" | "year" | null
Логика:
- month/year -> для подписок
- null       -> для lifetime

pro.pricing.discountEnabled
Тип: boolean
Логика:
- true  -> скидка включена
- false -> скидка отключена

pro.pricing.discountPercent
Тип: number (0..99)
Пример: 40
Логика:
Процент скидки от amount.

Пример расчета:
amount = 990, discountPercent = 40
итог = 594

Рекомендация:
Всегда хранить amount как число, без символов валют.

-------------------------------------------
3. Раздел ads
-------------------------------------------

ads.enabledByDefault
Тип: boolean
- true  -> реклама включена по умолчанию
- false -> реклама выключена по умолчанию

ads.defaultProvider
Тип: "yandex" | "admob" | "mediation"
Назначение:
Провайдер рекламы по умолчанию.

ads.aggregator
Тип: string
Назначение:
Декларативный параметр для native-слоя/роутинга.
(может не использоваться напрямую в web-части)

ads.strategy
Тип: string
Примеры:
- "banner"
- "interstitial"
- "banner+interstitial"
- "off"

ads.interstitialCooldownMs
Тип: number (мс)
Пример: 300000 (5 минут)
Назначение:
Минимальный интервал между interstitial-показами.

-------------------------------------------
4. Раздел proBadges
-------------------------------------------

Массив правил для инжекта Pro-бейджей в настройки.

Структура элемента:
{
  selector: "#setting-row-...",
  feature: "feature_key"
}

selector:
- CSS-селектор строки, где показать бейдж

feature:
- ключ из pro.features
- при клике по бейджу открывается paywall для этой фичи

Важно:
Желательно иметь в строке DOM-слот [data-pro-badge-slot].

-------------------------------------------
5. Готовые профили
-------------------------------------------

A) Полностью free:
pro.enabled = false
pro.mode = "disabled"
все pro.features = false

B) Подписка:
pro.enabled = true
pro.mode = "subscription"
period = "month" или "year"

C) Lifetime:
pro.enabled = true
pro.mode = "lifetime"
period = null

-------------------------------------------
6. Чек перед релизом
-------------------------------------------

- forcePurchased === null
- pro.enabled корректен
- pro.mode соответствует продукту
- pricing заполнен корректно
- discountPercent в диапазоне 0..99
- нет дубликатов Pro-бейджей в UI
- interstitialCooldownMs адекватен

*/

export const APP_MONETIZATION_CONFIG = {
  pro: {
    enabled: true,
    forcePurchased: false, // null | true | false
    mode: "lifetime", // subscription | lifetime | disabled

    features: {
      custom_colors: true,
      accent_bg: true,
      remove_ads: true,
      sound_themes: true,
      app_icon: true,
    },

    pricing: {
      currency: "RUB", // RUB | USD | EUR ...
      currencySymbol: "₽", // символ для UI
      amount: 990, // базовая цена
      period: null, // "month" | "year" | null (null для lifetime)
      discountEnabled: true,
      discountPercent: 40, // 0..99
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