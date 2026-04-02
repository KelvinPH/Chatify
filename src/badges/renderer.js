function isHttpImageUrl(str) {
  return typeof str === "string" && /^https?:\/\//i.test(str.trim());
}

/** Render badge objects into HTML image/fallback badge elements. */
export function badgesToHtml(badges, badgeData) {
  return (Array.isArray(badges) ? badges : [])
    .map((badge) => {
      const raw =
        badge?.url ||
        getBadgeUrl(badge?.id || "", badge?.version || "", badgeData || {});
      const url = isHttpImageUrl(raw) ? raw.trim() : "";
      if (url) {
        return `<img class="ch-badge-img" src="${escHtml(url)}" alt="${escHtml(badge?.id || "")}" title="${escHtml(badge?.id || "")}" loading="lazy" />`;
      }
      return fallbackBadge(badge?.id || "", badge?.displayText || "");
    })
    .filter(Boolean)
    .join("");
}

function getBadgeUrl(setId, versionId, badgeData) {
  return (
    badgeData?.channel?.[setId]?.[versionId] ||
    badgeData?.global?.[setId]?.[versionId] ||
    ""
  );
}

function fallbackBadge(id, displayText) {
  if (id === "mod" || id === "moderator")
    return '<span class="ch-badge ch-badge-mod">MOD</span>';
  if (id === "vip") return '<span class="ch-badge ch-badge-vip">VIP</span>';
  if (id === "subscriber") return '<span class="ch-badge ch-badge-sub">SUB</span>';
  if (id === "broadcaster") return '<span class="ch-badge ch-badge-bc">BC</span>';
  if (id === "owner") return '<span class="ch-badge ch-badge-owner">OWNER</span>';
  if (id === "member") return '<span class="ch-badge ch-badge-member">MEMBER</span>';
  if (displayText) {
    const full = String(displayText);
    const short = full.length > 16 ? `${full.slice(0, 14)}…` : full;
    return `<span class="ch-badge ch-badge-kick-text" title="${escHtml(full)}">${escHtml(short)}</span>`;
  }
  return "";
}

function escHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
