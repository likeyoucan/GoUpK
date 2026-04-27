// Файл: www/js/share/share-transport.js

function isUserShareCancel(error) {
  if (!error) return false;

  const name = String(error.name || "").toLowerCase();
  const message = String(error.message || "").toLowerCase();

  return (
    name === "aborterror" ||
    name === "notallowederror" ||
    message.includes("cancel") ||
    message.includes("aborted") ||
    message.includes("dismissed") ||
    message.includes("user aborted") ||
    message.includes("user cancelled")
  );
}

function downloadFile(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();

    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }

    ta.remove();
    return ok;
  }
}

export { isUserShareCancel, downloadFile, copyToClipboard };
