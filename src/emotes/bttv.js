const API = "https://api.betterttv.net/3";

let globalEmotes = {};
let channelEmotes = {};

/** Fetch BetterTTV global emotes and cache them. */
export async function fetchGlobal() {
  try {
    const response = await fetch(`${API}/cached/emotes/global`);
    if (!response.ok) {
      console.warn("BTTV global emotes fetch failed.", response.status);
      return {};
    }

    const data = await response.json();
    const map = {};
    for (const item of Array.isArray(data) ? data : []) {
      if (!item?.code || !item?.id) continue;
      map[item.code] = { id: item.id, url: buildUrl(item.id), provider: "bttv" };
    }
    globalEmotes = map;
    return globalEmotes;
  } catch (error) {
    console.warn("BTTV global emotes fetch error.", error);
    return {};
  }
}

/** Fetch BetterTTV channel/shared emotes for a Twitch user ID. */
export async function fetchChannel(twitchUserId) {
  try {
    const response = await fetch(`${API}/cached/users/twitch/${encodeURIComponent(twitchUserId)}`);
    if (response.status === 404) {
      channelEmotes = {};
      return {};
    }
    if (!response.ok) {
      console.warn("BTTV channel emotes fetch failed.", response.status);
      return {};
    }

    const data = await response.json();
    const map = {};
    const channelList = Array.isArray(data?.channelEmotes) ? data.channelEmotes : [];
    const sharedList = Array.isArray(data?.sharedEmotes) ? data.sharedEmotes : [];

    for (const item of [...channelList, ...sharedList]) {
      if (!item?.code || !item?.id) continue;
      map[item.code] = { id: item.id, url: buildUrl(item.id), provider: "bttv" };
    }

    channelEmotes = map;
    return channelEmotes;
  } catch (error) {
    console.warn("BTTV channel emotes fetch error.", error);
    return {};
  }
}

/** Get merged BetterTTV global + channel emote maps. */
export function getEmotes() {
  return { ...globalEmotes, ...channelEmotes };
}

function buildUrl(id) {
  return `https://cdn.betterttv.net/emote/${id}/1x`;
}
