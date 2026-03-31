const API = "https://api.twitch.tv/helix/chat/badges";

let globalBadges = {};
let channelBadges = {};

/** Fetch and cache Twitch global badges from Helix. */
export async function fetchGlobal(clientId, token) {
  try {
    if (!clientId || !token) return {};

    const response = await fetch(`${API}/global`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Client-Id": clientId
      }
    });

    if (!response.ok) {
      console.warn("Twitch global badges fetch failed.", response.status);
      return {};
    }

    const data = await response.json();
    globalBadges = normalizeBadgeResponse(data);
    return globalBadges;
  } catch (error) {
    console.warn("Twitch global badges fetch error.", error);
    return {};
  }
}

/** Fetch and cache Twitch channel badges for a broadcaster ID. */
export async function fetchChannel(broadcasterId, clientId, token) {
  try {
    if (!broadcasterId || !clientId || !token) return {};

    const url = `${API}?broadcaster_id=${encodeURIComponent(broadcasterId)}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Client-Id": clientId
      }
    });

    if (!response.ok) {
      console.warn("Twitch channel badges fetch failed.", response.status);
      return {};
    }

    const data = await response.json();
    channelBadges = normalizeBadgeResponse(data);
    return channelBadges;
  } catch (error) {
    console.warn("Twitch channel badges fetch error.", error);
    return {};
  }
}

/** Get a badge image URL by set/version, preferring channel badges. */
export function getBadgeUrl(setId, versionId) {
  return (
    channelBadges?.[setId]?.[versionId] ||
    globalBadges?.[setId]?.[versionId] ||
    ""
  );
}

/** Get all cached Twitch badge data maps. */
export function getAll() {
  return {
    global: globalBadges,
    channel: channelBadges
  };
}

function normalizeBadgeResponse(payload) {
  const out = {};
  const sets = Array.isArray(payload?.data) ? payload.data : [];
  for (const setData of sets) {
    const setId = setData?.set_id;
    if (!setId) continue;
    const versions = {};
    const versionList = Array.isArray(setData?.versions) ? setData.versions : [];
    for (const version of versionList) {
      if (!version?.id) continue;
      versions[version.id] = version.image_url_1x || "";
    }
    out[setId] = versions;
  }
  return out;
}
