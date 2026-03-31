const API = "https://7tv.io/v3";

let globalEmotes = {};
let channelEmotes = {};

/** Fetch 7TV global emotes and cache them. */
export async function fetchGlobal() {
  try {
    const response = await fetch(`${API}/emote-sets/global`);
    if (!response.ok) {
      console.warn("7TV global emotes fetch failed.", response.status);
      return {};
    }

    const data = await response.json();
    const emotes = Array.isArray(data?.emotes) ? data.emotes : [];
    const map = {};

    for (const emote of emotes) {
      if (!emote?.name || !emote?.id) continue;
      map[emote.name] = {
        id: emote.id,
        url: pickFileUrl(emote, 0),
        provider: "7tv"
      };
    }

    globalEmotes = map;
    return globalEmotes;
  } catch (error) {
    console.warn("7TV global emotes fetch error.", error);
    return {};
  }
}

/** Fetch 7TV channel emotes for a Twitch user ID. */
export async function fetchChannel(twitchUserId) {
  try {
    const response = await fetch(`${API}/users/twitch/${encodeURIComponent(twitchUserId)}`);
    if (response.status === 404) {
      channelEmotes = {};
      return {};
    }
    if (!response.ok) {
      console.warn("7TV channel emotes fetch failed.", response.status);
      return {};
    }

    const data = await response.json();
    const emotes = Array.isArray(data?.emote_set?.emotes) ? data.emote_set.emotes : [];
    const map = {};

    for (const emote of emotes) {
      if (!emote?.name || !emote?.id) continue;
      map[emote.name] = {
        id: emote.id,
        url: pickFileUrl(emote, 0),
        provider: "7tv"
      };
    }

    channelEmotes = map;
    return channelEmotes;
  } catch (error) {
    console.warn("7TV channel emotes fetch error.", error);
    return {};
  }
}

/** Get merged 7TV global + channel emotes. */
export function getEmotes() {
  return { ...globalEmotes, ...channelEmotes };
}

function pickFileUrl(emote, preferredIndex) {
  const hostUrl = emote?.data?.host?.url || "";
  const files = Array.isArray(emote?.data?.host?.files) ? emote.data.host.files : [];
  const file = files[preferredIndex] || files[1] || files[0];
  if (!hostUrl || !file?.name) return "";

  const base = hostUrl.startsWith("//") ? `https:${hostUrl}` : hostUrl;
  return `${base}/${file.name}`;
}
