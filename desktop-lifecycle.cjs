function hideWindowOnClose(event, targetWindow, isQuitting) {
  if (isQuitting) return false;
  event.preventDefault();
  targetWindow.hide();
  return true;
}

// "2.0.0" is newer than "2.0.0-beta.1", which is newer than "1.1.7".
// Prerelease tags of the same base version are compared as text.
function parseVersion(version) {
  const [base, pre = ""] = String(version).replace(/^v/, "").split("-", 2);
  return { parts: base.split(".").map((part) => Number(part) || 0), pre };
}

function isNewerVersion(candidate, current) {
  const a = parseVersion(candidate);
  const b = parseVersion(current);
  for (let i = 0; i < Math.max(a.parts.length, b.parts.length); i++) {
    const na = a.parts[i] || 0, nb = b.parts[i] || 0;
    if (na !== nb) return na > nb;
  }
  if (a.pre === b.pre) return false;
  if (!a.pre) return true;
  if (!b.pre) return false;
  return a.pre.localeCompare(b.pre, "en", { numeric: true }) > 0;
}

module.exports = { hideWindowOnClose, isNewerVersion };
