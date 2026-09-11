// Файл: www/js/bootstrap/external-links.js

import { openExternalUrl } from "../utils.js?v=VERSION";

function isPrimaryPlainClick(e) {
  return (
    e.button === 0 &&
    !e.defaultPrevented &&
    !e.metaKey &&
    !e.ctrlKey &&
    !e.shiftKey &&
    !e.altKey
  );
}

function isExternalLink(el) {
  if (!(el instanceof HTMLAnchorElement)) return false;
  const href = String(el.getAttribute("href") || "").trim();
  if (!href) return false;

  if (href.startsWith("mailto:")) return true;
  if (href.startsWith("tel:")) return true;
  if (el.target === "_blank") return true;
  if (el.dataset.externalLink === "1") return true;

  return false;
}

export function bindExternalLinks(root = document) {
  const onClick = (e) => {
    if (!isPrimaryPlainClick(e)) return;

    const link = e.target?.closest?.("a[href]");
    if (!(link instanceof HTMLAnchorElement)) return;
    if (!isExternalLink(link)) return;

    const href = String(link.getAttribute("href") || "").trim();
    if (!href) return;

    e.preventDefault();
    e.stopPropagation();

    openExternalUrl(href).catch((err) => {
      console.warn("[external-links] open failed", err);
    });
  };

  root.addEventListener("click", onClick, true);

  return () => {
    root.removeEventListener("click", onClick, true);
  };
}
