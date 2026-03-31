const API = "https://api.frankerfacez.com/v1";

let channelEmotes = {};

/** Fetch FrankerFaceZ channel emotes for a Twitch user ID. */
export async function fetchChannel(twitchUserId) {
  try {
    const response = await fetch(`${API}/room/id/${encodeURIComponent(twitchUserId)}`);
    if (response.status === 404) {
      channelEmotes = {};
      return {};
    }
    if (!response.ok) {
      console.warn("FFZ channel emotes fetch failed.", response.status);
      return {};
    }

    const data = await response.json();
    const sets = data?.sets || {};
    const map = {};

    for (const setData of Object.values(sets)) {
      const emoticons = Array.isArray(setData?.emoticons) ? setData.emoticons : [];
      for (const emote of emoticons) {
        if (!emote?.name || !emote?.id) continue;
        const rawUrl = emote?.urls?.["1"] || "";
        const url = normalizeUrl(rawUrl);
        map[emote.name] = { id: String(emote.id), url, provider: "ffz" };
      }
    }

    channelEmotes = map;
    return channelEmotes;
  } catch (error) {
    console.warn("FFZ channel emotes fetch error.", error);
    return {};
  }
}

/** Get cached FrankerFaceZ channel emotes. */
export function getEmotes() {
  return channelEmotes;
}

function normalizeUrl(url) {
  if (!url) return "";
  if (url.startsWith("//")) return `https:${url}`;
  return url;
}
