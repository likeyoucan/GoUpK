// Файл: www/js/app-monetization-config.js

/*

===========================================
APP MONETIZATION CONFIG - ОБНОВЛЕННАЯ ИНСТРУКЦИЯ
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
- true  -> Pro логика включена
- false -> Pro ограничения отключены, приложение работает как free

pro.forcePurchased
Тип: null | true | false
- null  -> обычный режим, берется реальное состояние
- true  -> принудительно включить Pro (QA)
- false -> принудительно выключить Pro (QA)

pro.mode
Тип: "subscription" | "lifetime" | "disabled"
- subscription -> подписка
- lifetime     -> разовая покупка Pro
- disabled     -> Pro-гейтинг отключен

pro.features
Тип: Record<string, boolean>
- true  -> фича платная (нужен Pro)
- false -> фича бесплатная

Ключи:
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

pro.pricing.currencySymbol
Тип: string
Пример: "₽", "$", "€"

pro.pricing.amount
Тип: number
Базовая цена до скидки

pro.pricing.period
Тип: "month" | "year" | null
- month/year -> для подписок
- null       -> для lifetime

pro.pricing.discountEnabled
Тип: boolean

pro.pricing.discountPercent
Тип: number (0..99)

-------------------------------------------
3. Раздел ads
-------------------------------------------

ads.enabledByDefault
Тип: boolean
Назначение:
Состояние рекламы по умолчанию только для первого запуска
(когда в storage еще нет APP_ADS_ENABLED).

ads.autoDisableOnProPurchase
Тип: boolean
Назначение:
Автоматически выключать рекламу при покупке Pro.
- true  -> после покупки Pro реклама выключается автоматически
- false -> реклама остается включенной, пользователь выключает вручную

ads.defaultProvider
Тип: "yandex" | "admob" | "mediation"

ads.aggregator
Тип: string
Декларативный параметр для native-слоя/роутинга

ads.strategy
Тип: string
Примеры: "banner", "interstitial", "banner+interstitial", "off"

ads.interstitialCooldownMs
Тип: number (мс)
Минимальный интервал между interstitial-показами

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

-------------------------------------------
5. Профили
-------------------------------------------

Полностью free:
- pro.enabled = false
- pro.mode = "disabled"
- все pro.features = false

Подписка:
- pro.enabled = true
- pro.mode = "subscription"
- period = "month" или "year"

Lifetime:
- pro.enabled = true
- pro.mode = "lifetime"
- period = null

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
- autoDisableOnProPurchase соответствует вашей продуктовой логике

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
    autoDisableOnProPurchase: true,
    defaultProvider: "yandex", // yandex | admob | mediation
    aggregator: "mediation",
    strategy: "banner+interstitial",
    interstitialCooldownMs: 5 * 60 * 1000,
  },

  proBadges: [
    { selector: "#setting-row-accent", feature: "accent_bg" },
    { selector: "#setting-row-bg", feature: "accent_bg" },
    { selector: "#setting-row-sound-theme", feature: "sound_themes" },
    { selector: "#setting-row-ads", feature: "remove_ads" },
  ],
};