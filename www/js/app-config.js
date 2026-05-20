// Файл: www/js/app-config.js

import { APP_MONETIZATION_CONFIG } from "./app-monetization-config.js?v=VERSION";

export const APP_CONFIG = {
  monetization: APP_MONETIZATION_CONFIG,
  design: {
    gridUnit: 4,
    proDefaultAccent: "#34d399",
    bannerPosition: APP_MONETIZATION_CONFIG.ads.bannerPosition || "top",
  },
};