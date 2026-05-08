// Файл: www/js/app-pro-security.js

import { safeGetLS, safeSetLS } from "./utils.js?v=VERSION";
import { STORAGE_KEYS } from "./constants/storage-keys.js?v=VERSION";

const SECURITY_SALT = "StopwatchPro::Security::v1";
const VERSION = "1";

function ensureInstallId() {
  let installId = safeGetLS(STORAGE_KEYS.APP_INSTALL_ID);

  if (!installId) {
    installId = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    safeSetLS(STORAGE_KEYS.APP_INSTALL_ID, installId);
  }

  return installId;
}

async function sha256Hex(text) {
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
      v: VERSION,
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
