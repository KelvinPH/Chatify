const API_BASE = "https://www.googleapis.com/youtube/v3";

let pollTimer = null;
let nextPageToken = null;
let liveChatId = null;
let onMessageCallback = null;
let onEventCallback = null;
let lastConfig = null;
let seenIds = new Set();

/** Connect to YouTube Live chat via polling. */
export async function connect({ channelId, apiKey, onMessage, onEvent }) {
  try {
    disconnect();

    onMessageCallback = typeof onMessage === "function" ? onMessage : null;
    onEventCallback = typeof onEvent === "function" ? onEvent : null;
    lastConfig = { channelId, apiKey, onMessage, onEvent };

    if (!channelId || !apiKey) {
      console.warn("YouTube connect skipped: missing channelId or apiKey.");
      return;
    }

    liveChatId = await getLiveChatId(channelId, apiKey);
    if (!liveChatId) {
      console.warn("No active live stream found");
      return;
    }

    startPolling();
  } catch (error) {
    console.warn("YouTube connect failed.", error);
  }
}

/** Disconnect YouTube polling and reset state. */
export function disconnect() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  liveChatId = null;
  nextPageToken = null;
  seenIds.clear();
}

async function getLiveChatId(channelId, apiKey) {
  try {
    const searchUrl = `${API_BASE}/search?part=snippet&channelId=${encodeURIComponent(channelId)}&eventType=live&type=video&key=${encodeURIComponent(apiKey)}`;
    const searchResponse = await fetch(searchUrl);

    if (!searchResponse.ok) {
      if (searchResponse.status === 403) {
        console.warn("YouTube API quota exceeded or access denied (403).");
      } else {
        console.warn("YouTube search request failed.", searchResponse.status);
      }
      return null;
    }

    const searchData = await searchResponse.json();
    const videoId = searchData?.items?.[0]?.id?.videoId;
    if (!videoId) return null;

    const videoUrl = `${API_BASE}/videos?part=liveStreamingDetails&id=${encodeURIComponent(videoId)}&key=${encodeURIComponent(apiKey)}`;
    const videoResponse = await fetch(videoUrl);

    if (!videoResponse.ok) {
      if (videoResponse.status === 403) {
        console.warn("YouTube API quota exceeded or access denied (403).");
      } else {
        console.warn("YouTube videos request failed.", videoResponse.status);
      }
      return null;
    }

    const videoData = await videoResponse.json();
    return videoData?.items?.[0]?.liveStreamingDetails?.activeLiveChatId || null;
  } catch (error) {
    console.warn("Unable to resolve YouTube live chat ID.", error);
    return null;
  }
}

function startPolling() {
  fetchMessages();
  pollTimer = setInterval(fetchMessages, 2500);
}

async function fetchMessages() {
  try {
    if (!liveChatId || !lastConfig?.apiKey) return;

    const url = `${API_BASE}/liveChat/messages?liveChatId=${encodeURIComponent(liveChatId)}&part=snippet,authorDetails&key=${encodeURIComponent(lastConfig.apiKey)}&pageToken=${encodeURIComponent(nextPageToken || "")}`;
    const response = await fetch(url);

    if (!response.ok) {
      if (response.status === 403) {
        console.warn("YouTube API quota exceeded (403). Disconnecting poller.");
        disconnect();
        return;
      }
      if (response.status === 404) {
        console.warn("YouTube live chat not found (404). Disconnecting poller.");
        disconnect();
        return;
      }
      console.warn("YouTube live chat fetch failed.", response.status);
      return;
    }

    const data = await response.json();
    nextPageToken = data?.nextPageToken || null;
    const items = Array.isArray(data?.items) ? data.items : [];

    for (const item of items) {
      if (!item?.id) continue;
      if (seenIds.has(item.id)) continue;

      seenIds.add(item.id);
      if (seenIds.size > 500) {
        const first = seenIds.values().next().value;
        if (first) seenIds.delete(first);
      }

      const author = item.authorDetails || {};
      const snippet = item.snippet || {};
      const badges = [];

      if (author.isChatOwner) badges.push({ id: "owner", version: "1", url: "" });
      if (author.isChatModerator) badges.push({ id: "mod", version: "1", url: "" });
      if (author.isChatSponsor) badges.push({ id: "member", version: "1", url: "" });

      const type = mapYouTubeType(snippet.type);
      const normalized = {
        id: item.id,
        platform: "youtube",
        username: author.displayName || "",
        usernameColor: "",
        message: snippet.displayMessage || "",
        emotes: {},
        badges,
        isSubscriber: Boolean(author.isChatSponsor),
        isMod: Boolean(author.isChatModerator),
        isVip: false,
        isBroadcaster: Boolean(author.isChatOwner),
        isFirstMessage: false,
        bits: 0,
        timestamp: Date.now(),
        type
      };

      if (type === "message") {
        if (onMessageCallback) onMessageCallback(normalized);
      } else if (onEventCallback) {
        onEventCallback(normalized);
      }
    }
  } catch (error) {
    console.warn("YouTube polling error.", error);
  }
}

function mapYouTubeType(rawType) {
  if (rawType === "superChatEvent") return "superchat";
  if (rawType === "memberMilestoneChatEvent") return "sub";
  if (rawType === "newSponsorEvent") return "sub";
  return "message";
}
