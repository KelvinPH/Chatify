const CDN = "https://static-cdn.jtvnw.net/emoticons/v2";

/** Build a Twitch emote image URL for a given emote ID. */
export function getEmoteUrl(emoteId, scale = "1.0") {
  return `${CDN}/${emoteId}/default/dark/${scale}`;
}

/** Convert Twitch IRC emote ranges into mixed text/emote tokens. */
export function extractTwitchEmotes(message, emotesMap) {
  const text = String(message || "");
  if (!emotesMap || Object.keys(emotesMap).length === 0) {
    return [{ type: "text", content: text }];
  }

  const ranges = [];
  for (const [id, positions] of Object.entries(emotesMap)) {
    if (!Array.isArray(positions)) continue;
    for (const rawRange of positions) {
      const [startRaw, endRaw] = String(rawRange).split("-");
      const start = Number(startRaw);
      const end = Number(endRaw);
      if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
      ranges.push({ start, end, id });
    }
  }

  if (ranges.length === 0) {
    return [{ type: "text", content: text }];
  }

  ranges.sort((a, b) => a.start - b.start);
  const tokens = [];
  let cursor = 0;

  for (const range of ranges) {
    if (range.start > cursor) {
      tokens.push({
        type: "text",
        content: text.slice(cursor, range.start)
      });
    }

    const emoteName = text.slice(range.start, range.end + 1);
    tokens.push({
      type: "emote",
      id: range.id,
      name: emoteName,
      url: getEmoteUrl(range.id),
      provider: "twitch"
    });

    cursor = range.end + 1;
  }

  if (cursor < text.length) {
    tokens.push({
      type: "text",
      content: text.slice(cursor)
    });
  }

  return tokens;
}
