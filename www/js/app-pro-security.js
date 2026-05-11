// Файл: www/js/app-pro-security.js

import { safeGetLS, safeSetLS } from "./utils.js?v=VERSION";
import { STORAGE_KEYS } from "./constants/storage-keys.js?v=VERSION";

const SECURITY_SALT = "StopwatchPro::Security::v1";
const PRO_SECURITY_VERSION = "1";

function ensureInstallId() {
  let installId = safeGetLS(STORAGE_KEYS.APP_INSTALL_ID);

  if (!installId) {
    installId = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    safeSetLS(STORAGE_KEYS.APP_INSTALL_ID, installId);
  }

  return installId;
}

// Fallback hash for webviews where crypto.subtle is not available.
// This is weaker than SHA-256, but prevents crashes and keeps flow stable.
function fallbackHashHex(text) {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;

  for (let i = 0; i < text.length; i += 1) {
    const c = text.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 16777619);
    h2 ^= c;
    h2 = Math.imul(h2, 2166136261);
  }

  const toHex = (n) => (n >>> 0).toString(16).padStart(8, "0");
  return `${toHex(h1)}${toHex(h2)}${toHex(h1 ^ h2)}${toHex((h1 + h2) >>> 0)}`;
}

async function sha256Hex(text) {
  if (!window.crypto || !crypto.subtle) {
    return fallbackHashHex(text);
  }

  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(digest);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const proSecurity = {
  buildPayload({ mode, purchased, features, updatedAt }) {
    return JSON.stringify({
      v: PRO_SECURITY_VERSION,
      mode,
      purchased: !!purchased,
      features: features || {},
      updatedAt: Number(updatedAt) || 0,
    });
  },

  async sign(payload) {
    const installId = ensureInstallId();
    const raw = `${payload}|${installId}|${SECURITY_SALT}`;
    return sha256Hex(raw);
  },

  async verify(payload, signature) {
    if (!signature) return false;
    const expected = await this.sign(payload);
    return expected === signature;
  },

  ensureInstallId,
};
