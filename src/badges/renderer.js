/** Render badge objects into HTML image/fallback badge elements. */
export function badgesToHtml(badges, badgeData) {
  return (Array.isArray(badges) ? badges : [])
    .map((badge) => {
      const url =
        badge?.url ||
        getBadgeUrl(badge?.id || "", badge?.version || "", badgeData || {});
      if (url) {
        return `<img class="ch-badge-img" src="${url}" alt="${escHtml(badge?.id || "")}" title="${escHtml(badge?.id || "")}" loading="lazy" />`;
      }
      return fallbackBadge(badge?.id || "");
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

function fallbackBadge(id) {
  if (id === "mod") return '<span class="ch-badge ch-badge-mod">MOD</span>';
  if (id === "vip") return '<span class="ch-badge ch-badge-vip">VIP</span>';
  if (id === "subscriber") return '<span class="ch-badge ch-badge-sub">SUB</span>';
  if (id === "broadcaster") return '<span class="ch-badge ch-badge-bc">BC</span>';
  if (id === "owner") return '<span class="ch-badge ch-badge-owner">OWNER</span>';
  if (id === "member") return '<span class="ch-badge ch-badge-member">MEMBER</span>';
  return "";
}

function escHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
