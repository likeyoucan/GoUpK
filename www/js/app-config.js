/*

===========================================
APP CONFIG - ЕДИНАЯ ТОЧКА КОНФИГУРАЦИИ
===========================================

Этот файл объединяет все конфигурации приложения
в одну точку входа. Любой модуль, которому нужен
конфиг, импортирует APP_CONFIG отсюда.

-------------------------------------------
1. Раздел monetization
-------------------------------------------

Ссылка на APP_MONETIZATION_CONFIG.
Содержит всю логику Pro-гейтинга, рекламы,
ценообразования и Pro-бейджей.

Подробный справочник — в файле
app-monetization-config.js

-------------------------------------------
2. Раздел design
-------------------------------------------

design.gridUnit
Тип: number (px)
Значение: базовая единица 4px-сетки.
Все отступы, размеры контролов и высоты
должны быть кратны этому значению.

design.proDefaultAccent
Тип: string (hex)
Значение: цвет Pro-бейджей и Pro CTA-кнопок
при дефолтном акценте темы.
При кастомном акценте Pro-элементы используют
fallback-логику из CSS.

design.bannerPosition
Тип: "top" | "bottom"
Значение: позиция рекламного баннера в layout.
Синхронизирована с monetization.ads.bannerPosition.

-------------------------------------------
3. Как использовать
-------------------------------------------

import { APP_CONFIG } from "./app-config.js?v=VERSION";

// Монетизация
const mode = APP_CONFIG.monetization.pro.mode;
const price = APP_CONFIG.monetization.pro.pricing.amount;

// Дизайн-токены
const unit = APP_CONFIG.design.gridUnit;
const proColor = APP_CONFIG.design.proDefaultAccent;

-------------------------------------------
4. Расширение под другие приложения
-------------------------------------------

Для калькулятора, таск-менеджера и т.д.
добавляйте новые разделы:

export const APP_CONFIG = {
  monetization: ...,
  design: ...,
  features: { calculator: true, tasks: false },
  analytics: { enabled: false, provider: "none" },
};

Каждый раздел — отдельная зона ответственности.
Модули читают только свой раздел.

-------------------------------------------
5. Чек перед релизом
-------------------------------------------

- monetization ссылается на актуальный APP_MONETIZATION_CONFIG
- design.proDefaultAccent совпадает с --pro-badge-color в CSS
- design.bannerPosition согласован с ads.bannerPosition
- Нет прямых импортов APP_MONETIZATION_CONFIG в модулях
  (всё через APP_CONFIG.monetization)

*/

import { APP_MONETIZATION_CONFIG } from "./app-monetization-config.js?v=VERSION";

export const APP_CONFIG = {
  monetization: APP_MONETIZATION_CONFIG,

  design: {
    gridUnit: 8,
    proDefaultAccent: "#34d399",
    bannerPosition: APP_MONETIZATION_CONFIG.ads.bannerPosition || "top",
  },
};
