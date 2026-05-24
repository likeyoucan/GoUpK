// Файл: www/js/app-monetization-config.js

/*
===========================================
APP MONETIZATION CONFIG - PRODUCTION GUIDE
===========================================

Назначение:
Единая декларативная конфигурация монетизации для web + Capacitor.

Этот файл управляет:
1) Pro-гейтингом фич (UI/логика)
2) Принудительными QA-режимами Pro
3) Ценообразованием paywall
4) Рекламной стратегией (баннер/интерстишл)
5) Pro-бейджами в Settings
6) Настройками preload/app icons

-------------------------------------------------
A. Раздел pro
-------------------------------------------------

pro.enabled: boolean
- true: Pro-механика включена
- false: весь Pro-гейтинг отключен (все фичи считаются доступными)

pro.forcePurchased: null | true | false
- null: НОРМАЛЬНЫЙ PROD-РЕЖИМ
- true: принудительно активировать Pro (QA)
- false: принудительно деактивировать Pro (QA)

Важно:
Для релиза всегда используйте forcePurchased: null.
false/true перетирают фактическое состояние пользователя на старте.

pro.mode: "subscription" | "lifetime" | "disabled"
- subscription: подписка
- lifetime: разовая покупка
- disabled: отключить Pro-логику, даже если enabled=true

pro.features: Record<string, boolean>
true = фича gated (требует Pro), false = free

Ключи:
- custom_colors
- accent_bg
- remove_ads
- sound_themes
- app_icon

-------------------------------------------------
B. Раздел pro.pricing
-------------------------------------------------

Используется ТОЛЬКО для UI:
- кнопка покупки в Settings
- paywall-модалка

pricing.currency: "RUB" | "USD" | ...
pricing.currencySymbol: "₽" | "$" | ...
pricing.amount: number (базовая цена)
pricing.period: "month" | "year" | null
pricing.discountEnabled: boolean
pricing.discountPercent: 0..99

Расчет:
current = amount * (1 - discountPercent/100), если discountEnabled=true.

-------------------------------------------------
C. Раздел ads
-------------------------------------------------

ads.enabledByDefault: boolean
- применяется только при первом запуске (когда нет APP_ADS_ENABLED в storage)

ads.autoDisableOnProPurchase: boolean
- true: после покупки Pro реклама авто-выключается (однократно, через marker)
- false: реклама остается, пользователь отключает вручную

ads.defaultProvider: "yandex" | "admob" | "mediation"
ads.aggregator: string
ads.strategy: string
ads.interstitialCooldownMs: number
ads.bannerMode: "always" | "off"
ads.interstitialTriggers: object (карта контекстов interstitial)

-------------------------------------------------
D. Раздел proBadges
-------------------------------------------------

Массив инъекций бейджей "Pro" в Settings:

{
  selector: "#setting-row-...",
  feature: "feature_key"
}

selector: CSS-строка цели
feature: ключ из pro.features
По клику отправляется APP_EVENTS.PRO_PAYWALL_REQUESTED.

-------------------------------------------------
E. Раздел ui
-------------------------------------------------

ui.ads: визуальная политика баннерного контейнера
ui.preload: поведение подписи иконки на прелоадере
ui.appIcons: список доступных иконок и их Pro-гейтинг

appIcons.options[*]:
- id: внутренний id
- nativeName: имя для нативного plugin setIconName()
- image: путь к preview
- labelKey: i18n ключ
- proRequired: требует ли Pro

-------------------------------------------------
F. Валидация перед релизом
-------------------------------------------------

1) forcePurchased === null
2) pro.mode соответствует продукту (subscription/lifetime)
3) pricing.amount > 0 и discountPercent в 0..99
4) proBadges.feature существует в pro.features
5) ads.interstitialCooldownMs >= 30000
6) enabledByDefault/autoDisableOnProPurchase соответствуют бизнес-логике
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

    pricing: {
      currency: "RUB",
      currencySymbol: "₽",
      amount: 990,
      period: null, // month | year | null
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

    // JS-side policy (используется bootstrap-модулем)
    bannerMode: "always", // always | off
    interstitialTriggers: {
      app_start: true,
      app_close: false,
      share: false,
      save_result: false,
      timer_start: false,
      timer_complete: true,
      tabata_complete: true,
    },
  },

  proBadges: [
    { selector: "#setting-row-accent", feature: "accent_bg" },
    { selector: "#setting-row-bg", feature: "accent_bg" },
    { selector: "#setting-row-app-icon", feature: "app_icon" },
    { selector: "#setting-row-sound-theme", feature: "sound_themes" },
    { selector: "#setting-row-ads", feature: "remove_ads" },
  ],

  ui: {
    ads: {
      desktopFixedFromWidth: 1281,
      desktopFixedTopOffsetPx: 8,
      desktopFixedWidth: "min(96vw, 720px)",
    },

    preload: {
      showIconLabel: false,
      showLabelOnlyForProPurchase: true,
      proPurchasedLabelMode: "pro_word", // icon_label | pro_word
      hideLabelWhenEmpty: true,
    },

    appIcons: {
      fallbackImage: "img/app_img.png",
      preloadTimeoutMs: 3000,
      options: [
        {
          id: "default",
          nativeName: "default",
          image: "img/app_img.png",
          labelKey: "app_icon_default",
          proRequired: false,
        },
        {
          id: "pro",
          nativeName: "pro",
          image: "img/app_img.png",
          labelKey: "app_icon_pro",
          proRequired: true,
        },
      ],
    },
  },
};
