/*

===========================================
APP MONETIZATION CONFIG - СПРАВОЧНИК
===========================================

Этот файл управляет:
1) Pro-гейтингом
2) Рекламой
3) Pro-бейджами в настройках
4) Ценообразованием для кнопки/модалки покупки
5) Поведением рекламы при покупке Pro

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

pro.onPurchaseAdsBehavior
Тип: "auto_disable" | "manual"
Логика:
- auto_disable -> после успешной покупки Pro реклама
                   автоматически выключается (APP_ADS_ENABLED = false),
                   переключатель Ads в настройках переводится в OFF
- manual       -> состояние рекламы не меняется при покупке,
                   пользователь управляет переключателем Ads вручную

Рекомендация:
- Для lifetime-продукта обычно "auto_disable"
- Для подписки с рекламной моделью "manual"

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

Важно:
Это значение используется ТОЛЬКО при первом запуске
приложения, когда в localStorage ещё нет
APP_ADS_ENABLED. При последующих запусках
adsManager.init() читает сохраненное состояние.

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

ads.bannerPosition
Тип: "top" | "bottom"
Значение:
- top    -> баннер отображается над основным контентом
             (под safe-area, перед main)
- bottom -> баннер отображается над навигацией
             (как было в предыдущей версии)

Важно:
Позиция должна быть согласована с CSS-позиционированием
#app-ad-slot в input.css.

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
pro.onPurchaseAdsBehavior = "manual"
все pro.features = false

B) Подписка с рекламой:
pro.enabled = true
pro.mode = "subscription"
pro.onPurchaseAdsBehavior = "manual"
period = "month" или "year"

C) Подписка без рекламы после покупки:
pro.enabled = true
pro.mode = "subscription"
pro.onPurchaseAdsBehavior = "auto_disable"
period = "month" или "year"

D) Lifetime без рекламы:
pro.enabled = true
pro.mode = "lifetime"
pro.onPurchaseAdsBehavior = "auto_disable"
period = null

E) Lifetime с ручным управлением рекламой:
pro.enabled = true
pro.mode = "lifetime"
pro.onPurchaseAdsBehavior = "manual"
period = null

-------------------------------------------
6. Взаимодействие с другими модулями
-------------------------------------------

main.js
- Читает конфиг через APP_CONFIG.monetization
- Вызывает applyMonetizationConfig() при старте
- Слушает PRO_STATUS_CHANGED для onPurchaseAdsBehavior

ads.js
- adsManager.init() читает persisted state из localStorage
- НЕ вызывает setEnabled(enabledByDefault) каждый раз
- Provider и cooldown применяются из конфига

app-pro.js
- appProManager получает mode и features из конфига
- purchase()/revoke() генерируют PRO_STATUS_CHANGED
- Конфиг НЕ хранит purchased-состояние (это localStorage)

pro-ui.js
- Читает pricing для отображения цен
- Читает proBadges для инжекта бейджей

app-config.js
- Единая точка входа: реэкспортирует этот конфиг
  как APP_CONFIG.monetization

-------------------------------------------
7. Чек перед релизом
-------------------------------------------

- forcePurchased === null (не true/false)
- pro.enabled корректен
- pro.mode соответствует продукту
- pro.onPurchaseAdsBehavior задан и соответствует
  продуктовой логике
- pricing заполнен корректно
- discountPercent в диапазоне 0..99
- ads.bannerPosition согласован с layout и CSS
- нет дубликатов Pro-бейджей в UI
- interstitialCooldownMs адекватен
- enabledByDefault не перезатирает пользовательский выбор
  при повторных запусках

*/

export const APP_MONETIZATION_CONFIG = {
  pro: {
    enabled: true,
    forcePurchased: false, // null | true | false
    mode: "lifetime", // subscription | lifetime | disabled
    onPurchaseAdsBehavior: "manual", // "auto_disable" | "manual"

    features: {
      custom_colors: true,
      accent_bg: true,
      remove_ads: true,
      sound_themes: true,
      app_icon: true,
    },

    pricing: {
      currency: "RUB",
      currencySymbol: "₽",
      amount: 990,
      period: null, // "month" | "year" | null
      discountEnabled: true,
      discountPercent: 40,
    },
  },

  ads: {
    enabledByDefault: true,
    defaultProvider: "yandex", // yandex | admob | mediation
    aggregator: "mediation",
    strategy: "banner+interstitial",
    interstitialCooldownMs: 5 * 60 * 1000,
    bannerPosition: "top", // "top" | "bottom"
  },

  proBadges: [
    { selector: "#setting-row-accent", feature: "accent_bg" },
    { selector: "#setting-row-bg", feature: "accent_bg" },
    { selector: "#setting-row-sound-theme", feature: "sound_themes" },
    { selector: "#setting-row-ads", feature: "remove_ads" },
  ],
};
