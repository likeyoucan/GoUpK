// Подписка

(async () => {
  try {
    // Подхватываем тот же query v, что у main.js
    const mainScript = [...document.scripts].find((s) =>
      s.src.includes("/js/main.js"),
    );
    const v = mainScript ? new URL(mainScript.src).searchParams.get("v") : null;
    const q = v ? `?v=${v}` : "";

    const { appProManager } = await import(`./js/app-pro.js${q}`);

    // На всякий случай инициализация
    await appProManager.init();

    // Выберите режим:
    const MODE = "lifetime"; // "lifetime" | "subscription"

    // Нормальный путь (с подписью)
    if (window.crypto && crypto.subtle) {
      await appProManager.setMode(MODE);
      await appProManager.purchase();

      console.log("[TEST] Pro enabled (signed):", {
        purchased: appProManager.purchased,
        mode: appProManager.mode,
      });
      return;
    }

    // Фолбэк для окружений без crypto.subtle (только для теста текущей сессии)
    appProManager.mode = MODE;
    appProManager.purchased = true;

    localStorage.setItem("app_pro_mode", MODE);
    localStorage.setItem("app_pro_purchased", "true");

    // Если нужно, можно оставить текущие features как есть
    const rawFeatures = localStorage.getItem("app_pro_features");
    if (!rawFeatures) {
      localStorage.setItem(
        "app_pro_features",
        JSON.stringify({
          custom_colors: true,
          accent_bg: true,
          remove_ads: true,
          sound_themes: true,
          app_icon: true,
        }),
      );
    }

    localStorage.setItem("app_pro_updated_at", String(Date.now()));
    // Тестовая заглушка подписи (может быть пересброшена на revalidate)
    localStorage.setItem("app_pro_signature", "test_signature_fallback");

    document.dispatchEvent(
      new CustomEvent("proStatusChanged", {
        detail: { purchased: true, mode: MODE },
      }),
    );

    console.warn(
      "[TEST] Pro enabled via fallback (unsigned). If app revalidates, it may reset.",
    );
  } catch (e) {
    console.error("[TEST] Failed to enable Pro:", e, e?.stack);
  }
})();

// Скрипт для отключения

(async () => {
  try {
    const mainScript = [...document.scripts].find((s) =>
      s.src.includes("/js/main.js"),
    );
    const v = mainScript ? new URL(mainScript.src).searchParams.get("v") : null;
    const q = v ? `?v=${v}` : "";

    const { appProManager } = await import(`./js/app-pro.js${q}`);
    await appProManager.init();

    if (window.crypto && crypto.subtle) {
      await appProManager.revoke();
    } else {
      appProManager.purchased = false;
      localStorage.setItem("app_pro_purchased", "false");
      localStorage.setItem("app_pro_updated_at", String(Date.now()));
      document.dispatchEvent(
        new CustomEvent("proStatusChanged", {
          detail: { purchased: false, mode: appProManager.mode },
        }),
      );
    }

    console.log("[TEST] Pro disabled");
  } catch (e) {
    console.error("[TEST] Failed to disable Pro:", e, e?.stack);
  }
})();


// Проверка цветов


(() => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const root = document.documentElement;
  const body = document.body;

  const original = {
    dark: root.classList.contains("dark"),
    rootStyle: root.getAttribute("style") || "",
    bodyClass: body.className || "",
  };

  // Text targets with semantic contrast kinds
  const textTargets = [
    { sel: "#sw-mainDisplay", name: "SW Main", kind: "largeText" },
    { sel: "#tm-mainDisplay", name: "TM Main", kind: "largeText" },
    { sel: "#tb-mainTimer", name: "TB Main", kind: "largeText" },

    { sel: "#sw-statusText", name: "SW Pause Label", kind: "uiText" },
    { sel: "#tm-statusText", name: "TM Pause Label", kind: "uiText" },
    { sel: "#tb-statusText", name: "TB Pause Label", kind: "uiText" },

    { sel: "#sw-clear-confirm", name: "Clear Confirm", kind: "largeText" },
    { sel: "#reset-confirm", name: "Reset Confirm", kind: "largeText" },
    { sel: "#tb-stopBtn", name: "Stop Btn", kind: "largeText" },
    { sel: "#tm-resetBtn", name: "Timer Reset Btn", kind: "largeText" },
    { sel: "#sw-lapBtn", name: "Lap/Reset Btn", kind: "largeText" },

    { sel: ".text-alert", name: "Alert Text", kind: "uiText" },
    { sel: ".sw-delete-btn", name: "Delete Btn", kind: "uiText" },
    { sel: ".sw-share-btn", name: "Share Btn", kind: "uiText" },
    { sel: ".sw-rename-btn", name: "Rename Btn", kind: "uiText" },
  ];

  // Non-text UI targets (track/thumb/borders/etc.)
  const uiTargets = [
    { sel: ".custom-toggle", name: "Toggle Track", kind: "nonTextUI" },
    { sel: ".custom-toggle::after", name: "Toggle Thumb", kind: "nonTextUI", pseudo: "::after" },
    { sel: ".color-btn", name: "Color Swatch Border", kind: "nonTextUI" },
    { sel: ".app-border", name: "Generic Border", kind: "nonTextUI" },
  ];

  const thresholdByKind = {
    uiText: 4.5,
    largeText: 3.0,
    nonTextUI: 3.0,
  };

  function parseColor(str) {
    if (!str) return null;
    const s = String(str).trim();

    // rgb/rgba
    let m = s.match(/^rgba?\(([^)]+)\)$/i);
    if (m) {
      const p = m[1].split(",").map((x) => Number(x.trim()));
      const r = p[0], g = p[1], b = p[2], a = Number.isFinite(p[3]) ? p[3] : 1;
      if ([r, g, b, a].every(Number.isFinite)) return { r, g, b, a };
    }

    // color(srgb ...)
    m = s.match(
      /^color\(srgb\s+([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)(?:\s*\/\s*([0-9.]+))?\)$/i,
    );
    if (m) {
      const r = Math.round(Number(m[1]) * 255);
      const g = Math.round(Number(m[2]) * 255);
      const b = Math.round(Number(m[3]) * 255);
      const a = m[4] !== undefined ? Number(m[4]) : 1;
      if ([r, g, b, a].every(Number.isFinite)) return { r, g, b, a };
    }

    // fallback normalize via temp node
    const tmp = document.createElement("span");
    tmp.style.position = "fixed";
    tmp.style.left = "-9999px";
    tmp.style.color = s;
    document.body.appendChild(tmp);
    const normalized = getComputedStyle(tmp).color;
    tmp.remove();

    m = String(normalized).match(/^rgba?\(([^)]+)\)$/i);
    if (!m) return null;
    const p = m[1].split(",").map((x) => Number(x.trim()));
    const r = p[0], g = p[1], b = p[2], a = Number.isFinite(p[3]) ? p[3] : 1;
    if ([r, g, b, a].every(Number.isFinite)) return { r, g, b, a };

    return null;
  }

  function blend(fg, bg) {
    const a = fg.a + bg.a * (1 - fg.a);
    if (a <= 0) return { r: 0, g: 0, b: 0, a: 0 };
    return {
      r: Math.round((fg.r * fg.a + bg.r * bg.a * (1 - fg.a)) / a),
      g: Math.round((fg.g * fg.a + bg.g * bg.a * (1 - fg.a)) / a),
      b: Math.round((fg.b * fg.a + bg.b * bg.a * (1 - fg.a)) / a),
      a,
    };
  }

  function getEffectiveBg(el) {
    let node = el;
    let acc = { r: 0, g: 0, b: 0, a: 0 };

    while (node && node !== document.documentElement) {
      const c = parseColor(getComputedStyle(node).backgroundColor);
      if (c) acc = blend(c, acc);
      if (acc.a >= 0.999) break;
      node = node.parentElement;
    }

    if (acc.a < 0.999) {
      const bodyBg =
        parseColor(getComputedStyle(document.body).backgroundColor) || {
          r: 255, g: 255, b: 255, a: 1,
        };
      acc = blend(bodyBg, acc);
    }

    return { r: acc.r, g: acc.g, b: acc.b, a: 1 };
  }

  function lum({ r, g, b }) {
    const f = (v) => {
      const x = v / 255;
      return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  }

  function contrast(a, b) {
    const L1 = Math.max(a, b);
    const L2 = Math.min(a, b);
    return (L1 + 0.05) / (L2 + 0.05);
  }

  function uniqElements(nodeList) {
    return [...new Set([...nodeList])];
  }

  function safeText(el) {
    return (el.textContent || "").trim().slice(0, 24);
  }

  function readStyleColor(el, property, pseudo = null) {
    const cs = getComputedStyle(el, pseudo);
    return parseColor(cs.getPropertyValue(property));
  }

  function auditTextVariant(variantName) {
    const rows = [];

    textTargets.forEach((t) => {
      const elements = uniqElements(document.querySelectorAll(t.sel));
      elements.forEach((el) => {
        const fg = readStyleColor(el, "color");
        const bg = getEffectiveBg(el);
        if (!fg || !bg) return;

        const c = contrast(lum(fg), lum(bg));
        const threshold = thresholdByKind[t.kind] || 4.5;

        rows.push({
          variant: variantName,
          type: "text",
          kind: t.kind,
          target: t.name,
          selector: t.sel,
          text: safeText(el),
          contrast: Number(c.toFixed(2)),
          threshold,
          passAA: c >= threshold,
        });
      });
    });

    return rows;
  }

  function auditUiVariant(variantName) {
    const rows = [];

    uiTargets.forEach((t) => {
      const elements = uniqElements(document.querySelectorAll(t.sel));
      elements.forEach((el) => {
        // For non-text UI:
        // 1) compare border (or bg) against effective background
        // 2) for toggle thumb compare pseudo bg against track bg
        const threshold = thresholdByKind[t.kind] || 3;

        if (t.pseudo) {
          const fg = readStyleColor(el, "background-color", t.pseudo);
          const track = readStyleColor(el, "background-color");
          if (!fg || !track) return;

          const c = contrast(lum(fg), lum(track));
          rows.push({
            variant: variantName,
            type: "ui",
            kind: t.kind,
            target: t.name,
            selector: t.sel + t.pseudo,
            text: "",
            contrast: Number(c.toFixed(2)),
            threshold,
            passAA: c >= threshold,
          });
          return;
        }

        const border = readStyleColor(el, "border-top-color") || readStyleColor(el, "border-color");
        const bg = getEffectiveBg(el);

        // if border is transparent/none fallback to bg-vs-parent-bg
        let fg = border;
        if (!fg || fg.a === 0) {
          fg = readStyleColor(el, "background-color");
        }
        if (!fg || !bg) return;

        const c = contrast(lum(fg), lum(bg));
        rows.push({
          variant: variantName,
          type: "ui",
          kind: t.kind,
          target: t.name,
          selector: t.sel,
          text: "",
          contrast: Number(c.toFixed(2)),
          threshold,
          passAA: c >= threshold,
        });
      });
    });

    return rows;
  }

  function applyVariant(v) {
    root.classList.toggle("dark", !!v.dark);
    root.classList.toggle("glass-effect", !!v.glass);
    root.classList.toggle("bg-red-zone", !!v.redZone);

    body.classList.remove("force-light-text", "force-dark-text");
    if (v.forceText === "light") body.classList.add("force-light-text");
    if (v.forceText === "dark") body.classList.add("force-dark-text");

    root.style.setProperty("--primary-color", v.accent);
    root.style.setProperty("--bg-color", v.bg);
    root.style.setProperty("--surface-color", v.surface || v.bg);
  }

  const variants = [
    { name: "Light default", dark: false, glass: false, redZone: false, accent: "#22c55e", bg: "#f3f4f6", surface: "#ffffff" },
    { name: "Dark default", dark: true, glass: false, redZone: false, accent: "#4ade80", bg: "#000000", surface: "#1c1c1e" },
    { name: "Dark white accent", dark: true, glass: false, redZone: false, accent: "#ffffff", bg: "#000000", surface: "#121214" },
    { name: "Dark white accent + glass", dark: true, glass: true, redZone: false, accent: "#ffffff", bg: "#000000", surface: "#121214" },
    { name: "Red zone light", dark: false, glass: false, redZone: true, accent: "#22c55e", bg: "#2b0006", surface: "#3a0009", forceText: "light" },
    { name: "Red zone dark + glass", dark: true, glass: true, redZone: true, accent: "#4ade80", bg: "#170003", surface: "#2b0006", forceText: "light" },
  ];

  async function run() {
    const all = [];

    for (const v of variants) {
      applyVariant(v);
      await sleep(450);

      const textRows = auditTextVariant(v.name);
      const uiRows = auditUiVariant(v.name);
      const rows = [...textRows, ...uiRows];

      all.push(...rows);

      console.group(`[color-audit] ${v.name}`);
      console.table(rows);
      console.groupEnd();
    }

    const failed = all.filter((r) => !r.passAA);
    const failedText = failed.filter((r) => r.type === "text");
    const failedUi = failed.filter((r) => r.type === "ui");

    console.log(
      "[color-audit] total:", all.length,
      "failed:", failed.length,
      "| text failed:", failedText.length,
      "| ui failed:", failedUi.length,
    );

    if (failed.length) {
      console.group("[color-audit] FAILED (all)");
      console.table(failed);
      console.groupEnd();
    }

    // restore
    root.setAttribute("style", original.rootStyle);
    body.className = original.bodyClass;
    root.classList.toggle("dark", original.dark);

    return { all, failed, failedText, failedUi };
  }

  window.__colorAudit = { run };
  console.log("Ready: __colorAudit.run()");
})();

// Перезагрузка страницы

localStorage.setItem("active-eruda","true"); location.reload();