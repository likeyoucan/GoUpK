// Файл: www/js/bootstrap/config-validator.js

const VALID_PRO_MODES = new Set(["subscription", "lifetime", "disabled"]);
const VALID_AD_PROVIDERS = new Set(["yandex", "admob", "mediation"]);
const VALID_BANNER_MODES = new Set(["always", "off"]);
const MIN_INTERSTITIAL_COOLDOWN_MS = 30_000;

function asBool(v, fallback = false) {
  return typeof v === "boolean" ? v : fallback;
}

function asNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function deepClone(obj) {
  try {
    return structuredClone(obj);
  } catch {
    return JSON.parse(JSON.stringify(obj || {}));
  }
}

function pushIssue(issues, level, code, message) {
  issues.push({ level, code, message });
}

function sanitizePro(config, issues) {
  const pro = config.pro || {};
  config.pro = pro;

  pro.enabled = asBool(pro.enabled, true);

  if (![null, true, false].includes(pro.forcePurchased)) {
    pushIssue(
      issues,
      "warn",
      "pro.forcePurchased.invalid",
      "pro.forcePurchased должен быть null | true | false. Применен null.",
    );
    pro.forcePurchased = null;
  }

  if (pro.forcePurchased !== null) {
    pushIssue(
      issues,
      "warn",
      "pro.forcePurchased.qa_mode",
      "Обнаружен QA-режим forcePurchased. Для релиза рекомендуется null.",
    );
  }

  if (!VALID_PRO_MODES.has(pro.mode)) {
    pushIssue(
      issues,
      "warn",
      "pro.mode.invalid",
      "pro.mode некорректен. Применен 'subscription'.",
    );
    pro.mode = "subscription";
  }

  if (!pro.enabled && pro.mode !== "disabled") {
    pushIssue(
      issues,
      "warn",
      "pro.mode.mismatch",
      "pro.enabled=false, но mode != disabled. Применен mode='disabled'.",
    );
    pro.mode = "disabled";
  }

  pro.features =
    typeof pro.features === "object" && pro.features ? pro.features : {};
  Object.keys(pro.features).forEach((k) => {
    pro.features[k] = !!pro.features[k];
  });

  pro.pricing =
    typeof pro.pricing === "object" && pro.pricing ? pro.pricing : {};
  pro.pricing.currency = String(pro.pricing.currency || "RUB");
  pro.pricing.currencySymbol = String(pro.pricing.currencySymbol || "₽");
  pro.pricing.amount = Math.max(0, asNumber(pro.pricing.amount, 0));
  pro.pricing.period =
    pro.pricing.period === "month" || pro.pricing.period === "year"
      ? pro.pricing.period
      : null;
  pro.pricing.discountEnabled = asBool(pro.pricing.discountEnabled, false);
  pro.pricing.discountPercent = Math.max(
    0,
    Math.min(99, asNumber(pro.pricing.discountPercent, 0)),
  );
}

function sanitizeAds(config, issues) {
  const ads = config.ads || {};
  config.ads = ads;

  ads.enabledByDefault = asBool(ads.enabledByDefault, true);
  ads.autoDisableOnProPurchase = asBool(ads.autoDisableOnProPurchase, true);

  if (!VALID_AD_PROVIDERS.has(ads.defaultProvider)) {
    pushIssue(
      issues,
      "warn",
      "ads.defaultProvider.invalid",
      "ads.defaultProvider некорректен. Применен 'yandex'.",
    );
    ads.defaultProvider = "yandex";
  }

  ads.aggregator = String(ads.aggregator || "mediation");
  ads.strategy = String(ads.strategy || "banner+interstitial");

  ads.interstitialCooldownMs = Math.max(
    MIN_INTERSTITIAL_COOLDOWN_MS,
    asNumber(ads.interstitialCooldownMs, 5 * 60 * 1000),
  );

  const bannerMode = ads.bannerMode || "always";
  if (!VALID_BANNER_MODES.has(bannerMode)) {
    pushIssue(
      issues,
      "warn",
      "ads.bannerMode.invalid",
      "ads.bannerMode некорректен. Применен 'always'.",
    );
    ads.bannerMode = "always";
  } else {
    ads.bannerMode = bannerMode;
  }

  if (
    !ads.interstitialTriggers ||
    typeof ads.interstitialTriggers !== "object"
  ) {
    ads.interstitialTriggers = {};
  }
}

function sanitizeBadges(config) {
  if (!Array.isArray(config.proBadges)) {
    config.proBadges = [];
  }

  config.proBadges = config.proBadges.filter(
    (x) => x && typeof x.selector === "string" && typeof x.feature === "string",
  );
}

export function validateMonetizationConfig(rawConfig) {
  const config = deepClone(rawConfig || {});
  const issues = [];

  sanitizePro(config, issues);
  sanitizeAds(config, issues);
  sanitizeBadges(config);

  return { config, issues };
}

export function reportMonetizationConfigIssues(issues = []) {
  if (!issues.length) return;

  issues.forEach((issue) => {
    const prefix = `[monetization-config:${issue.code}]`;
    if (issue.level === "error") {
      console.error(prefix, issue.message);
      return;
    }
    console.warn(prefix, issue.message);
  });
}
