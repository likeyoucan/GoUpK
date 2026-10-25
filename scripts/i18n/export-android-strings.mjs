// Файл: scripts/i18n/export-android-strings.mjs

import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const LOCALES_DIR = path.join(ROOT, "www", "js", "i18n", "locales");
const MAP_FILE = path.join(ROOT, "scripts", "i18n", "android-string-map.json");
const ANDROID_RES_DIR = path.join(ROOT, "android", "app", "src", "main", "res");

function escapeXml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "\\'");
}

function toAndroidValuesDir(langCode) {
  if (!langCode || langCode === "en") return "values";

  // ru -> values-ru
  // pt-BR -> values-pt-rBR
  if (langCode.includes("-")) {
    const [lang, region] = langCode.split("-");
    if (lang && region) {
      return `values-${lang.toLowerCase()}-r${region.toUpperCase()}`;
    }
  }

  return `values-${langCode.toLowerCase()}`;
}

async function loadLocales() {
  const entries = await fs.readdir(LOCALES_DIR, { withFileTypes: true });
  const localeFiles = entries
    .filter((e) => e.isFile() && e.name.endsWith(".js"))
    .map((e) => e.name);

  const localeMap = new Map();

  for (const file of localeFiles) {
    const lang = file.replace(".js", "");
    const filePath = path.join(LOCALES_DIR, file);
    const mod = await import(pathToFileURL(filePath).href);

    // В ваших файлах экспорт: export const en = {...}, export const ru = {...}
    const dict = mod[lang];
    if (!dict || typeof dict !== "object") {
      console.warn(
        `[i18n-export] skip ${file}: export const ${lang} not found`,
      );
      continue;
    }

    localeMap.set(lang, dict);
  }

  return localeMap;
}

function buildAndroidStrings({ localeDict, baseDict, mapping }) {
  const out = {};

  // static keys
  for (const [k, v] of Object.entries(mapping.static || {})) {
    out[k] = String(v);
  }

  // mapped i18n keys
  for (const [androidKey, i18nKey] of Object.entries(mapping.map || {})) {
    const localeValue = localeDict?.[i18nKey];
    const baseValue = baseDict?.[i18nKey];

    if (typeof localeValue === "string" && localeValue.trim().length > 0) {
      out[androidKey] = localeValue;
    } else if (typeof baseValue === "string" && baseValue.trim().length > 0) {
      out[androidKey] = baseValue;
      console.warn(
        `[i18n-export] fallback to en for key "${i18nKey}" -> "${androidKey}"`,
      );
    } else {
      out[androidKey] = i18nKey;
      console.warn(
        `[i18n-export] missing key in all locales: "${i18nKey}" -> "${androidKey}"`,
      );
    }
  }

  return out;
}

function toXml(stringsObj) {
  const keys = Object.keys(stringsObj).sort();

  const lines = [];
  lines.push(`<?xml version="1.0" encoding="utf-8"?>`);
  lines.push(`<resources>`);
  for (const key of keys) {
    lines.push(
      `    <string name="${key}">${escapeXml(stringsObj[key])}</string>`,
    );
  }
  lines.push(`</resources>`);
  lines.push("");

  return lines.join("\n");
}

async function writeStringsFile(valuesDirName, xml) {
  const dirPath = path.join(ANDROID_RES_DIR, valuesDirName);
  const filePath = path.join(dirPath, "strings.xml");

  await fs.mkdir(dirPath, { recursive: true });
  await fs.writeFile(filePath, xml, "utf8");
  console.log(`[i18n-export] wrote ${path.relative(ROOT, filePath)}`);
}

async function main() {
  const mappingRaw = await fs.readFile(MAP_FILE, "utf8");
  const mapping = JSON.parse(mappingRaw);

  const locales = await loadLocales();
  const base = locales.get("en");

  if (!base) {
    throw new Error(
      "Locale en.js is required and must export `export const en = {...}`",
    );
  }

  for (const [lang, dict] of locales.entries()) {
    const stringsObj = buildAndroidStrings({
      localeDict: dict,
      baseDict: base,
      mapping,
    });

    const xml = toXml(stringsObj);
    const valuesDirName = toAndroidValuesDir(lang);
    await writeStringsFile(valuesDirName, xml);
  }
}

main().catch((err) => {
  console.error("[i18n-export] failed:", err);
  process.exit(1);
});
